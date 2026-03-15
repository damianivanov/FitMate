namespace FitMate.Core.JsonModels.Workouts;

public class CreateWorkoutRequest
{
    public string Title { get; set; } = string.Empty;
    public DateTime? StartedAt { get; set; }
    public DateTime? FinishedAt { get; set; }
    public string? Notes { get; set; }
    public List<CreateWorkoutExerciseRequest> Exercises { get; set; } = [];
}
