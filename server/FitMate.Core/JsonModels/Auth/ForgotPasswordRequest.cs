using System.ComponentModel.DataAnnotations;

namespace FitMate.Core.JsonModels.Auth;

public class ForgotPasswordRequest
{
    [Required]
    [EmailAddress]
    [StringLength(256)]
    public string Email { get; set; } = string.Empty;
}
