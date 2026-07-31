using System.ComponentModel.DataAnnotations;
using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.AdminSubscriptions;

public class SavePlanRequest
{
    [Required]
    [StringLength(50)]
    public string Code { get; set; } = string.Empty;

    [Required]
    [StringLength(100)]
    public string Name { get; set; } = string.Empty;

    [StringLength(1000)]
    public string? Description { get; set; }

    public bool IsActive { get; set; } = true;
    public bool IsPublic { get; set; } = true;
    public int SortOrder { get; set; }

    public List<PlanPriceRequest> Prices { get; set; } = [];
    public List<PlanEntitlementRequest> Entitlements { get; set; } = [];
}

public class PlanPriceRequest
{
    [Required]
    [StringLength(3)]
    public string Currency { get; set; } = "EUR";

    [Range(0, 100000)]
    public decimal Amount { get; set; }

    public BillingInterval BillingInterval { get; set; }

    [StringLength(200)]
    public string StripePriceId { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;
}

public class PlanEntitlementRequest
{
    public SubscriptionFeature Feature { get; set; }
    public bool IsEnabled { get; set; }
    public int? DailyLimit { get; set; }
    public int? MonthlyLimit { get; set; }
    public int? MaximumPerRequest { get; set; }
    public int? SoftLimit { get; set; }
    public int? HardLimit { get; set; }
}
