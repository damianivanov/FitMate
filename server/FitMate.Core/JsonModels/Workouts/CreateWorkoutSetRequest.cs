using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.Workouts;

public class CreateWorkoutSetRequest
{
    public ExerciseSetType SetType { get; set; } = ExerciseSetType.Working;
    public decimal? WeightKg { get; set; }
    public int? Reps { get; set; }
    public int? DurationSeconds { get; set; }
    public decimal? DistanceMeters { get; set; }
    public decimal? Rpe { get; set; }
    public string? Notes { get; set; }
}
