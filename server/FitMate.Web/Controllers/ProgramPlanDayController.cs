using FitMate.Core.JsonModels.ProgramPlans;
using FitMate.DB;
using FitMate.Services.ProgramPlans;
using FitMate.Services.ProgramPlans.Days;
using FitMate.Services.Users;
using FitMate.Web.Controllers.Base;
using FitMate.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FitMate.Web.Controllers;

[Authorize]
[Route("api/program-plan-days")]
public class ProgramPlanDayController : BaseApiController
{
    private readonly IProgramPlanDayService programPlanDayService;

    public ProgramPlanDayController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService,
        IProgramPlanDayService programPlanDayService)
        : base(logger, dbContext, userService)
    {
        this.programPlanDayService = programPlanDayService;
    }

    [HttpPost("{id:long}/start")]
    public async Task<ActionResult> Start(long id)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var workoutId = await programPlanDayService.StartWorkoutAsync(id, userId.Value);
        return this.ReturnJson(workoutId);
    }

    [HttpPost("{id:long}/move")]
    public async Task<ActionResult> Move(long id, [FromBody] MoveProgramDayRequest request)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var moved = await programPlanDayService.MoveAsync(id, request, userId.Value);
        return this.ReturnJson(moved);
    }

    [HttpPost("{id:long}/skip")]
    public async Task<ActionResult> Skip(long id)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var skipped = await programPlanDayService.SkipAsync(id, userId.Value);
        return this.ReturnJson(skipped);
    }

    [HttpPost("{id:long}/restore")]
    public async Task<ActionResult> Restore(long id)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var restored = await programPlanDayService.RestoreAsync(id, userId.Value);
        return this.ReturnJson(restored);
    }
}
