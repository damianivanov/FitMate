namespace FitMate.Core.JsonModels.WorkoutTemplates;

public class WorkoutTemplateExerciseSetModel
{
    public long Id { get; set; }
    public int OrderIndex { get; set; }
    public decimal? WeightKg { get; set; }
    public int? Reps { get; set; }
    public int? DurationSeconds { get; set; }
    public decimal? DistanceMeters { get; set; }
    public decimal? Rpe { get; set; }
    public int? RestSeconds { get; set; }
    public string? Notes { get; set; }
}
