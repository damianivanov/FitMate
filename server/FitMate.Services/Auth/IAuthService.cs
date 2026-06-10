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
}
