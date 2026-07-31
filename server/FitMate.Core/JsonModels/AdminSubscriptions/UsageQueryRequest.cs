using System.ComponentModel.DataAnnotations;
using FitMate.Core.JsonModels.Common;
using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.AdminSubscriptions;

public class UsageQueryRequest : PagedRequest
{
    [StringLength(200)]
    public string? Search { get; set; }

    public long? UserId { get; set; }
    public SubscriptionFeature? Feature { get; set; }

    /// <summary>Defaults to the current month when omitted.</summary>
    public DateOnly? PeriodStart { get; set; }

    /// <summary>Only buckets that have reached their limit.</summary>
    public bool AtLimitOnly { get; set; }
}
