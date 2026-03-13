using FitMate.Core.JsonModels.Common;

namespace FitMate.Core.JsonModels.MuscleGroups;

public class MuscleGroupQueryRequest : PagedRequest
{
    public string? Search { get; set; }
}
