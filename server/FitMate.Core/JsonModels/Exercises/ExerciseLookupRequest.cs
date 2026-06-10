using System.ComponentModel.DataAnnotations;
using FitMate.Core.JsonModels.Common;

namespace FitMate.Core.JsonModels.Exercises;

public class ExerciseLookupRequest : OffsetPagedRequest
{
    [StringLength(200)]
    public string? Search { get; set; }
    public List<long>? MuscleGroupIds { get; set; }
}
