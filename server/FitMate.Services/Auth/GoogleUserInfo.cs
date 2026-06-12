namespace FitMate.Services.Auth;

/// <summary>
/// The subset of a verified Google ID token that FitMate needs, mapped off Google's
/// payload type so that <see cref="IAuthService"/> doesn't leak the Google SDK type.
/// </summary>
public sealed record GoogleUserInfo(
    string Subject,
    string Email,
    string? FirstName,
    string? LastName,
    string? Picture,
    bool EmailVerified);
