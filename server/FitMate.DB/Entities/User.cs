using FitMate.DB.Entities.Base;
using Microsoft.AspNetCore.Identity;

namespace FitMate.DB.Entities;

public class User : IdentityUser<long>, IBaseEntity
{
    public string? AvatarUrl { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public DateTime? LastLoginAt { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime DateCreated { get; set; }
    public DateTime? DateModified { get; set; }

    public ICollection<UserBodyMetric> BodyMetrics { get; set; } = new List<UserBodyMetric>();
    public ICollection<Exercise> Exercises { get; set; } = new List<Exercise>();
    public ICollection<WorkoutTemplate> WorkoutTemplates { get; set; } = new List<WorkoutTemplate>();
    public ICollection<Workout> Workouts { get; set; } = new List<Workout>();
    public ICollection<PersonalRecord> PersonalRecords { get; set; } = new List<PersonalRecord>();
    public ICollection<Token> Tokens { get; set; } = new List<Token>();
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
    public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
}

public class Role : IdentityRole<long>
{
    public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
}

public class UserRole : IdentityUserRole<long>
{
    public User User { get; set; } = null!;
    public Role Role { get; set; } = null!;
}
