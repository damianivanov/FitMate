using System.ComponentModel.DataAnnotations;

namespace FitMate.Core.JsonModels.MuscleGroups;

public class CreateMuscleGroupRequest
{
    [Required]
    [StringLength(200)]
    public string Name { get; set; } = string.Empty;

    [StringLength(2048)]
    public string? ImageUrl { get; set; }
}
