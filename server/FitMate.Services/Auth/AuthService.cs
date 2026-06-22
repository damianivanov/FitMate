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
    private const int MaxRefreshTokensPerUser = 5;

    private readonly AppDbContext dbContext;
    private readonly ApplicationSettings settings;

    public AuthService(AppDbContext dbContext, ApplicationSettings settings)
    {
        this.dbContext = dbContext;
        this.settings = settings;
    }

    public async Task<IssuedTokens> IssueTokensAsync(
        User user,
        IReadOnlyCollection<string> roles,
        string? rotatedAccessToken = null,
        string? rotatedRefreshToken = null)
    {
        var accessToken = GenerateJwtToken(user, roles, out var accessTokenExpiresAtUtc);
        var refreshToken = GenerateRefreshToken(user, roles, out var refreshTokenExpiresAtUtc);

        // Issuing is session-scoped so the user can stay signed in on several devices at once
        // (up to MaxRefreshTokensPerUser). A refresh rotates only the presented pair; a fresh login
        // just adds a session and leaves the others alone. Every mutation below is set-based and
        // idempotent, so concurrent refreshes sharing one cookie never raise a
        // DbUpdateConcurrencyException; the transaction keeps "rotate + issue + prune" atomic.
        await using var transaction = await dbContext.Database.BeginTransactionAsync();

        await RevokeAccessTokenIfPresentAsync(rotatedAccessToken, user.Id);
        await DeleteRefreshTokenIfPresentAsync(rotatedRefreshToken);
        await CleanupExpiredAccessTokensAsync(user.Id);
        await CleanupDeadRefreshTokensAsync(user.Id);
        await PruneRefreshTokensAsync(user.Id);

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
        await transaction.CommitAsync();

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

    public Task RevokeRefreshTokenByIdAsync(long refreshTokenId, long actingUserId)
    {
        var now = DateTime.UtcNow;

        // Set-based UPDATE keyed on the row id, so a row a concurrent refresh already revoked or pruned
        // matches nothing instead of raising DbUpdateConcurrencyException. DateModified/ModifiedById are
        // set here because ExecuteUpdate bypasses SaveChanges and therefore the timestamp/user trackers.
        return dbContext.RefreshTokens
            .Where(x => x.Id == refreshTokenId && x.RevokedAtUtc == null)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(x => x.RevokedAtUtc, now)
                .SetProperty(x => x.DateModified, now)
                .SetProperty(x => x.ModifiedById, actingUserId));
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

    private Task RevokeAccessTokenIfPresentAsync(string? accessToken, long actingUserId)
    {
        if (string.IsNullOrWhiteSpace(accessToken))
        {
            return Task.CompletedTask;
        }

        var now = DateTime.UtcNow;

        // The access token is rotated, not deleted: it stays in the table as a revoked row so the JWT
        // revocation deny-list (Program.cs OnTokenValidated) rejects it until it naturally expires.
        // Set-based UPDATE is idempotent under concurrent refreshes; DateModified/ModifiedById are set
        // here because ExecuteUpdate bypasses SaveChanges and therefore the timestamp/user trackers.
        return dbContext.Tokens
            .Where(x => x.Value == accessToken && x.RevokedAtUtc == null)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(x => x.RevokedAtUtc, now)
                .SetProperty(x => x.DateModified, now)
                .SetProperty(x => x.ModifiedById, actingUserId));
    }

    private Task DeleteRefreshTokenIfPresentAsync(string? refreshToken)
    {
        if (string.IsNullOrWhiteSpace(refreshToken))
        {
            return Task.CompletedTask;
        }

        // Delete (not revoke) the rotated refresh token so the device reuses its session slot rather
        // than leaving a dead row that counts against MaxRefreshTokensPerUser. A replay of the old
        // value then simply isn't found and is rejected as invalid. Set-based, so a row a concurrent
        // refresh already removed is a no-op.
        return dbContext.RefreshTokens
            .Where(x => x.Value == refreshToken)
            .ExecuteDeleteAsync();
    }

    private Task CleanupExpiredAccessTokensAsync(long userId)
    {
        // Access tokens are only consulted as a deny-list for *revoked* tokens, so once a row is past
        // its expiry it is dead weight (an expired JWT already fails lifetime validation). Pruning them
        // keeps the table bounded now that issuing no longer revokes every active token.
        var now = DateTime.UtcNow;
        return dbContext.Tokens
            .Where(x => x.UserId == userId && x.ExpiresAtUtc <= now)
            .ExecuteDeleteAsync();
    }

    private Task CleanupDeadRefreshTokensAsync(long userId)
    {
        // Drop revoked or expired refresh tokens before applying the cap so dead rows (e.g. from a
        // logout) never occupy one of the MaxRefreshTokensPerUser active-session slots.
        var now = DateTime.UtcNow;
        return dbContext.RefreshTokens
            .Where(x => x.UserId == userId && (x.RevokedAtUtc != null || x.ExpiresAtUtc <= now))
            .ExecuteDeleteAsync();
    }

    private async Task PruneRefreshTokensAsync(long userId)
    {
        // Keep only the newest (MaxRefreshTokensPerUser - 1) live rows for the user. The caller adds one
        // brand-new refresh token in the same transaction, so the post-issue total never exceeds
        // MaxRefreshTokensPerUser. A device that refreshes gets a higher id and stays "newest", so the
        // oldest (least-recently-used) session is the one evicted when a new device pushes past the cap.
        // Set-based DELETE so a row a concurrent refresh already removed is a no-op, not a concurrency error.
        var keepIds = dbContext.RefreshTokens
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.Id)
            .Take(MaxRefreshTokensPerUser - 1)
            .Select(x => x.Id);

        await dbContext.RefreshTokens
            .Where(x => x.UserId == userId && !keepIds.Contains(x.Id))
            .ExecuteDeleteAsync();
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
