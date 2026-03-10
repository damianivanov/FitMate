using FitMate.Core.Common;
using FitMate.Core.JsonModels.Auth;
using FitMate.DB;
using FitMate.DB.Constants;
using FitMate.DB.Entities;
using FitMate.Services.Users;
using FitMate.Web.Controllers.Base;
using FitMate.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using UserRoleModel = FitMate.Core.JsonModels.Auth.UserRole;

namespace FitMate.Web.Controllers
{
    [Route("api/auth")]
    public class AuthController : BaseApiController
    {
        private readonly UserManager<User> userManager;
        private readonly SignInManager<User> signInManager;

        public AuthController(
            ILogger<BaseApiController> logger,
            AppDbContext dbContext,
            IUserService userService,
            UserManager<User> userManager,
            SignInManager<User> signInManager)
            : base(logger, dbContext, userService)
        {
            this.userManager = userManager;
            this.signInManager = signInManager;
        }

        [AllowAnonymous]
        [HttpPost("register")]
        public async Task<ActionResult> Register([FromBody] RegisterRequest model)
        {
            var existingUser = await userManager.FindByEmailAsync(model.Email);
            if (existingUser != null)
            {
                return this.ReturnJsonError("User with this email already exists.");
            }

            var user = new User
            {
                UserName = model.Email,
                Email = model.Email,
                FirstName = model.FirstName,
                LastName = model.LastName,
                EmailConfirmed = true,
                IsActive = true,
            };

            var result = await userManager.CreateAsync(user, model.Password);
            if (!result.Succeeded)
            {
                var firstError = result.Errors.FirstOrDefault()?.Description ?? "Registration failed.";
                return this.ReturnJsonError(firstError);
            }

            await userManager.AddToRoleAsync(user, RoleNames.User);

            var response = new AuthResponse
            {
                Success = true,
                Message = "Registration successful. Please login.",
            };

            return this.ReturnJson(response);
        }

        [AllowAnonymous]
        [HttpPost("login")]
        public async Task<ActionResult> Login([FromBody] LoginRequest model)
        {
            var user = await userManager.FindByEmailAsync(model.Email);
            if (user == null || !user.IsActive)
            {
                return this.ReturnJsonError("Invalid email or password.");
            }

            var result = await signInManager.CheckPasswordSignInAsync(user, model.Password, lockoutOnFailure: false);
            if (!result.Succeeded)
            {
                return this.ReturnJsonError("Invalid email or password.");
            }

            user.LastLoginAt = DateTime.UtcNow;
            await userManager.UpdateAsync(user);

            RevokeActiveTokensWithoutSaving(user.Id);

            var roles = await userManager.GetRolesAsync(user);
            var token = GenerateJwtToken(user, roles, out var tokenExpiresAtUtc);
            var refreshToken = GenerateRefreshToken(user, roles, out var refreshTokenExpiresAtUtc);

            await SaveIssuedTokensAsync(user.Id, token, tokenExpiresAtUtc, refreshToken, refreshTokenExpiresAtUtc);
            SetAuthCookies(token, refreshToken);

            var response = new AuthResponse
            {
                Success = true,
                User = BuildUserModel(user, [.. roles]),
            };

            return this.ReturnJson(response);
        }

        [AllowAnonymous]
        [HttpGet("current-user")]
        public async Task<ActionResult> GetCurrentUser()
        {
            var user = UserService.LoggedInUser;
            if (user == null)
            {
                return this.ReturnJson(new UserModel());
            }

            var roles = await userManager.GetRolesAsync(user);
            return this.ReturnJson(BuildUserModel(user, [.. roles]));
        }

