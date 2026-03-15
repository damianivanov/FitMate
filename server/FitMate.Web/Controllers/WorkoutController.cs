using FitMate.Core.JsonModels.Workouts;
using FitMate.DB;
using FitMate.Services.Users;
using FitMate.Services.Workouts;
using FitMate.Web.Controllers.Base;
using FitMate.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FitMate.Web.Controllers;

[Authorize]
[Route("api/workouts")]
public class WorkoutController : BaseApiController
{
    private readonly IWorkoutService workoutService;

    public WorkoutController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService,
        IWorkoutService workoutService)
        : base(logger, dbContext, userService)
    {
        this.workoutService = workoutService;
    }

    [HttpGet("previous-sets")]
    public async Task<ActionResult> GetPreviousSets([FromQuery] PreviousExerciseSetsQueryRequest request)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var response = await workoutService.GetPreviousSetsAsync(
            userId.Value,
            request.ExerciseIds);

        return this.ReturnJson(response);
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CreateWorkoutRequest request)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var result = await workoutService.CreateAsync(request, userId.Value);
        return this.ReturnJson(result);
    }
}
