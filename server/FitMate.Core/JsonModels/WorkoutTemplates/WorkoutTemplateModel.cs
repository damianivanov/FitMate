namespace FitMate.Core.JsonModels.WorkoutTemplates;

public class WorkoutTemplateModel
{
    public long Id { get; set; }
    public long? UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int? EstimatedDurationMinutes { get; set; }
    public bool IsPublic { get; set; }
    public int ExerciseCount { get; set; }
    public int SetCount { get; set; }
    public DateTime DateCreated { get; set; }
    public List<WorkoutTemplateExerciseGroupModel> Groups { get; set; } = [];
}
