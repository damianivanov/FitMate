using FitMate.Core.JsonModels.WorkoutTemplates;
using FitMate.DB;
using FitMate.Services.Users;
using FitMate.Services.WorkoutTemplates;
using FitMate.Web.Controllers.Base;
using FitMate.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FitMate.Web.Controllers;

[Authorize]
[Route("api/workout-templates")]
public class WorkoutTemplateController : BaseApiController
{
    private readonly IWorkoutTemplateService workoutTemplateService;

    public WorkoutTemplateController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService,
        IWorkoutTemplateService workoutTemplateService)
        : base(logger, dbContext, userService)
    {
        this.workoutTemplateService = workoutTemplateService;
    }

    [HttpGet]
    public async Task<ActionResult> List()
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var items = await workoutTemplateService.ListAsync(userId.Value);
        return this.ReturnJson(items);
    }

    [HttpGet("{templateId:long}")]
    public async Task<ActionResult> GetById(long templateId)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var item = await workoutTemplateService.GetByIdAsync(templateId, userId.Value);
        if (item == null)
        {
            return this.ReturnJsonError("Template not found.");
        }

        return this.ReturnJson(item);
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CreateWorkoutTemplateRequest request)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var created = await workoutTemplateService.CreateAsync(request, userId.Value);
        return this.ReturnJson(created);
    }

    [HttpPost("from-workout/{workoutId:long}")]
    public async Task<ActionResult> CreateFromWorkout(long workoutId, [FromBody] CreateTemplateFromWorkoutRequest request)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var created = await workoutTemplateService.CreateFromWorkoutAsync(workoutId, request, userId.Value);
        return this.ReturnJson(created);
    }

    [HttpPut("{templateId:long}")]
    public async Task<ActionResult> Update(long templateId, [FromBody] CreateWorkoutTemplateRequest request)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var updated = await workoutTemplateService.UpdateAsync(templateId, request, userId.Value);
        return this.ReturnJson(updated);
    }

    [HttpDelete("{templateId:long}")]
    public async Task<ActionResult> Delete(long templateId)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var isDeleted = await workoutTemplateService.DeleteAsync(templateId, userId.Value);
        return this.ReturnJson(isDeleted);
    }
}
