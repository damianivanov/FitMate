using FitMate.DB.Enums;
using FitMate.DB.Entities.Base;

namespace FitMate.DB.Entities;

public class ExerciseSet : BaseEntity
{
    public long WorkoutExerciseId { get; set; }
    public int OrderIndex { get; set; }
    public ExerciseSetType SetType { get; set; }
    public decimal? WeightKg { get; set; }
    public int? Reps { get; set; }
    public int? DurationSeconds { get; set; }
    public decimal? DistanceMeters { get; set; }
    public decimal? Rpe { get; set; }
    public bool IsCompleted { get; set; } = true;
    public bool IsPersonalRecord { get; set; }
    public string? Notes { get; set; }

    public WorkoutExercise WorkoutExercise { get; set; } = null!;
    public ICollection<PersonalRecord> PersonalRecords { get; set; } = [];
}
