using System.Security.Claims;
using FitMate.Core.JsonModels.Auth;
using FitMate.DB.Entities;

namespace FitMate.Services.Auth;

public interface IAuthService
{
    /// <summary>
    /// Issues a fresh access/refresh token pair for one device session. Pass the presented tokens as
    /// <paramref name="rotatedAccessToken"/>/<paramref name="rotatedRefreshToken"/> on a refresh to
    /// rotate just that session; leave them null on login to add a new session. Other sessions are
    /// left intact, capped at a per-user maximum of concurrent refresh tokens.
    /// </summary>
    Task<IssuedTokens> IssueTokensAsync(
        User user,
        IReadOnlyCollection<string> roles,
        string? rotatedAccessToken = null,
        string? rotatedRefreshToken = null);
    bool TryValidateRefreshToken(string refreshToken, out ClaimsPrincipal principal);
    Task RevokeTokensAsync(string? accessToken, string? refreshToken, long? actingUserId);

    /// <summary>
    /// Revokes a single refresh token by id. Set-based and idempotent: if the row was already revoked
    /// or pruned by a concurrent refresh it is a no-op, so it never throws a concurrency exception.
    /// </summary>
    Task RevokeRefreshTokenByIdAsync(long refreshTokenId, long actingUserId);
    UserModel BuildUserModel(User user, IReadOnlyCollection<string> roles);

    /// <summary>
    /// Verifies a Google ID token (the GIS <c>credential</c>) against the configured client id.
    /// Returns the verified user info, or <c>null</c> if the token is missing, invalid or unverified.
    /// </summary>
    Task<GoogleUserInfo?> ValidateGoogleCredentialAsync(string credential);
}
