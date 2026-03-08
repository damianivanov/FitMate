using FitMate.DB.Entities.Base;

namespace FitMate.DB.Entities;

public class Workout : BaseEntity
{
    public long UserId { get; set; }
    public long? WorkoutTemplateId { get; set; }
    public string Title { get; set; } = string.Empty;
    public DateTime StartedAt { get; set; }
    public DateTime? FinishedAt { get; set; }
    public int? DurationSeconds { get; set; }
    public decimal? TotalVolumeKg { get; set; }
    public string? Mood { get; set; }
    public string? Notes { get; set; }

    public User User { get; set; } = null!;
    public WorkoutTemplate? WorkoutTemplate { get; set; }
    public ICollection<WorkoutExerciseGroup> ExerciseGroups { get; set; } = [];
}
