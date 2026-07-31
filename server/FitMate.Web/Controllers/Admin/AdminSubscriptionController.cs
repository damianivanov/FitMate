using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.AdminSubscriptions;
using FitMate.DB;
using FitMate.Services.AdminSubscriptions;
using FitMate.Services.Users;
using FitMate.Web.Attributes;
using FitMate.Web.Controllers.Base;
using FitMate.Web.Extensions;
using Microsoft.AspNetCore.Mvc;

namespace FitMate.Web.Controllers.Admin;

[AdminGuard]
[Route("api/admin/subscriptions")]
public class AdminSubscriptionController : BaseApiController
{
    private readonly IAdminSubscriptionService subscriptionService;

    public AdminSubscriptionController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService,
        IAdminSubscriptionService subscriptionService)
        : base(logger, dbContext, userService)
    {
        this.subscriptionService = subscriptionService;
    }

    [HttpGet]
    public async Task<ActionResult> List([FromQuery] SubscriptionQueryRequest request)
    {
        var response = await subscriptionService.ListAsync(request);
        return this.ReturnJson(response);
    }

    [HttpGet("{userId}")]
    public async Task<ActionResult> GetByUserId(long userId)
    {
        var model = await subscriptionService.GetByUserIdAsync(userId);
        return this.ReturnJson(model);
    }

    [HttpPost("{userId}/override")]
    public async Task<ActionResult> AssignOverride(long userId, [FromBody] AssignPlanOverrideRequest request)
    {
        var adminUserId = UserService.LoggedInUserId
            ?? throw new FitMateException("Unauthorized.");

        var model = await subscriptionService.AssignOverrideAsync(userId, request, adminUserId);
        return this.ReturnJson(model);
    }

    [HttpDelete("{userId}/override")]
    public async Task<ActionResult> RemoveOverride(long userId)
    {
        var model = await subscriptionService.RemoveOverrideAsync(userId);
        return this.ReturnJson(model);
    }
}
