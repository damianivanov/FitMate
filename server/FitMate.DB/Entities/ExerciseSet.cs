using FitMate.DB.Entities.Base;
using FitMate.DB.Enums;

namespace FitMate.DB.Entities;

public class ExerciseSet : BaseEntity
{
    public long WorkoutExerciseId { get; set; }
    public int SetNumber { get; set; }
    public ExerciseSetType SetType { get; set; } = ExerciseSetType.Working;
    public decimal? WeightKg { get; set; }
    public int? Reps { get; set; }
    public int? DurationSeconds { get; set; }
    public decimal? DistanceMeters { get; set; }
    public decimal? Rpe { get; set; }
    public bool IsPersonalRecord { get; set; }
    public string? Notes { get; set; }

    public WorkoutExercise WorkoutExercise { get; set; } = null!;
    public ICollection<PersonalRecord> PersonalRecords { get; set; } = [];
}
