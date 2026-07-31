using FitMate.Core.JsonModels.Exercises;
using FitMate.DB;
using FitMate.Services.Exercises;
using FitMate.Services.Users;
using FitMate.Web.Attributes;
using FitMate.Web.Controllers.Base;
using FitMate.Web.Extensions;
using Microsoft.AspNetCore.Mvc;

namespace FitMate.Web.Controllers.Admin;

[AdminGuard]
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

    /// <summary>
    /// Creates an exercise on behalf of the catalogue. The admin UI decides the scope explicitly:
    /// an exercise left unmarked as private becomes global (visible to everyone), while a private
    /// one stays personal to the administrator.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CreateAdminExerciseRequest request)
    {
        var created = request.IsPrivate
            ? await exerciseService.CreatePersonalAsync(request.ToExerciseRequest(isPublic: false))
            : await exerciseService.CreateGlobalAsync(request.ToExerciseRequest(isPublic: true));

        return this.ReturnJson(created);
    }
}
