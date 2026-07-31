using FitMate.DB.Entities.Base;
using FitMate.DB.Enums;

namespace FitMate.DB.Entities;

public class PlanPrice : BaseEntity
{
    public long PlanId { get; set; }
    public string Currency { get; set; } = "EUR";
    public decimal Amount { get; set; }
    public BillingInterval BillingInterval { get; set; }
    public string StripePriceId { get; set; } = string.Empty;
    public bool IsActive { get; set; }

    public Plan Plan { get; set; } = null!;
}
