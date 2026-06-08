using System.ComponentModel.DataAnnotations;

namespace FitMate.Core.JsonModels.Exercises;

public class ExerciseLookupRequest
{
    [StringLength(200)]
    public string? Search { get; set; }
    public List<long>? MuscleGroupIds { get; set; }

    [Range(0, int.MaxValue)]
    public int Skip { get; set; } = 0;

    [Range(1, 100)]
    public int Take { get; set; } = 30;
}
