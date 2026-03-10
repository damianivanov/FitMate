using FitMate.Core.JsonModels.Common;

namespace FitMate.Core.JsonModels.Exercises;

public class ExerciseQueryRequest : PagedRequest
{
    public string? Search { get; set; }
    public bool? IsGlobal { get; set; } = true;
    public long? UserId { get; set; }
}
