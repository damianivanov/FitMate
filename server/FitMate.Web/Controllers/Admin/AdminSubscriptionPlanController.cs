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
[Route("api/admin/subscription-plans")]
public class AdminSubscriptionPlanController : BaseApiController
{
    private readonly IAdminSubscriptionPlanService planService;

    public AdminSubscriptionPlanController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService,
        IAdminSubscriptionPlanService planService)
        : base(logger, dbContext, userService)
    {
        this.planService = planService;
    }

    [HttpGet]
    public async Task<ActionResult> List()
    {
        var plans = await planService.ListAsync();
        return this.ReturnJson(plans);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult> GetById(long id)
    {
        var plan = await planService.GetByIdAsync(id);
        return this.ReturnJson(plan);
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] SavePlanRequest request)
    {
        var plan = await planService.CreateAsync(request);
        return this.ReturnJson(plan);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> Update(long id, [FromBody] SavePlanRequest request)
    {
        var plan = await planService.UpdateAsync(id, request);
        return this.ReturnJson(plan);
    }

    [HttpPost("{id}/active")]
    public async Task<ActionResult> SetActive(long id, [FromQuery] bool isActive)
    {
        var plan = await planService.SetActiveAsync(id, isActive);
        return this.ReturnJson(plan);
    }
}
