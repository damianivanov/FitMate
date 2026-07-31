using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.AdminSubscriptions;

/// <summary>A plan as administrators see it: every price and entitlement, including private plans.</summary>
public class SubscriptionPlanAdminModel
{
    public long Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; }
    public bool IsPublic { get; set; }
    public int SortOrder { get; set; }
    public int SubscriberCount { get; set; }
    public List<PlanPriceAdminModel> Prices { get; set; } = [];
    public List<PlanEntitlementAdminModel> Entitlements { get; set; } = [];
}

public class PlanPriceAdminModel
{
    public long Id { get; set; }
    public string Currency { get; set; } = "EUR";
    public decimal Amount { get; set; }
    public BillingInterval BillingInterval { get; set; }
    public string StripePriceId { get; set; } = string.Empty;
    public bool IsActive { get; set; }
}

public class PlanEntitlementAdminModel
{
    public long Id { get; set; }
    public SubscriptionFeature Feature { get; set; }
    public bool IsEnabled { get; set; }
    public int? DailyLimit { get; set; }
    public int? MonthlyLimit { get; set; }
    public int? MaximumPerRequest { get; set; }
    public int? SoftLimit { get; set; }
    public int? HardLimit { get; set; }
}
