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

    [HttpGet]
    public async Task<ActionResult> List()
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var items = await workoutService.ListAsync(userId.Value);
        return this.ReturnJson(items);
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

    [HttpGet("calendar")]
    public async Task<ActionResult> GetCalendar([FromQuery] WorkoutCalendarQueryRequest request)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var days = await workoutService.GetCalendarMonthAsync(userId.Value, request.Year, request.Month);
        return this.ReturnJson(days);
    }

    [HttpGet("{workoutId:long}")]
    public async Task<ActionResult> GetById(long workoutId)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var item = await workoutService.GetByIdAsync(workoutId, userId.Value);
        if (item == null)
        {
            return this.ReturnJsonError("Workout not found.");
        }

        return this.ReturnJson(item);
    }

    [HttpPost("start-from-template/{templateId:long}")]
    public async Task<ActionResult> StartFromTemplate(long templateId)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var result = await workoutService.StartFromTemplateAsync(templateId, userId.Value);
        return this.ReturnJson(result);
    }

    [HttpPost("duplicate/{workoutId:long}")]
    public async Task<ActionResult> Duplicate(long workoutId)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var newWorkoutId = await workoutService.DuplicateAsync(workoutId, userId.Value);
        return this.ReturnJson(newWorkoutId);
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] SaveWorkoutRequest request)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var result = await workoutService.CreateAsync(request, userId.Value);
        return this.ReturnJson(result);
    }

    [HttpPost("draft")]
    public async Task<ActionResult> UpsertDraft([FromBody] SaveWorkoutRequest request)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var result = await workoutService.UpsertDraftAsync(request, userId.Value);
        return this.ReturnJson(result);
    }

    [HttpDelete("{workoutId:long}")]
    public async Task<ActionResult> Delete(long workoutId)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var isDeleted = await workoutService.DeleteAsync(workoutId, userId.Value);
        return this.ReturnJson(isDeleted);
    }
}
