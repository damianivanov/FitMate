namespace FitMate.Core.JsonModels.Workouts;

public class CreateWorkoutExerciseRequest
{
    public long ExerciseId { get; set; }
    public string? Notes { get; set; }
    public List<CreateWorkoutSetRequest> Sets { get; set; } = [];
}
