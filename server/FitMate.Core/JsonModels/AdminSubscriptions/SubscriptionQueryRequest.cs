using System.ComponentModel.DataAnnotations;
using FitMate.Core.JsonModels.Common;
using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.AdminSubscriptions;

public class SubscriptionQueryRequest : PagedRequest
{
    [StringLength(200)]
    public string? Search { get; set; }

    [StringLength(50)]
    public string? PlanCode { get; set; }

    public SubscriptionStatus? Status { get; set; }

    /// <summary>Only users whose plan comes from an administrator override.</summary>
    public bool OverriddenOnly { get; set; }
}
