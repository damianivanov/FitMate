using System.ComponentModel.DataAnnotations;
using FitMate.Core.JsonModels.Common;

namespace FitMate.Core.JsonModels.Errors;

public class ErrorQueryRequest : PagedRequest
{
    [StringLength(200)]
    public string? Search { get; set; }
}
