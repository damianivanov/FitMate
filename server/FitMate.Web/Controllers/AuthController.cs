using FitMate.Core.JsonModels.Auth;
using FitMate.DB;
using FitMate.DB.Constants;
using FitMate.DB.Entities;
using FitMate.Services.Auth;
using FitMate.Services.Users;
using FitMate.Web.Controllers.Base;
using FitMate.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace FitMate.Web.Controllers
{
    [Route("api/auth")]
    public class AuthController : BaseApiController
    {
        private readonly UserManager<User> userManager;
        private readonly SignInManager<User> signInManager;
        private readonly IAuthService authService;

        public AuthController(
            ILogger<BaseApiController> logger,
            AppDbContext dbContext,
            IUserService userService,
            UserManager<User> userManager,
            SignInManager<User> signInManager,
            IAuthService authService)
            : base(logger, dbContext, userService)
        {
            this.userManager = userManager;
            this.signInManager = signInManager;
            this.authService = authService;
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

            var roles = await userManager.GetRolesAsync(user);
            var tokens = await authService.IssueTokensAsync(user, [.. roles]);
            SetAuthCookies(tokens);

            var response = new AuthResponse
            {
                Success = true,
                User = authService.BuildUserModel(user, [.. roles]),
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
            return this.ReturnJson(authService.BuildUserModel(user, [.. roles]));
        }

        [Authorize]
        [HttpPut("profile")]
        public async Task<ActionResult> UpdateProfile([FromBody] UpdateProfileRequest model)
        {
            var userId = UserService.LoggedInUserId;
            if (userId == null)
            {
                return this.ReturnJsonError("Unauthorized.");
            }

            var (firstName, lastName) = NormalizeProfileNames(model);
            var validationError = ValidateProfileNames(firstName, lastName);
            if (validationError != null)
            {
                return this.ReturnJsonError(validationError);
            }

            var user = await userManager.FindByIdAsync(userId.Value.ToString());
            if (user == null)
            {
                return this.ReturnJsonError("Unauthorized.");
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
            return this.ReturnJson(authService.BuildUserModel(user, [.. roles]));
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

            var isRefreshTokenValid = authService.TryValidateRefreshToken(refreshToken, out var principal);
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

            var roles = await userManager.GetRolesAsync(user);
            var tokens = await authService.IssueTokensAsync(user, [.. roles]);
            SetAuthCookies(tokens);

            var response = new AuthResponse
            {
                Success = true,
                User = authService.BuildUserModel(user, [.. roles]),
            };

            return this.ReturnJson(response);
        }

        [Authorize]
        [HttpPost("logout")]
        public async Task<ActionResult> Logout()
        {
            var token = Request.Cookies["Token"];
            if (string.IsNullOrWhiteSpace(token))
            {
                token = Request.Headers.Authorization.FirstOrDefault()?.Split(' ').Last();
            }

            var refreshToken = Request.Cookies["RefreshToken"];

            await authService.RevokeTokensAsync(token, refreshToken, UserService.LoggedInUserId);

            ClearAuthCookies();
            return this.ReturnJson("Logged out successfully.");
        }

        private void SetAuthCookies(IssuedTokens tokens)
        {
            var isDevelopment = UserService.ApplicationSettings.IsDevelopment;
            var accessCookieOptions = new CookieOptions
            {
                HttpOnly = true,
                Secure = !isDevelopment,
                SameSite = isDevelopment ? SameSiteMode.Lax : SameSiteMode.Strict,
                Expires = tokens.AccessTokenExpiresAtUtc,
            };

            var refreshCookieOptions = new CookieOptions
            {
                HttpOnly = true,
                Secure = !isDevelopment,
                SameSite = isDevelopment ? SameSiteMode.Lax : SameSiteMode.Strict,
                Expires = tokens.RefreshTokenExpiresAtUtc,
            };

            Response.Cookies.Append("Token", tokens.AccessToken, accessCookieOptions);
            Response.Cookies.Append("RefreshToken", tokens.RefreshToken, refreshCookieOptions);
        }

        private void ClearAuthCookies()
        {
            Response.Cookies.Delete("Token");
            Response.Cookies.Delete("RefreshToken");
        }
    }
}
