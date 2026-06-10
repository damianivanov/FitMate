using FitMate.Core.JsonModels.BodyMetrics;
using FitMate.DB;
using FitMate.Services.BodyMetrics;
using FitMate.Services.Users;
using FitMate.Web.Controllers.Base;
using FitMate.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FitMate.Web.Controllers;

[Authorize]
[Route("api/body-metrics")]
public class BodyMetricController : BaseApiController
{
    private readonly IBodyMetricService bodyMetricService;

    public BodyMetricController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService,
        IBodyMetricService bodyMetricService)
        : base(logger, dbContext, userService)
    {
        this.bodyMetricService = bodyMetricService;
    }

    [HttpGet]
    public async Task<ActionResult> List()
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var items = await bodyMetricService.ListAsync(userId.Value);
        return this.ReturnJson(items);
    }

    [HttpPost]
    public async Task<ActionResult> Log([FromBody] LogBodyMetricRequest request)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var entry = await bodyMetricService.LogAsync(request, userId.Value);
        return this.ReturnJson(entry);
    }

    [HttpDelete("{id:long}")]
    public async Task<ActionResult> Delete(long id)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var isDeleted = await bodyMetricService.DeleteAsync(id, userId.Value);
        return this.ReturnJson(isDeleted);
    }
}
