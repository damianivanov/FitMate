using FitMate.Core.JsonModels.Exercises;
using FitMate.DB;
using FitMate.Services.Exercises;
using FitMate.Services.Users;
using FitMate.Web.Controllers.Base;
using FitMate.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FitMate.Web.Controllers;

[Authorize]
[Route("api/exercises")]
public class ExerciseController : BaseApiController
{
    private readonly IExerciseService exerciseService;

    public ExerciseController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService,
        IExerciseService exerciseService)
        : base(logger, dbContext, userService)
    {
        this.exerciseService = exerciseService;
    }

    [HttpGet("lookup")]
    public async Task<ActionResult> Lookup([FromQuery] ExerciseLookupRequest request)
    {
        var items = await exerciseService.LookupAsync(request);
        return this.ReturnJson(items);
    }

    [HttpPost("global")]
    public async Task<ActionResult> CreateGlobal([FromBody] CreateExerciseRequest request)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var result = await exerciseService.CreateCommunityGlobalAsync(
            request,
            userId.Value);

        return this.ReturnJson(result);
    }
}
