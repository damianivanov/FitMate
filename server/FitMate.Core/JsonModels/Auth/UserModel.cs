namespace FitMate.Core.JsonModels.Auth;

public class UserModel
{
    public long Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public List<UserRole> Roles { get; set; } = [];
}
