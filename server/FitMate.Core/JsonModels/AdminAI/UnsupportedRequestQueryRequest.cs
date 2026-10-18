using System.ComponentModel.DataAnnotations;
using FitMate.Core.JsonModels.Common;
using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.AdminAI;

public class UnsupportedRequestQueryRequest : GridQueryRequest
{
    [StringLength(200)]
    public string? Search { get; set; }

    [StringLength(100)]
    public string? Category { get; set; }

    public UnsupportedRequestStatus? Status { get; set; }
}
