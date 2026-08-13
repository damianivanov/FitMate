namespace FitMate.Core.JsonModels.Auth;

public class UserModel
{
    public long Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? FirstName { get; set; }
    public string? LastName { get; set; }

    /// <summary>Ready-to-render picture URL: a short-lived signed URL for an uploaded avatar, or the external one from Google.</summary>
    public string? AvatarUrl { get; set; }
    public List<UserRole> Roles { get; set; } = [];
    public bool? CookieConsentAnalytics { get; set; }
    public bool? CookieConsentMarketing { get; set; }
    public DateTime? CookieConsentAt { get; set; }
}