        [Authorize]
        [HttpPut("profile")]
        public async Task<ActionResult> UpdateProfile([FromBody] UpdateProfileRequest model)
        {
            var user = UserService.LoggedInUser;
            if (user == null)
            {
                return this.ReturnJsonError("Unauthorized.");
            }

            var (firstName, lastName) = NormalizeProfileNames(model);
            var validationError = ValidateProfileNames(firstName, lastName);
            if (validationError != null)
            {
                return this.ReturnJsonError(validationError);
            }

            user.FirstName = firstName;
            user.LastName = lastName;

            var updateResult = await userManager.UpdateAsync(user);
            if (!updateResult.Succeeded)
            {
                var firstError = updateResult.Errors.FirstOrDefault()?.Description ?? "Unable to update profile.";
                return this.ReturnJsonError(firstError);
            }

            var roles = await userManager.GetRolesAsync(user);
            return this.ReturnJson(BuildUserModel(user, [.. roles]));
        }

        private static (string FirstName, string? LastName) NormalizeProfileNames(UpdateProfileRequest model)
        {
            var firstName = (model.FirstName ?? string.Empty).Trim();
            var lastName = string.IsNullOrWhiteSpace(model.LastName)
                ? null
                : model.LastName.Trim();

            return (firstName, lastName);
        }

        private static string? ValidateProfileNames(string firstName, string? lastName)
        {
            if (string.IsNullOrWhiteSpace(firstName))
            {
                return "First name is required.";
            }

            if (firstName.Length > 100)
            {
                return "First name is too long.";
            }

            if (lastName is { Length: > 100 })
            {
                return "Last name is too long.";
            }

            return null;
        }

        [AllowAnonymous]
        [HttpPost("refresh")]
        public async Task<ActionResult> RefreshToken()
        {
            var refreshToken = Request.Cookies["RefreshToken"];
            if (string.IsNullOrWhiteSpace(refreshToken))
            {
                return this.ReturnJsonError("Refresh token is required.");
            }

            var isRefreshTokenValid = ValidateRefreshToken(refreshToken, out var principal);
            var existingRefreshToken = await DbContext.RefreshTokens
                .Include(x => x.User)
                .FirstOrDefaultAsync(x => x.Value == refreshToken && x.RevokedAtUtc == null);

            if (!isRefreshTokenValid)
            {
                if (existingRefreshToken != null)
                {
                    existingRefreshToken.RevokedAtUtc = DateTime.UtcNow;
                    await DbContext.SaveChangesAsync(existingRefreshToken.UserId);
                }

                return this.ReturnJsonError("Invalid refresh token.");
            }

            var userIdClaim = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!long.TryParse(userIdClaim, out var tokenUserId))
            {
                if (existingRefreshToken != null)
                {
                    existingRefreshToken.RevokedAtUtc = DateTime.UtcNow;
                    await DbContext.SaveChangesAsync(existingRefreshToken.UserId);
                }

                return this.ReturnJsonError("Invalid token claims.");
            }

            if (existingRefreshToken == null)
            {
                return this.ReturnJsonError("Invalid refresh token.");
            }

            if (existingRefreshToken.UserId != tokenUserId)
            {
                existingRefreshToken.RevokedAtUtc = DateTime.UtcNow;
                await DbContext.SaveChangesAsync(existingRefreshToken.UserId);
                return this.ReturnJsonError("Invalid token claims.");
            }

            if (existingRefreshToken.ExpiresAtUtc <= DateTime.UtcNow)
            {
                existingRefreshToken.RevokedAtUtc = DateTime.UtcNow;
                await DbContext.SaveChangesAsync(existingRefreshToken.UserId);
                return this.ReturnJsonError("Refresh token expired.");
            }

            var user = existingRefreshToken.User;
            if (!user.IsActive)
            {
                existingRefreshToken.RevokedAtUtc = DateTime.UtcNow;
                await DbContext.SaveChangesAsync(existingRefreshToken.UserId);
                return this.ReturnJsonError("User is inactive.");
            }

            RevokeActiveTokensWithoutSaving(user.Id);

            var roles = await userManager.GetRolesAsync(user);
            var newToken = GenerateJwtToken(user, roles, out var tokenExpiresAtUtc);
            var newRefreshToken = GenerateRefreshToken(user, roles, out var refreshTokenExpiresAtUtc);

