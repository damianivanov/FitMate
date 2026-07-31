using FitMate.Core.JsonModels.Subscriptions;
using FitMate.DB.Entities;
using FitMate.DB.Enums;

namespace FitMate.Services.Subscriptions;

public interface IEntitlementService
{
    /// <summary>Throws <see cref="Core.Exceptions.SubscriptionFeatureDisabledException"/> (403) when the plan excludes the feature.</summary>
    Task RequireFeatureAsync(long userId, SubscriptionFeature feature);

    Task<FeatureAvailabilityModel> GetAvailabilityAsync(long userId, SubscriptionFeature feature);

    Task<EffectiveEntitlementsModel> GetAllAsync(long userId);

    /// <summary>The entitlement row that applies to this user, or null when the plan has no row for it.</summary>
    Task<PlanEntitlement?> GetEntitlementAsync(long userId, SubscriptionFeature feature);

    /// <summary>Drops the cached plan resolution (billing webhooks, admin plan edits).</summary>
    void Invalidate(long userId);
}
