namespace FitMate.Core.JsonModels.WorkoutTemplates;

public class CreateWorkoutTemplateRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int? EstimatedDurationMinutes { get; set; }
    public bool IsPublic { get; set; }
    public List<CreateWorkoutTemplateExerciseRequest> Exercises { get; set; } = [];
}
