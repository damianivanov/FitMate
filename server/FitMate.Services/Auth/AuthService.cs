using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using FitMate.Core.JsonModels.Auth;
using FitMate.Core.Settings;
using FitMate.DB;
using FitMate.DB.Constants;
using FitMate.DB.Entities;
using Google.Apis.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using UserRoleModel = FitMate.Core.JsonModels.Auth.UserRole;

namespace FitMate.Services.Auth;

public class AuthService : IAuthService
{
    private const int MaxRefreshTokensPerUser = 2;

    private readonly AppDbContext dbContext;
    private readonly ApplicationSettings settings;

    public AuthService(AppDbContext dbContext, ApplicationSettings settings)
    {
        this.dbContext = dbContext;
        this.settings = settings;
    }

    public async Task<IssuedTokens> IssueTokensAsync(User user, IReadOnlyCollection<string> roles)
    {
        RevokeActiveTokens(user.Id);
        PruneRefreshTokens(user.Id);

        var accessToken = GenerateJwtToken(user, roles, out var accessTokenExpiresAtUtc);
        var refreshToken = GenerateRefreshToken(user, roles, out var refreshTokenExpiresAtUtc);

        dbContext.Tokens.Add(new Token
        {
            UserId = user.Id,
            Value = accessToken,
            ExpiresAtUtc = accessTokenExpiresAtUtc,
        });

        dbContext.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            Value = refreshToken,
            ExpiresAtUtc = refreshTokenExpiresAtUtc,
        });

        await dbContext.SaveChangesAsync(user.Id);

        return new IssuedTokens(accessToken, accessTokenExpiresAtUtc, refreshToken, refreshTokenExpiresAtUtc);
    }

    public bool TryValidateRefreshToken(string refreshToken, out ClaimsPrincipal principal)
    {
        principal = new ClaimsPrincipal();

        try
        {
            var handler = new JwtSecurityTokenHandler();
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(settings.RefreshTokenSigningKey));

            var validationParameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = key,
                ValidateIssuer = true,
                ValidIssuer = settings.RefreshTokenIssuer,
                ValidateAudience = true,
                ValidAudience = settings.RefreshTokenAudience,
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

    public async Task RevokeTokensAsync(string? accessToken, string? refreshToken, long? actingUserId)
    {
        var revokedAtUtc = DateTime.UtcNow;

        await RevokeTokenIfActiveAsync(accessToken, revokedAtUtc);
        await RevokeRefreshTokenIfActiveAsync(refreshToken, revokedAtUtc);

        await dbContext.SaveChangesAsync(actingUserId);
    }

    public UserModel BuildUserModel(User user, IReadOnlyCollection<string> roles)
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

    public async Task<GoogleUserInfo?> ValidateGoogleCredentialAsync(string credential)
    {
        if (string.IsNullOrWhiteSpace(credential) || string.IsNullOrWhiteSpace(settings.GoogleClientId))
        {
            return null;
        }

        try
        {
            var validationSettings = new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = [settings.GoogleClientId],
            };

            var payload = await GoogleJsonWebSignature.ValidateAsync(credential, validationSettings);
            if (payload == null || string.IsNullOrWhiteSpace(payload.Email))
            {
                return null;
            }

            return new GoogleUserInfo(
                payload.Subject,
                payload.Email,
                payload.GivenName,
                payload.FamilyName,
                payload.Picture,
                payload.EmailVerified);
        }
        catch
        {
            // Invalid signature, wrong audience, expired token, etc. — treat as an unauthenticated attempt.
            return null;
        }
    }

    private void RevokeActiveTokens(long userId)
    {
        var now = DateTime.UtcNow;

        var activeTokens = dbContext.Tokens
            .Where(x => x.UserId == userId && x.RevokedAtUtc == null && x.ExpiresAtUtc > now)
            .ToList();

        foreach (var activeToken in activeTokens)
        {
            activeToken.RevokedAtUtc = now;
        }

        var activeRefreshTokens = dbContext.RefreshTokens
            .Where(x => x.UserId == userId && x.RevokedAtUtc == null && x.ExpiresAtUtc > now)
            .ToList();

        foreach (var activeRefreshToken in activeRefreshTokens)
        {
            activeRefreshToken.RevokedAtUtc = now;
        }
    }

    private void PruneRefreshTokens(long userId)
    {
        // Keep only the newest (MaxRefreshTokensPerUser - 1) existing rows for the user. The caller adds one
        // brand-new refresh token in the same SaveChanges, so the post-save total stays at MaxRefreshTokensPerUser.
        // Without this the table gains a permanent row on every login/refresh and is never cleaned up.
        var staleRefreshTokens = dbContext.RefreshTokens
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.Id)
            .Skip(MaxRefreshTokensPerUser - 1)
            .ToList();

        if (staleRefreshTokens.Count > 0)
        {
            dbContext.RefreshTokens.RemoveRange(staleRefreshTokens);
        }
    }

    private async Task RevokeTokenIfActiveAsync(string? token, DateTime revokedAtUtc)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return;
        }

        var storedToken = await dbContext.Tokens
            .FirstOrDefaultAsync(x => x.Value == token && x.RevokedAtUtc == null);

        if (storedToken != null)
        {
            storedToken.RevokedAtUtc = revokedAtUtc;
        }
    }

    private async Task RevokeRefreshTokenIfActiveAsync(string? refreshToken, DateTime revokedAtUtc)
    {
        if (string.IsNullOrWhiteSpace(refreshToken))
        {
            return;
        }

        var storedRefreshToken = await dbContext.RefreshTokens
            .FirstOrDefaultAsync(x => x.Value == refreshToken && x.RevokedAtUtc == null);

        if (storedRefreshToken != null)
        {
            storedRefreshToken.RevokedAtUtc = revokedAtUtc;
        }
    }

    private string GenerateJwtToken(User user, IEnumerable<string> roles, out DateTime expiresAtUtc)
    {
        expiresAtUtc = DateTime.UtcNow.AddMinutes(settings.JwtExpirationMinutes);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.UserName ?? user.Email ?? string.Empty),
            new(ClaimTypes.Email, user.Email ?? string.Empty),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
        };

        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(settings.JwtSigningKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: settings.JwtIssuer,
            audience: settings.JwtAudience,
            claims: claims,
            expires: expiresAtUtc,
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private string GenerateRefreshToken(User user, IEnumerable<string> roles, out DateTime expiresAtUtc)
    {
        expiresAtUtc = DateTime.UtcNow.AddDays(settings.RefreshTokenExpirationDays);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.UserName ?? user.Email ?? string.Empty),
            new(ClaimTypes.Email, user.Email ?? string.Empty),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
        };

        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(settings.RefreshTokenSigningKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: settings.RefreshTokenIssuer,
            audience: settings.RefreshTokenAudience,
            claims: claims,
            expires: expiresAtUtc,
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
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
}
