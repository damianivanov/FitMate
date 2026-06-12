using System.Security.Claims;
using FitMate.Core.JsonModels.Auth;
using FitMate.DB.Entities;

namespace FitMate.Services.Auth;

public interface IAuthService
{
    Task<IssuedTokens> IssueTokensAsync(User user, IReadOnlyCollection<string> roles);
    bool TryValidateRefreshToken(string refreshToken, out ClaimsPrincipal principal);
    Task RevokeTokensAsync(string? accessToken, string? refreshToken, long? actingUserId);
    UserModel BuildUserModel(User user, IReadOnlyCollection<string> roles);

    /// <summary>
    /// Verifies a Google ID token (the GIS <c>credential</c>) against the configured client id.
    /// Returns the verified user info, or <c>null</c> if the token is missing, invalid or unverified.
    /// </summary>
    Task<GoogleUserInfo?> ValidateGoogleCredentialAsync(string credential);
}
