using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.Subscriptions;

public class PlanFeatureModel
{
    public SubscriptionFeature Feature { get; set; }
    public bool IsEnabled { get; set; }
    public int? MonthlyLimit { get; set; }
    public int? HardLimit { get; set; }
}
