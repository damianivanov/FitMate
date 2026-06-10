namespace FitMate.Core.JsonModels.Workouts;

public class WorkoutModel
{
    public long Id { get; set; }
    public long? WorkoutTemplateId { get; set; }
    public string? TemplateName { get; set; }
    public string Title { get; set; } = string.Empty;
    public DateTime? StartedAt { get; set; }
    public DateTime? FinishedAt { get; set; }
    public int? DurationSeconds { get; set; }
    public decimal? TotalVolumeKg { get; set; }
    public string? Notes { get; set; }
    public int ExerciseCount { get; set; }
    public int SetCount { get; set; }
    public List<WorkoutExerciseGroupModel> Groups { get; set; } = [];
}
