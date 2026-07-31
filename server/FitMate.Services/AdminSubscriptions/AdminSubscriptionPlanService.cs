using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.AdminSubscriptions;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.AdminSubscriptions;

public class AdminSubscriptionPlanService : IAdminSubscriptionPlanService
{
    private readonly AppDbContext dbContext;

    public AdminSubscriptionPlanService(AppDbContext dbContext)
    {
        this.dbContext = dbContext;
    }

    public async Task<IReadOnlyList<SubscriptionPlanAdminModel>> ListAsync()
    {
        var plans = await LoadQuery().OrderBy(x => x.SortOrder).ThenBy(x => x.Id).ToListAsync();
        var counts = await GetSubscriberCountsAsync();

        return plans.Select(plan => ToModel(plan, counts.GetValueOrDefault(plan.Id))).ToList();
    }

    public async Task<SubscriptionPlanAdminModel?> GetByIdAsync(long planId)
    {
        var plan = await LoadQuery().FirstOrDefaultAsync(x => x.Id == planId);
        if (plan == null)
        {
            return null;
        }

        var counts = await GetSubscriberCountsAsync();
        return ToModel(plan, counts.GetValueOrDefault(plan.Id));
    }

    public async Task<SubscriptionPlanAdminModel> CreateAsync(SavePlanRequest request)
    {
        var code = NormalizeCode(request.Code);
        if (await dbContext.Plans.AnyAsync(x => x.Code == code))
        {
            throw new FitMateException($"A plan with code '{code}' already exists.");
        }

        Validate(request);

        var plan = new Plan { Code = code };
        Apply(plan, request);
        dbContext.Plans.Add(plan);
        await dbContext.SaveChangesAsync();

        return (await GetByIdAsync(plan.Id))!;
    }

    public async Task<SubscriptionPlanAdminModel> UpdateAsync(long planId, SavePlanRequest request)
    {
        var plan = await LoadQuery(track: true).FirstOrDefaultAsync(x => x.Id == planId)
            ?? throw new FitMateException("Plan not found.");

        var code = NormalizeCode(request.Code);
        if (code != plan.Code && await dbContext.Plans.AnyAsync(x => x.Code == code))
        {
            throw new FitMateException($"A plan with code '{code}' already exists.");
        }

        Validate(request);

        plan.Code = code;
        dbContext.PlanPrices.RemoveRange(plan.Prices);
        dbContext.PlanEntitlements.RemoveRange(plan.Entitlements);
        plan.Prices.Clear();
        plan.Entitlements.Clear();
        await dbContext.SaveChangesAsync();

        Apply(plan, request);
        await dbContext.SaveChangesAsync();

        return (await GetByIdAsync(plan.Id))!;
    }

    public async Task<SubscriptionPlanAdminModel> SetActiveAsync(long planId, bool isActive)
    {
        var plan = await dbContext.Plans.FirstOrDefaultAsync(x => x.Id == planId)
            ?? throw new FitMateException("Plan not found.");

        plan.IsActive = isActive;
        await dbContext.SaveChangesAsync();

        return (await GetByIdAsync(planId))!;
    }

    private IQueryable<Plan> LoadQuery(bool track = false)
    {
        var query = dbContext.Plans
            .Include(x => x.Prices)
            .Include(x => x.Entitlements)
            .AsQueryable();

        return track ? query : query.AsNoTracking();
    }

    private async Task<Dictionary<long, int>> GetSubscriberCountsAsync() =>
        await dbContext.UserSubscriptions
            .AsNoTracking()
            .Where(x => x.Status == SubscriptionStatus.Active)
            .GroupBy(x => x.PlanId)
            .Select(group => new { PlanId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(x => x.PlanId, x => x.Count);

    private static string NormalizeCode(string code) => code.Trim().ToLowerInvariant();

    /// <summary>
    /// A plan that lists the same feature twice has no single answer to "is this allowed?", so it is
    /// rejected before it can produce arbitrary entitlement resolution.
    /// </summary>
    private static void Validate(SavePlanRequest request)
    {
        var duplicateFeatures = request.Entitlements
            .GroupBy(x => x.Feature)
            .Where(group => group.Count() > 1)
            .Select(group => group.Key.ToString())
            .ToList();

        if (duplicateFeatures.Count > 0)
        {
            throw new FitMateException($"Duplicate entitlement(s): {string.Join(", ", duplicateFeatures)}.");
        }

        // Currency casing is normalized on save, so compare it the same way here.
        var duplicatePrices = request.Prices
            .GroupBy(x => new { Currency = x.Currency.Trim().ToUpperInvariant(), x.BillingInterval })
            .Any(group => group.Count(x => x.IsActive) > 1);

        if (duplicatePrices)
        {
            throw new FitMateException("A plan cannot have two active prices for the same currency and interval.");
        }
    }

    private static void Apply(Plan plan, SavePlanRequest request)
    {
        plan.Name = request.Name.Trim();
        plan.Description = request.Description;
        plan.IsActive = request.IsActive;
        plan.IsPublic = request.IsPublic;
        plan.SortOrder = request.SortOrder;

        foreach (var price in request.Prices)
        {
            plan.Prices.Add(new PlanPrice
            {
                Currency = price.Currency.Trim().ToUpperInvariant(),
                Amount = price.Amount,
                BillingInterval = price.BillingInterval,
                StripePriceId = price.StripePriceId.Trim(),
                IsActive = price.IsActive,
            });
        }

        foreach (var entitlement in request.Entitlements)
        {
            plan.Entitlements.Add(new PlanEntitlement
            {
                Feature = entitlement.Feature,
                IsEnabled = entitlement.IsEnabled,
                DailyLimit = entitlement.DailyLimit,
                MonthlyLimit = entitlement.MonthlyLimit,
                MaximumPerRequest = entitlement.MaximumPerRequest,
                SoftLimit = entitlement.SoftLimit,
                HardLimit = entitlement.HardLimit,
            });
        }
    }

    private static SubscriptionPlanAdminModel ToModel(Plan plan, int subscriberCount) => new()
    {
        Id = plan.Id,
        Code = plan.Code,
        Name = plan.Name,
        Description = plan.Description,
        IsActive = plan.IsActive,
        IsPublic = plan.IsPublic,
        SortOrder = plan.SortOrder,
        SubscriberCount = subscriberCount,
        Prices = plan.Prices
            .OrderBy(x => x.BillingInterval)
            .Select(price => new PlanPriceAdminModel
            {
                Id = price.Id,
                Currency = price.Currency,
                Amount = price.Amount,
                BillingInterval = price.BillingInterval,
                StripePriceId = price.StripePriceId,
                IsActive = price.IsActive,
            })
            .ToList(),
        Entitlements = plan.Entitlements
            .OrderBy(x => x.Feature)
            .Select(entitlement => new PlanEntitlementAdminModel
            {
                Id = entitlement.Id,
                Feature = entitlement.Feature,
                IsEnabled = entitlement.IsEnabled,
                DailyLimit = entitlement.DailyLimit,
                MonthlyLimit = entitlement.MonthlyLimit,
                MaximumPerRequest = entitlement.MaximumPerRequest,
                SoftLimit = entitlement.SoftLimit,
                HardLimit = entitlement.HardLimit,
            })
            .ToList(),
    };
}
