namespace FitMate.Core.JsonModels.Users;

public class AdminUserModel
{
    public long Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public bool IsActive { get; set; }
    public bool IsAdmin { get; set; }
    public DateTime DateCreated { get; set; }
    public DateTime? LastLoginAt { get; set; }
}
