using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.Subscriptions;

public class SubscriptionPlanModel
{
    public long Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public List<SubscriptionPlanPriceModel> Prices { get; set; } = [];
    public List<PlanFeatureModel> Features { get; set; } = [];
}
