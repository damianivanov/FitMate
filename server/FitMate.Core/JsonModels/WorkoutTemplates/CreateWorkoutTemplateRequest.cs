using System.ComponentModel.DataAnnotations;

namespace FitMate.Core.JsonModels.WorkoutTemplates;

public class CreateWorkoutTemplateRequest
{
    [Required]
    [StringLength(200)]
    public string Name { get; set; } = string.Empty;

    [StringLength(2000)]
    public string? Description { get; set; }

    [Range(1, 600)]
    public int? EstimatedDurationMinutes { get; set; }
    public bool IsPublic { get; set; }
    public List<CreateWorkoutTemplateExerciseRequest> Exercises { get; set; } = [];
}
