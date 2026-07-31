using FitMate.DB.Entities.Base;
using FitMate.DB.Enums;

namespace FitMate.DB.Entities;

public class UserSubscription : BaseEntity
{
    public long UserId { get; set; }
    public long PlanId { get; set; }
    public long? PlanPriceId { get; set; }
    public SubscriptionStatus Status { get; set; }
    public string? ExternalSubscriptionId { get; set; }
    public DateTime? CurrentPeriodStart { get; set; }
    public DateTime? CurrentPeriodEnd { get; set; }
    public bool CancelAtPeriodEnd { get; set; }
    public DateTime? CancelledAt { get; set; }

    public User User { get; set; } = null!;
    public Plan Plan { get; set; } = null!;
    public PlanPrice? PlanPrice { get; set; }
}
