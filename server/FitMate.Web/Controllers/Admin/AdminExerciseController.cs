using FitMate.Core.JsonModels.Exercises;
using FitMate.DB;
using FitMate.Services.Exercises;
using FitMate.Services.Users;
using FitMate.Web.Controllers.Base;
using FitMate.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FitMate.Web.Controllers.Admin;

[Authorize(Policy = "Admin")]
[Route("api/admin/exercises")]
public class AdminExerciseController : BaseApiController
{
    private readonly IExerciseService exerciseService;

    public AdminExerciseController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService,
        IExerciseService exerciseService)
        : base(logger, dbContext, userService)
    {
        this.exerciseService = exerciseService;
    }

    [HttpGet]
    public async Task<ActionResult> List([FromQuery] ExerciseQueryRequest request)
    {
        var response = await exerciseService.ListAsync(request);
        return this.ReturnJson(response);
    }
}
