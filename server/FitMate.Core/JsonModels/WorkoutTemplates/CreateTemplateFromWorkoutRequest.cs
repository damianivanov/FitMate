using System.ComponentModel.DataAnnotations;

namespace FitMate.Core.JsonModels.WorkoutTemplates;

public class CreateTemplateFromWorkoutRequest
{
    // Optional: when omitted the template name is derived from the source workout.
    [StringLength(200)]
    public string? Name { get; set; }

    [StringLength(2000)]
    public string? Description { get; set; }

    [Range(1, 600)]
    public int? EstimatedDurationMinutes { get; set; }
    public bool IsPublic { get; set; }
}
