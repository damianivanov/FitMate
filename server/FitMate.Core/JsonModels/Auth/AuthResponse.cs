namespace FitMate.Core.JsonModels.Auth;

public class AuthResponse
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public UserModel? User { get; set; }
}
