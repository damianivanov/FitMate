using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.Subscriptions;
using FitMate.DB;
using FitMate.DB.Constants;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using System.Linq.Expressions;

namespace FitMate.Services.Subscriptions;

/// <summary>
/// Resolves what a user is allowed to do. Priority: active administrator override, then an active
/// paid subscription, then the seeded Free plan.
/// </summary>
public class EntitlementService : IEntitlementService
{
    private static readonly TimeSpan CacheDuration = TimeSpan.FromSeconds(60);

    private readonly AppDbContext dbContext;
    private readonly IMemoryCache cache;

    public EntitlementService(AppDbContext dbContext, IMemoryCache cache)
    {
        this.dbContext = dbContext;
        this.cache = cache;
    }

    public void Invalidate(long userId) => cache.Remove(CacheKey(userId));

    public async Task RequireFeatureAsync(long userId, SubscriptionFeature feature)
    {
        var entitlement = await GetEntitlementAsync(userId, feature);
        if (entitlement is not { IsEnabled: true })
        {
            throw new SubscriptionFeatureDisabledException(feature);
        }
    }

    public async Task<PlanEntitlement?> GetEntitlementAsync(long userId, SubscriptionFeature feature)
    {
        var resolved = await ResolvePlanAsync(userId);
        return resolved.Plan.Entitlements.FirstOrDefault(x => x.Feature == feature);
    }

    public async Task<AIModelTier?> GetAIModelTierAsync(long userId)
    {
        var resolved = await ResolvePlanAsync(userId);
        return resolved.Plan.AIModelTier;
    }

    public async Task<FeatureAvailabilityModel> GetAvailabilityAsync(long userId, SubscriptionFeature feature)
    {
        var resolved = await ResolvePlanAsync(userId);
        var period = UsagePeriod.CurrentMonth();

        var bucket = await dbContext.UsageBuckets
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.UserId == userId
                && x.Feature == feature
                && x.PeriodStart == period.Start
                && x.PeriodEnd == period.End);

        return BuildAvailability(resolved.Plan, feature, bucket, period);
    }

    public async Task<EffectiveEntitlementsModel> GetAllAsync(long userId)
    {
        var resolved = await ResolvePlanAsync(userId);
        var period = UsagePeriod.CurrentMonth();

        var buckets = await dbContext.UsageBuckets
            .AsNoTracking()
            .Where(x => x.UserId == userId && x.PeriodStart == period.Start && x.PeriodEnd == period.End)
            .ToListAsync();

        return new EffectiveEntitlementsModel
        {
            PlanId = resolved.Plan.Id,
            PlanCode = resolved.Plan.Code,
            PlanName = resolved.Plan.Name,
            Source = resolved.Source,
            Features = Enum.GetValues<SubscriptionFeature>()
                .Select(feature => BuildAvailability(
                    resolved.Plan,
                    feature,
                    buckets.FirstOrDefault(x => x.Feature == feature),
                    period))
                .ToList(),
        };
    }

    private static FeatureAvailabilityModel BuildAvailability(
        Plan plan,
        SubscriptionFeature feature,
        UsageBucket? bucket,
        UsagePeriod period)
    {
        var entitlement = plan.Entitlements.FirstOrDefault(x => x.Feature == feature);

        return new FeatureAvailabilityModel
        {
            Feature = feature,
            IsEnabled = entitlement is { IsEnabled: true },
            Limit = entitlement is { IsEnabled: true }
                ? entitlement.MonthlyLimit ?? entitlement.HardLimit
                : 0,
            Used = bucket?.Used ?? 0,
            Reserved = bucket?.Reserved ?? 0,
            ResetsAt = period.ResetsAt,
        };
    }

    private async Task<(Plan Plan, EntitlementSource Source)> ResolvePlanAsync(long userId)
    {
        if (cache.TryGetValue(CacheKey(userId), out (Plan Plan, EntitlementSource Source) cached))
        {
            return cached;
        }

        var now = DateTime.UtcNow;

        var overridePlanId = await dbContext.UserPlanOverrides
            .AsNoTracking()
            .Where(x => x.UserId == userId
                && x.IsActive
                && x.StartsAt <= now
                && (x.EndsAt == null || x.EndsAt > now))
            .OrderByDescending(x => x.StartsAt)
            .Select(x => (long?)x.PlanId)
            .FirstOrDefaultAsync();

        long? subscriptionPlanId = null;
        if (overridePlanId == null)
        {
            subscriptionPlanId = await dbContext.UserSubscriptions
                .AsNoTracking()
                .Where(x => x.UserId == userId
                    && (x.Status == SubscriptionStatus.Active || x.Status == SubscriptionStatus.Trialing))
                .OrderByDescending(x => x.DateCreated)
                .Select(x => (long?)x.PlanId)
                .FirstOrDefaultAsync();
        }

        var source = overridePlanId != null
            ? EntitlementSource.AdminOverride
            : subscriptionPlanId != null
                ? EntitlementSource.Subscription
                : EntitlementSource.FreePlan;

        var planId = overridePlanId ?? subscriptionPlanId;
        var plan = planId != null ? await LoadPlanAsync(x => x.Id == planId.Value) : null;

        // A deactivated or missing plan must never grant more than Free.
        if (plan is not { IsActive: true })
        {
            plan = await LoadPlanAsync(x => x.Code == PlanCodes.Free)
                ?? throw new FitMateException("The Free plan is not seeded.");
            source = EntitlementSource.FreePlan;
        }

        var result = (plan, source);
        cache.Set(CacheKey(userId), result, CacheDuration);
        return result;
    }

    private Task<Plan?> LoadPlanAsync(Expression<Func<Plan, bool>> predicate) =>
        dbContext.Plans
            .AsNoTracking()
            .Include(x => x.Entitlements)
            .FirstOrDefaultAsync(predicate);

    private static string CacheKey(long userId) => $"entitlements:{userId}";
}
