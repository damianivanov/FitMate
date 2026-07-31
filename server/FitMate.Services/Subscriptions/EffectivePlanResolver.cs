using FitMate.DB;
using FitMate.DB.Constants;
using FitMate.DB.Enums;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.Subscriptions;

public class EffectivePlanResolver : IEffectivePlanResolver
{
    private readonly AppDbContext dbContext;

    public EffectivePlanResolver(AppDbContext dbContext)
    {
        this.dbContext = dbContext;
    }

    public async Task<IReadOnlyDictionary<long, ResolvedPlan>> ResolveManyAsync(
        IReadOnlyCollection<long> userIds)
    {
        if (userIds.Count == 0)
        {
            return new Dictionary<long, ResolvedPlan>();
        }

        var now = DateTime.UtcNow;

        var overrides = await dbContext.UserPlanOverrides
            .AsNoTracking()
            .Where(x => userIds.Contains(x.UserId)
                && x.IsActive
                && x.StartsAt <= now
                && (x.EndsAt == null || x.EndsAt > now)
                && x.Plan.IsActive)
            .OrderByDescending(x => x.StartsAt)
            .ThenByDescending(x => x.Id)
            .Select(x => new { x.UserId, OverrideId = x.Id, x.Plan.Code, x.Plan.Name })
            .ToListAsync();

        var subscriptions = await dbContext.UserSubscriptions
            .AsNoTracking()
            .Where(x => userIds.Contains(x.UserId)
                && (x.Status == SubscriptionStatus.Active || x.Status == SubscriptionStatus.Trialing)
                && x.Plan.IsActive)
            .OrderByDescending(x => x.DateCreated)
            .ThenByDescending(x => x.Id)
            .Select(x => new { x.UserId, x.Plan.Code, x.Plan.Name })
            .ToListAsync();

        var freePlan = await GetFreePlanAsync();

        var overrideByUser = overrides
            .GroupBy(x => x.UserId)
            .ToDictionary(group => group.Key, group => group.First());

        var subscriptionByUser = subscriptions
            .GroupBy(x => x.UserId)
            .ToDictionary(group => group.Key, group => group.First());

        var result = new Dictionary<long, ResolvedPlan>(userIds.Count);

        foreach (var userId in userIds)
        {
            if (overrideByUser.TryGetValue(userId, out var planOverride))
            {
                result[userId] = new ResolvedPlan(
                    planOverride.Code,
                    planOverride.Name,
                    EntitlementSource.AdminOverride,
                    planOverride.OverrideId);
                continue;
            }

            if (subscriptionByUser.TryGetValue(userId, out var subscription))
            {
                result[userId] = new ResolvedPlan(
                    subscription.Code,
                    subscription.Name,
                    EntitlementSource.Subscription,
                    null);
                continue;
            }

            result[userId] = new ResolvedPlan(
                freePlan.Code,
                freePlan.Name,
                EntitlementSource.FreePlan,
                null);
        }

        return result;
    }

    private async Task<(string Code, string Name)> GetFreePlanAsync()
    {
        var plan = await dbContext.Plans
            .AsNoTracking()
            .Where(x => x.Code == PlanCodes.Free)
            .Select(x => new { x.Code, x.Name })
            .FirstOrDefaultAsync();

        return (plan?.Code ?? PlanCodes.Free, plan?.Name ?? "Free");
    }
}
