using System.ComponentModel.DataAnnotations;

namespace FitMate.Core.JsonModels.Auth;

public class ChangePasswordRequest
{
    public string CurrentPassword { get; set; } = string.Empty;

    [Required]
    [StringLength(128, MinimumLength = 8)]
    public string NewPassword { get; set; } = string.Empty;
}
