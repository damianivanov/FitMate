using System.ComponentModel.DataAnnotations;

namespace FitMate.Core.JsonModels.Auth;

public class ResetPasswordRequest
{
    [Required]
    [EmailAddress]
    [StringLength(256)]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string Token { get; set; } = string.Empty;

    [Required]
    [StringLength(128, MinimumLength = 8)]
    public string NewPassword { get; set; } = string.Empty;
}
