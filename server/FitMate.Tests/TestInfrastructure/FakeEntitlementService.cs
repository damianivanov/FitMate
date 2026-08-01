using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.Subscriptions;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.Subscriptions;

namespace FitMate.Tests.TestInfrastructure;

/// <summary>
/// Permissive entitlements for tests that are not about subscription limits: every feature is
/// enabled and unlimited unless a test explicitly disables or caps it.
/// </summary>
public sealed class FakeEntitlementService : IEntitlementService
{
    public HashSet<SubscriptionFeature> DisabledFeatures { get; } = [];

    public Dictionary<SubscriptionFeature, int> HardLimits { get; } = [];

    public Dictionary<SubscriptionFeature, int> MonthlyLimits { get; } = [];

    public List<long> InvalidatedUserIds { get; } = [];

    public AIModelTier? ModelTier { get; set; }

    public Task<AIModelTier?> GetAIModelTierAsync(long userId) => Task.FromResult(ModelTier);

    public Task RequireFeatureAsync(long userId, SubscriptionFeature feature) =>
        DisabledFeatures.Contains(feature)
            ? throw new SubscriptionFeatureDisabledException(feature)
            : Task.CompletedTask;

    public Task<PlanEntitlement?> GetEntitlementAsync(long userId, SubscriptionFeature feature) =>
        Task.FromResult<PlanEntitlement?>(new PlanEntitlement
        {
            Feature = feature,
            IsEnabled = !DisabledFeatures.Contains(feature),
            HardLimit = HardLimits.TryGetValue(feature, out var hardLimit) ? hardLimit : null,
            MonthlyLimit = MonthlyLimits.TryGetValue(feature, out var monthlyLimit) ? monthlyLimit : null,
        });

    public Task<FeatureAvailabilityModel> GetAvailabilityAsync(long userId, SubscriptionFeature feature) =>
        Task.FromResult(new FeatureAvailabilityModel
        {
            Feature = feature,
            IsEnabled = !DisabledFeatures.Contains(feature),
            Limit = MonthlyLimits.TryGetValue(feature, out var monthlyLimit) ? monthlyLimit : null,
        });

    public Task<EffectiveEntitlementsModel> GetAllAsync(long userId) =>
        Task.FromResult(new EffectiveEntitlementsModel
        {
            PlanCode = "test",
            PlanName = "Test",
            Source = EntitlementSource.FreePlan,
            Features = Enum.GetValues<SubscriptionFeature>()
                .Select(feature => new FeatureAvailabilityModel
                {
                    Feature = feature,
                    IsEnabled = !DisabledFeatures.Contains(feature),
                })
                .ToList(),
        });

    public void Invalidate(long userId) => InvalidatedUserIds.Add(userId);
}
