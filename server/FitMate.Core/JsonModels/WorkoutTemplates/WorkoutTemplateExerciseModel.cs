namespace FitMate.Core.JsonModels.WorkoutTemplates;

public class WorkoutTemplateExerciseModel
{
    public long Id { get; set; }
    public long ExerciseId { get; set; }
    public string ExerciseName { get; set; } = string.Empty;
    public string? ExerciseImageUrl { get; set; }
    public int OrderIndex { get; set; }
    public int TargetSets { get; set; }
    public string? TargetReps { get; set; }
    public decimal? TargetWeightKg { get; set; }
    public int? TargetRestSeconds { get; set; }
    public string? Tempo { get; set; }
    public string? Notes { get; set; }
    public List<WorkoutTemplateExerciseSetModel> Sets { get; set; } = [];
}