            await SaveIssuedTokensAsync(user.Id, newToken, tokenExpiresAtUtc, newRefreshToken, refreshTokenExpiresAtUtc);
            SetAuthCookies(newToken, newRefreshToken);

            var response = new AuthResponse
            {
                Success = true,
                User = BuildUserModel(user, [.. roles]),
            };

            return this.ReturnJson(response);
        }

        [Authorize]
        [HttpPost("logout")]
        public async Task<ActionResult> Logout()
        {
            var revokedAtUtc = DateTime.UtcNow;
            var accessToken = Request.Cookies["Token"] ?? Request.Cookies["AccessToken"];
            var refreshToken = Request.Cookies["RefreshToken"];

            await RevokeAccessTokenIfActiveAsync(accessToken, revokedAtUtc);
            await RevokeRefreshTokenIfActiveAsync(refreshToken, revokedAtUtc);

            await DbContext.SaveChangesAsync(UserService.LoggedInUserId);

            ClearAuthCookies();
            return this.ReturnJson("Logged out successfully.");
        }

        private void RevokeActiveTokensWithoutSaving(long userId)
        {
            var now = DateTime.UtcNow;

            var activeTokens = DbContext.Tokens
                .Where(x => x.UserId == userId && x.RevokedAtUtc == null && x.ExpiresAtUtc > now)
                .ToList();

            foreach (var activeToken in activeTokens)
            {
                activeToken.RevokedAtUtc = now;
            }

            var activeRefreshTokens = DbContext.RefreshTokens
                .Where(x => x.UserId == userId && x.RevokedAtUtc == null && x.ExpiresAtUtc > now)
                .ToList();

            foreach (var activeRefreshToken in activeRefreshTokens)
            {
                activeRefreshToken.RevokedAtUtc = now;
            }
        }

        private async Task SaveIssuedTokensAsync(long userId, string token, DateTime tokenExpiresAtUtc, string refreshToken, DateTime refreshTokenExpiresAtUtc)
        {
            DbContext.Tokens.Add(new Token
            {
                UserId = userId,
                Value = token,
                ExpiresAtUtc = tokenExpiresAtUtc,
            });

            DbContext.RefreshTokens.Add(new RefreshToken
            {
                UserId = userId,
                Value = refreshToken,
                ExpiresAtUtc = refreshTokenExpiresAtUtc,
            });

            await DbContext.SaveChangesAsync(userId);
        }

        private bool ValidateRefreshToken(string refreshToken, out ClaimsPrincipal principal)
        {
            principal = new ClaimsPrincipal();

            try
            {
                var handler = new JwtSecurityTokenHandler();
                var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(UserService.ApplicationSettings.RefreshTokenSigningKey));

                var validationParameters = new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = key,
                    ValidateIssuer = true,
                    ValidIssuer = UserService.ApplicationSettings.RefreshTokenIssuer,
                    ValidateAudience = true,
                    ValidAudience = UserService.ApplicationSettings.RefreshTokenAudience,
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.Zero,
                };

                principal = handler.ValidateToken(refreshToken, validationParameters, out var validatedToken);

