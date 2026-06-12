using System.ComponentModel.DataAnnotations;

namespace FitMate.Core.JsonModels.Auth;

public class GoogleLoginRequest
{
    [Required]
    public string Credential { get; set; } = string.Empty;
}
