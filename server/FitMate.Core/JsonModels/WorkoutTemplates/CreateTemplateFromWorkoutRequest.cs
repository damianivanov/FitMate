namespace FitMate.Core.JsonModels.WorkoutTemplates;

public class CreateTemplateFromWorkoutRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public int? EstimatedDurationMinutes { get; set; }
    public bool IsPublic { get; set; }
}
