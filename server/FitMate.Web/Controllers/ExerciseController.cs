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

    [HttpGet("get-all")]
    public async Task<ActionResult> GetAll([FromQuery] ExerciseLookupRequest request)
    {
        var items = await exerciseService.GetAllAsync(request);
        return this.ReturnJson(items);
    }

    [HttpPost("get-by-ids")]
    public async Task<ActionResult> GetByIds([FromBody] long[]? exerciseIds)
    {
        var items = await exerciseService.GetByIdsAsync(exerciseIds ?? Array.Empty<long>());
        return this.ReturnJson(items);
    }
}
