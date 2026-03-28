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
}
