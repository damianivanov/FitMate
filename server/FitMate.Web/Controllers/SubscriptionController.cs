using FitMate.Core.JsonModels.Subscriptions;
using FitMate.DB;
using FitMate.Services.Subscriptions;
using FitMate.Services.Users;
using FitMate.Web.Controllers.Base;
using FitMate.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Web.Controllers;

[Authorize]
[Route("api/subscriptions")]
public class SubscriptionController : BaseApiController
{
    private readonly IEntitlementService entitlementService;

    public SubscriptionController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService,
        IEntitlementService entitlementService)
        : base(logger, dbContext, userService)
    {
        this.entitlementService = entitlementService;
    }

    [HttpGet("me")]
    public async Task<ActionResult> GetMine()
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var entitlements = await entitlementService.GetAllAsync(userId.Value);
        var subscription = await DbContext.UserSubscriptions
            .AsNoTracking()
            .Where(x => x.UserId == userId.Value)
            .OrderByDescending(x => x.DateCreated)
            .FirstOrDefaultAsync();

        return this.ReturnJson(new CurrentSubscriptionModel
        {
            PlanId = entitlements.PlanId,
            PlanCode = entitlements.PlanCode,
            PlanName = entitlements.PlanName,
            Source = entitlements.Source,
            Status = subscription?.Status,
            CurrentPeriodEnd = subscription?.CurrentPeriodEnd,
            CancelAtPeriodEnd = subscription?.CancelAtPeriodEnd ?? false,
            Features = entitlements.Features,
        });
    }

    [HttpGet("plans")]
    public async Task<ActionResult> GetPlans()
    {
        var plans = await DbContext.Plans
            .AsNoTracking()
            .Include(x => x.Prices)
            .Include(x => x.Entitlements)
            .Where(x => x.IsActive && x.IsPublic)
            .OrderBy(x => x.SortOrder)
            .ToListAsync();

        var models = plans
            .Select(plan => new SubscriptionPlanModel
            {
                Id = plan.Id,
                Code = plan.Code,
                Name = plan.Name,
                Description = plan.Description,
                SortOrder = plan.SortOrder,
                Prices = plan.Prices
                    .Where(price => price.IsActive)
                    .OrderBy(price => price.BillingInterval)
                    .Select(price => new SubscriptionPlanPriceModel
                    {
                        Id = price.Id,
                        Currency = price.Currency,
                        Amount = price.Amount,
                        BillingInterval = price.BillingInterval,
                    })
                    .ToList(),
                Features = plan.Entitlements
                    .OrderBy(entitlement => entitlement.Feature)
                    .Select(entitlement => new PlanFeatureModel
                    {
                        Feature = entitlement.Feature,
                        IsEnabled = entitlement.IsEnabled,
                        MonthlyLimit = entitlement.MonthlyLimit,
                        HardLimit = entitlement.HardLimit,
                    })
                    .ToList(),
            })
            .ToList();

        return this.ReturnJson(models);
    }

    [HttpGet("usage")]
    public async Task<ActionResult> GetUsage()
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        return this.ReturnJson(await entitlementService.GetAllAsync(userId.Value));
    }
}
