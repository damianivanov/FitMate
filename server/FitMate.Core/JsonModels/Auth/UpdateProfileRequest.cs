using System.ComponentModel.DataAnnotations;

namespace FitMate.Core.JsonModels.Auth;

public class UpdateProfileRequest
{
    [Required]
    [StringLength(100)]
    public string FirstName { get; set; } = string.Empty;

    [StringLength(100)]
    public string? LastName { get; set; }
}
