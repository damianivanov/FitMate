using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.Subscriptions;

public class SubscriptionLimitErrorModel
{
    public string Code { get; set; } = "subscription_limit_reached";
    public SubscriptionFeature Feature { get; set; }
    public int? Limit { get; set; }
    public int Used { get; set; }
    public int Reserved { get; set; }
    public DateTime? ResetsAt { get; set; }
    public bool UpgradeAvailable { get; set; }
}
