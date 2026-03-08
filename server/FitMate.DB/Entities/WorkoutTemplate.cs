using FitMate.DB.Entities.Base;

namespace FitMate.DB.Entities;

public class WorkoutTemplate : BaseEntity
{
    public long? UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int? EstimatedDurationMinutes { get; set; }
    public bool IsPublic { get; set; }

    public User? User { get; set; }
    public ICollection<TemplateExerciseGroup> ExerciseGroups { get; set; } = [];
    public ICollection<Workout> Workouts { get; set; } = [];
}
