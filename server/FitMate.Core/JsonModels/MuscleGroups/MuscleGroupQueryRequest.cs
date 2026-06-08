using System.ComponentModel.DataAnnotations;
using FitMate.Core.JsonModels.Common;

namespace FitMate.Core.JsonModels.MuscleGroups;

public class MuscleGroupQueryRequest : PagedRequest
{
    [StringLength(200)]
    public string? Search { get; set; }
}
