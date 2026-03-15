namespace FitMate.Core.JsonModels.Workouts;

public class PreviousExerciseSetsModel
{
    public long ExerciseId { get; set; }
    public string ExerciseName { get; set; } = string.Empty;
    public long WorkoutId { get; set; }
    public string WorkoutTitle { get; set; } = string.Empty;
    public DateTime WorkoutStartedAt { get; set; }
    public List<PreviousExerciseSetModel> Sets { get; set; } = [];
}