                return validatedToken is JwtSecurityToken jwtToken
                    && jwtToken.Header.Alg.Equals(SecurityAlgorithms.HmacSha256, StringComparison.InvariantCultureIgnoreCase);
            }
            catch
            {
                return false;
            }
        }

        private string GenerateJwtToken(User user, IEnumerable<string> roles, out DateTime expiresAtUtc)
        {
            expiresAtUtc = DateTime.UtcNow.AddMinutes(UserService.ApplicationSettings.JwtExpirationMinutes);

            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new(ClaimTypes.Name, user.UserName ?? user.Email ?? string.Empty),
                new(ClaimTypes.Email, user.Email ?? string.Empty),
            };

            claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(UserService.ApplicationSettings.JwtSigningKey));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: UserService.ApplicationSettings.JwtIssuer,
                audience: UserService.ApplicationSettings.JwtAudience,
                claims: claims,
                expires: expiresAtUtc,
                signingCredentials: creds);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        private string GenerateRefreshToken(User user, IEnumerable<string> roles, out DateTime expiresAtUtc)
        {
            expiresAtUtc = DateTime.UtcNow.AddDays(UserService.ApplicationSettings.RefreshTokenExpirationDays);

            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new(ClaimTypes.Name, user.UserName ?? user.Email ?? string.Empty),
                new(ClaimTypes.Email, user.Email ?? string.Empty),
                new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
            };

            claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(UserService.ApplicationSettings.RefreshTokenSigningKey));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: UserService.ApplicationSettings.RefreshTokenIssuer,
                audience: UserService.ApplicationSettings.RefreshTokenAudience,
                claims: claims,
                expires: expiresAtUtc,
                signingCredentials: creds);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        private void SetAuthCookies(string token, string refreshToken)
        {
            var isDevelopment = UserService.ApplicationSettings.IsDevelopment;
            var accessCookieOptions = new CookieOptions
            {
                HttpOnly = true,
                Secure = !isDevelopment,
                SameSite = isDevelopment ? SameSiteMode.Lax : SameSiteMode.Strict,
                Expires = DateTimeOffset.UtcNow.AddMinutes(UserService.ApplicationSettings.JwtExpirationMinutes),
            };

            var refreshCookieOptions = new CookieOptions
            {
                HttpOnly = true,
                Secure = !isDevelopment,
                SameSite = isDevelopment ? SameSiteMode.Lax : SameSiteMode.Strict,
                Expires = DateTimeOffset.UtcNow.AddDays(UserService.ApplicationSettings.RefreshTokenExpirationDays),
            };

            Response.Cookies.Append("Token", token, accessCookieOptions);
            Response.Cookies.Append("RefreshToken", refreshToken, refreshCookieOptions);
        }

        private void ClearAuthCookies()
        {
            Response.Cookies.Delete("Token");
            Response.Cookies.Delete("AccessToken");
            Response.Cookies.Delete("RefreshToken");
        }

        private static UserModel BuildUserModel(User user, IReadOnlyCollection<string> roles)
        {
            return new UserModel
            {
                Id = user.Id,
                Email = user.Email ?? string.Empty,
                FirstName = user.FirstName,
                LastName = user.LastName,
                Roles = MapRoles(roles),
            };
        }

        private static List<UserRoleModel> MapRoles(IReadOnlyCollection<string> roles)
        {
            return roles
                .Select(MapRole)
                .Where(role => role.HasValue)
                .Select(role => role.GetValueOrDefault())
                .Distinct()
                .ToList();
        }

        private static UserRoleModel? MapRole(string roleName)
        {
            if (RoleNames.Admin.Equals(roleName, StringComparison.OrdinalIgnoreCase))
            {
                return UserRoleModel.Admin;
            }

            if (RoleNames.User.Equals(roleName, StringComparison.OrdinalIgnoreCase))
            {
                return UserRoleModel.User;
            }

            return null;
        }

        private async Task RevokeAccessTokenIfActiveAsync(string? accessToken, DateTime revokedAtUtc)
        {
            if (string.IsNullOrWhiteSpace(accessToken))
            {
                return;
            }

            var storedAccessToken = await DbContext.Tokens
                .FirstOrDefaultAsync(x => x.Value == accessToken && x.RevokedAtUtc == null);

            if (storedAccessToken != null)
            {
                storedAccessToken.RevokedAtUtc = revokedAtUtc;
            }
        }

        private async Task RevokeRefreshTokenIfActiveAsync(string? refreshToken, DateTime revokedAtUtc)
        {
            if (string.IsNullOrWhiteSpace(refreshToken))
            {
                return;
            }

            var storedRefreshToken = await DbContext.RefreshTokens
                .FirstOrDefaultAsync(x => x.Value == refreshToken && x.RevokedAtUtc == null);

            if (storedRefreshToken != null)
            {
                storedRefreshToken.RevokedAtUtc = revokedAtUtc;
            }
        }
    }
}
