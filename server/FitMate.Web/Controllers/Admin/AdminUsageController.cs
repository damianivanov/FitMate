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
[Route("api/admin/usage")]
public class AdminUsageController : BaseApiController
{
    private readonly IAdminSubscriptionService subscriptionService;

    public AdminUsageController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService,
        IAdminSubscriptionService subscriptionService)
        : base(logger, dbContext, userService)
    {
        this.subscriptionService = subscriptionService;
    }

    [HttpGet]
    public async Task<ActionResult> List([FromQuery] UsageQueryRequest request)
    {
        var response = await subscriptionService.ListUsageAsync(request);
        return this.ReturnJson(response);
    }

    [HttpPost("{id}/reset")]
    public async Task<ActionResult> Reset(long id)
    {
        var model = await subscriptionService.ResetUsageAsync(id);
        return this.ReturnJson(model);
    }
}
