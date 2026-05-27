namespace FitMate.Core.JsonModels.Workouts;

public class WorkoutExerciseModel
{
    public long Id { get; set; }
    public long ExerciseId { get; set; }
    public string ExerciseName { get; set; } = string.Empty;
    public string? ExerciseImageUrl { get; set; }
    public int OrderIndex { get; set; }
    public string? Notes { get; set; }
    public List<WorkoutSetModel> Sets { get; set; } = [];
}
