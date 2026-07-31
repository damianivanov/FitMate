using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.Subscriptions;

public class SubscriptionPlanPriceModel
{
    public long Id { get; set; }
    public string Currency { get; set; } = "EUR";
    public decimal Amount { get; set; }
    public BillingInterval BillingInterval { get; set; }
}
