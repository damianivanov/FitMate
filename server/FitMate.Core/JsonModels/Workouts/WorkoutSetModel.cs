using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.Workouts;

public class WorkoutSetModel
{
    public long Id { get; set; }
    public int OrderIndex { get; set; }
    public ExerciseSetType SetType { get; set; }
    public decimal? WeightKg { get; set; }
    public int? Reps { get; set; }
    public int? DurationSeconds { get; set; }
    public decimal? DistanceMeters { get; set; }
    public decimal? Rpe { get; set; }
    public bool IsCompleted { get; set; }
    public string? Notes { get; set; }
}
