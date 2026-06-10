namespace FitMate.Core.JsonModels.Workouts;

public class WorkoutCreatedModel
{
    public long WorkoutId { get; set; }
    public string Title { get; set; } = string.Empty;
    public DateTime? StartedAt { get; set; }
    public DateTime? FinishedAt { get; set; }
    public int ExerciseCount { get; set; }
    public int SetCount { get; set; }
    public decimal? TotalVolumeKg { get; set; }
}
