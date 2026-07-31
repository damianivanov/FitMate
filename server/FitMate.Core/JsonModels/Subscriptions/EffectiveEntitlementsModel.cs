using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.Subscriptions;

public class EffectiveEntitlementsModel
{
    public long PlanId { get; set; }
    public string PlanCode { get; set; } = string.Empty;
    public string PlanName { get; set; } = string.Empty;
    public EntitlementSource Source { get; set; }
    public List<FeatureAvailabilityModel> Features { get; set; } = [];
}
