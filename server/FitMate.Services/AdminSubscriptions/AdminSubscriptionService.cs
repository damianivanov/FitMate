using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.AdminSubscriptions;
using FitMate.Core.JsonModels.Common;
using FitMate.DB;
using FitMate.DB.Constants;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.Subscriptions;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.AdminSubscriptions;

/// <summary>
/// Reads and edits what users are entitled to. Resolution mirrors <see cref="EntitlementService"/>:
/// an active administrator override wins, then an active subscription, then the Free plan.
/// </summary>
public class AdminSubscriptionService : IAdminSubscriptionService
{
    private readonly AppDbContext dbContext;
    private readonly IEntitlementService entitlementService;

    public AdminSubscriptionService(AppDbContext dbContext, IEntitlementService entitlementService)
    {
        this.dbContext = dbContext;
        this.entitlementService = entitlementService;
    }

    public async Task<PagedResponse<UserSubscriptionAdminModel>> ListAsync(SubscriptionQueryRequest request)
    {
        var page = request.Page <= 0 ? 1 : request.Page;
        var pageSize = request.PageSize <= 0 ? 20 : Math.Min(request.PageSize, 100);
        var search = request.Search?.Trim();
        var now = DateTime.UtcNow;

        var query = dbContext.Users.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(x =>
                x.Email!.Contains(search)
                || (x.FirstName != null && x.FirstName.Contains(search))
                || (x.LastName != null && x.LastName.Contains(search)));
        }

        if (request.OverriddenOnly)
        {
            query = query.Where(x => dbContext.UserPlanOverrides.Any(o =>
                o.UserId == x.Id && o.IsActive && o.StartsAt <= now && (o.EndsAt == null || o.EndsAt > now)));
        }

        if (request.Status is { } status)
        {
            query = query.Where(x => dbContext.UserSubscriptions.Any(s => s.UserId == x.Id && s.Status == status));
        }

        if (!string.IsNullOrWhiteSpace(request.PlanCode))
        {
            var planCode = request.PlanCode.Trim().ToLowerInvariant();

            // Free is what a user resolves to when nothing else applies, so it needs the inverse filter.
            query = planCode == PlanCodes.Free
                ? query.Where(x =>
                    !dbContext.UserPlanOverrides.Any(o => o.UserId == x.Id && o.IsActive
                        && o.StartsAt <= now && (o.EndsAt == null || o.EndsAt > now))
                    && !dbContext.UserSubscriptions.Any(s => s.UserId == x.Id
                        && s.Status == SubscriptionStatus.Active))
                : query.Where(x =>
                    dbContext.UserPlanOverrides.Any(o => o.UserId == x.Id && o.IsActive
                        && o.StartsAt <= now && (o.EndsAt == null || o.EndsAt > now)
                        && o.Plan.Code == planCode)
                    || dbContext.UserSubscriptions.Any(s => s.UserId == x.Id
                        && s.Status == SubscriptionStatus.Active && s.Plan.Code == planCode));
        }

