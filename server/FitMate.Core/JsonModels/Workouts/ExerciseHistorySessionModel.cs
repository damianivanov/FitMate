namespace FitMate.Core.JsonModels.Workouts;

public class ExerciseHistorySessionModel
{
    public long WorkoutId { get; set; }
    public string WorkoutTitle { get; set; } = string.Empty;
    public DateTime WorkoutStartedAt { get; set; }
    public List<PreviousExerciseSetModel> Sets { get; set; } = [];
}
