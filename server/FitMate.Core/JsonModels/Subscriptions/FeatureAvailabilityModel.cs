using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.Subscriptions;

public class FeatureAvailabilityModel
{
    public SubscriptionFeature Feature { get; set; }
    public bool IsEnabled { get; set; }

    /// <summary>Null means unlimited.</summary>
    public int? Limit { get; set; }

    public int Used { get; set; }
    public int Reserved { get; set; }
    public int? Remaining => Limit.HasValue ? Math.Max(0, Limit.Value - Used - Reserved) : null;
    public DateTime? ResetsAt { get; set; }
}
