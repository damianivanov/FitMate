using FitMate.Core.JsonModels.Analytics;
using FitMate.DB;
using FitMate.Services.Analytics;
using FitMate.Services.Users;
using FitMate.Web.Controllers.Base;
using FitMate.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FitMate.Web.Controllers;

[Authorize]
[Route("api/analytics")]
public class AnalyticsController : BaseApiController
{
    private readonly IAnalyticsService analyticsService;

    public AnalyticsController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService,
        IAnalyticsService analyticsService)
        : base(logger, dbContext, userService)
    {
        this.analyticsService = analyticsService;
    }

    [HttpGet("overview")]
    public async Task<ActionResult> GetOverview([FromQuery] AnalyticsQueryRequest request)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var overview = await analyticsService.GetOverviewAsync(userId.Value, request);
        return this.ReturnJson(overview);
    }

    [HttpGet("exercise-progression")]
    public async Task<ActionResult> GetExerciseProgression(
        [FromQuery] long exerciseId,
        [FromQuery] AnalyticsQueryRequest request)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var progression = await analyticsService.GetExerciseProgressionAsync(userId.Value, exerciseId, request);
        return this.ReturnJson(progression);
    }
}
