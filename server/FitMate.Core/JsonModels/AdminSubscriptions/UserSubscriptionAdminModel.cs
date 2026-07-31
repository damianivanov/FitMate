using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.AdminSubscriptions;

/// <summary>What a user is actually entitled to, and why.</summary>
public class UserSubscriptionAdminModel
{
    public long UserId { get; set; }
    public string? Email { get; set; }
    public string? FullName { get; set; }

    public string EffectivePlanCode { get; set; } = string.Empty;
    public string EffectivePlanName { get; set; } = string.Empty;
    public EntitlementSource Source { get; set; }

    public long? SubscriptionId { get; set; }
    public SubscriptionStatus? SubscriptionStatus { get; set; }
    public DateTime? CurrentPeriodEnd { get; set; }
    public bool CancelAtPeriodEnd { get; set; }

    public PlanOverrideAdminModel? ActiveOverride { get; set; }
}

public class PlanOverrideAdminModel
{
    public long Id { get; set; }
    public string PlanCode { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public long CreatedByUserId { get; set; }
    public DateTime StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }
}