        var totalCount = await query.CountAsync();
        var users = await query
            .OrderBy(x => x.Email)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new { x.Id, x.Email, x.FirstName, x.LastName })
            .ToListAsync();

        var userIds = users.Select(x => x.Id).ToList();

        var subscriptions = await dbContext.UserSubscriptions
            .AsNoTracking()
            .Where(x => userIds.Contains(x.UserId))
            .OrderByDescending(x => x.Status == SubscriptionStatus.Active)
            .ThenByDescending(x => x.Id)
            .Select(x => new SubscriptionRow(
                x.UserId,
                x.Id,
                x.Status,
                x.Plan.Code,
                x.Plan.Name,
                x.CurrentPeriodEnd,
                x.CancelAtPeriodEnd))
            .ToListAsync();

        var overrides = await LoadActiveOverridesAsync(userIds, now);
        var freePlan = await GetFreePlanAsync();

        return new PagedResponse<UserSubscriptionAdminModel>
        {
            Items = users
                .Select(user => Resolve(
                    user.Id,
                    user.Email,
                    $"{user.FirstName} {user.LastName}".Trim(),
                    subscriptions.FirstOrDefault(x => x.UserId == user.Id),
                    overrides.GetValueOrDefault(user.Id),
                    freePlan))
                .ToList(),
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
        };
    }

    public async Task<UserSubscriptionAdminModel?> GetByUserIdAsync(long userId)
    {
        var user = await dbContext.Users
            .AsNoTracking()
            .Where(x => x.Id == userId)
            .Select(x => new { x.Id, x.Email, x.FirstName, x.LastName })
            .FirstOrDefaultAsync();

        if (user == null)
        {
            return null;
        }

        var now = DateTime.UtcNow;
        var subscription = await dbContext.UserSubscriptions
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.Status == SubscriptionStatus.Active)
            .ThenByDescending(x => x.Id)
            .Select(x => new SubscriptionRow(
                x.UserId,
                x.Id,
                x.Status,
                x.Plan.Code,
                x.Plan.Name,
                x.CurrentPeriodEnd,
                x.CancelAtPeriodEnd))
            .FirstOrDefaultAsync();

        var overrides = await LoadActiveOverridesAsync([userId], now);

        return Resolve(
            user.Id,
            user.Email,
            $"{user.FirstName} {user.LastName}".Trim(),
            subscription,
            overrides.GetValueOrDefault(userId),
            await GetFreePlanAsync());
    }

    public async Task<UserSubscriptionAdminModel> AssignOverrideAsync(
        long userId,
        AssignPlanOverrideRequest request,
        long adminUserId)
    {
        if (!await dbContext.Users.AnyAsync(x => x.Id == userId))
        {
            throw new FitMateException("User not found.");
        }

        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            throw new FitMateException("A reason is required for a plan override.");
        }

        var planCode = request.PlanCode.Trim().ToLowerInvariant();
        var plan = await dbContext.Plans.FirstOrDefaultAsync(x => x.Code == planCode)
            ?? throw new FitMateException($"Plan '{planCode}' does not exist.");

        var now = DateTime.UtcNow;
        if (request.EndsAt is { } endsAt && endsAt <= now)
        {
            throw new FitMateException("The override end date must be in the future.");
        }

        // What the user had before, so the audit row explains the change on its own.
        var current = await GetByUserIdAsync(userId);

        var existing = await dbContext.UserPlanOverrides
            .Where(x => x.UserId == userId && x.IsActive)
            .ToListAsync();

        foreach (var previous in existing)
        {
            previous.IsActive = false;
            previous.EndsAt ??= now;
        }

        dbContext.UserPlanOverrides.Add(new UserPlanOverride
        {
            UserId = userId,
            PlanId = plan.Id,
            CreatedByUserId = adminUserId,
            Reason = request.Reason.Trim(),
            PreviousPlanCode = current?.EffectivePlanCode,
            StartsAt = now,
            EndsAt = request.EndsAt,
            IsActive = true,
        });

        await dbContext.SaveChangesAsync();
        entitlementService.Invalidate(userId);

        return (await GetByUserIdAsync(userId))!;
    }

    public async Task<UserSubscriptionAdminModel> RemoveOverrideAsync(long userId)
    {
        var overrides = await dbContext.UserPlanOverrides
            .Where(x => x.UserId == userId && x.IsActive)
            .ToListAsync();

        if (overrides.Count == 0)
        {
            throw new FitMateException("This user has no active plan override.");
        }

        var now = DateTime.UtcNow;
        foreach (var planOverride in overrides)
        {
            planOverride.IsActive = false;
            planOverride.EndsAt ??= now;
        }

        await dbContext.SaveChangesAsync();
        entitlementService.Invalidate(userId);

        return (await GetByUserIdAsync(userId))!;
    }

    public async Task<PagedResponse<UserUsageAdminModel>> ListUsageAsync(UsageQueryRequest request)
    {
        var page = request.Page <= 0 ? 1 : request.Page;
        var pageSize = request.PageSize <= 0 ? 20 : Math.Min(request.PageSize, 100);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var periodStart = request.PeriodStart ?? new DateOnly(today.Year, today.Month, 1);
        var search = request.Search?.Trim();

        var query = dbContext.UsageBuckets
            .AsNoTracking()
            .Where(x => x.PeriodStart == periodStart);

        if (request.UserId is { } userId)
        {
            query = query.Where(x => x.UserId == userId);
        }

        if (request.Feature is { } feature)
        {
            query = query.Where(x => x.Feature == feature);
        }

        if (request.AtLimitOnly)
        {
            query = query.Where(x => x.EffectiveLimit != null && x.Used >= x.EffectiveLimit);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(x => x.User.Email!.Contains(search));
        }

        var totalCount = await query.CountAsync();
        var items = await query
            .OrderByDescending(x => x.Used)
            .ThenBy(x => x.UserId)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new UserUsageAdminModel
            {
                Id = x.Id,
                UserId = x.UserId,
                Email = x.User.Email,
                Feature = x.Feature,
                PeriodStart = x.PeriodStart,
                PeriodEnd = x.PeriodEnd,
                Used = x.Used,
                Reserved = x.Reserved,
                EffectiveLimit = x.EffectiveLimit,
            })
            .ToListAsync();

        return new PagedResponse<UserUsageAdminModel>
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
        };
    }

    public async Task<UserUsageAdminModel> ResetUsageAsync(long usageBucketId)
    {
        var bucket = await dbContext.UsageBuckets.FirstOrDefaultAsync(x => x.Id == usageBucketId)
            ?? throw new FitMateException("Usage bucket not found.");

        bucket.Used = 0;
        bucket.Reserved = 0;
        bucket.Version++;
        await dbContext.SaveChangesAsync();

        var email = await dbContext.Users
            .AsNoTracking()
            .Where(x => x.Id == bucket.UserId)
            .Select(x => x.Email)
            .FirstOrDefaultAsync();

        return new UserUsageAdminModel
        {
            Id = bucket.Id,
            UserId = bucket.UserId,
            Email = email,
            Feature = bucket.Feature,
            PeriodStart = bucket.PeriodStart,
            PeriodEnd = bucket.PeriodEnd,
            Used = bucket.Used,
            Reserved = bucket.Reserved,
            EffectiveLimit = bucket.EffectiveLimit,
        };
    }

    private async Task<Dictionary<long, OverrideRow>> LoadActiveOverridesAsync(
        IReadOnlyCollection<long> userIds,
        DateTime now) =>
        await dbContext.UserPlanOverrides
            .AsNoTracking()
            .Where(x => userIds.Contains(x.UserId)
                && x.IsActive
                && x.StartsAt <= now
                && (x.EndsAt == null || x.EndsAt > now))
            .OrderByDescending(x => x.Id)
            .Select(x => new OverrideRow(
                x.UserId,
                x.Id,
                x.Plan.Code,
                x.Plan.Name,
                x.Reason,
                x.CreatedByUserId,
                x.StartsAt,
                x.EndsAt))
            .ToDictionaryAsync(x => x.UserId, x => x);

    private async Task<(string Code, string Name)> GetFreePlanAsync()
    {
        var plan = await dbContext.Plans
            .AsNoTracking()
            .Where(x => x.Code == PlanCodes.Free)
            .Select(x => new { x.Code, x.Name })
            .FirstOrDefaultAsync();

        return (plan?.Code ?? PlanCodes.Free, plan?.Name ?? "Free");
    }

    private static UserSubscriptionAdminModel Resolve(
        long userId,
        string? email,
        string fullName,
        SubscriptionRow? subscription,
        OverrideRow? planOverride,
        (string Code, string Name) freePlan)
    {
        var activeSubscription = subscription is { Status: SubscriptionStatus.Active } ? subscription : null;

        var model = new UserSubscriptionAdminModel
        {
            UserId = userId,
            Email = email,
            FullName = fullName,
            SubscriptionId = subscription?.SubscriptionId,
            SubscriptionStatus = subscription?.Status,
            CurrentPeriodEnd = subscription?.CurrentPeriodEnd,
            CancelAtPeriodEnd = subscription?.CancelAtPeriodEnd ?? false,
        };

        if (planOverride != null)
        {
            model.EffectivePlanCode = planOverride.PlanCode;
            model.EffectivePlanName = planOverride.PlanName;
            model.Source = EntitlementSource.AdminOverride;
            model.ActiveOverride = new PlanOverrideAdminModel
            {
                Id = planOverride.Id,
                PlanCode = planOverride.PlanCode,
                Reason = planOverride.Reason,
                CreatedByUserId = planOverride.CreatedByUserId,
                StartsAt = planOverride.StartsAt,
                EndsAt = planOverride.EndsAt,
            };

            return model;
        }

        if (activeSubscription != null)
        {
            model.EffectivePlanCode = activeSubscription.PlanCode;
            model.EffectivePlanName = activeSubscription.PlanName;
            model.Source = EntitlementSource.Subscription;
            return model;
        }

        model.EffectivePlanCode = freePlan.Code;
        model.EffectivePlanName = freePlan.Name;
        model.Source = EntitlementSource.FreePlan;
        return model;
    }

    private sealed record SubscriptionRow(
        long UserId,
        long SubscriptionId,
        SubscriptionStatus Status,
        string PlanCode,
        string PlanName,
        DateTime? CurrentPeriodEnd,
        bool CancelAtPeriodEnd);

    private sealed record OverrideRow(
        long UserId,
        long Id,
        string PlanCode,
        string PlanName,
        string Reason,
        long CreatedByUserId,
        DateTime StartsAt,
        DateTime? EndsAt);
}
