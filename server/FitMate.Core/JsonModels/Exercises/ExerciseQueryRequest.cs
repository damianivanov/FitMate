using System.ComponentModel.DataAnnotations;
using FitMate.Core.JsonModels.Common;

namespace FitMate.Core.JsonModels.Exercises;

public class ExerciseQueryRequest : PagedRequest
{
    [StringLength(200)]
    public string? Search { get; set; }

    // Null = return all exercises (the admin grid lists everything: global + every
    // user's private exercises). Set explicitly to filter: true = global only
    // (UserId == null), false = user-owned only.
    public bool? IsGlobal { get; set; }
    public long? UserId { get; set; }
}
