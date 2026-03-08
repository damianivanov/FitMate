namespace FitMate.Core.JsonModels.Auth;

public class UpdateProfileRequest
{
    public string FirstName { get; set; } = string.Empty;
    public string? LastName { get; set; }
}
