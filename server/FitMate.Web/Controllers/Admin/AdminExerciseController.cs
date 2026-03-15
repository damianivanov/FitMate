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

    [HttpGet("{id}")]
    public async Task<ActionResult> GetById(long id)
    {
        var item = await exerciseService.GetByIdAsync(id);
        if (item == null)
        {
            return this.ReturnJsonError("Exercise not found.");
        }

        return this.ReturnJson(item);
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CreateExerciseRequest request)
    {
        var created = await exerciseService.CreateManagedGlobalAsync(
            request,
            UserService.LoggedInUserId);

        return this.ReturnJson(created);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> Update(long id, [FromBody] CreateExerciseRequest request)
    {
        var updated = await exerciseService.UpdateAsync(
            id,
            request,
            UserService.LoggedInUserId);

        return this.ReturnJson(updated);
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(long id)
    {
        var isDeleted = await exerciseService.DeleteAsync(
            id,
            UserService.LoggedInUserId);

        return this.ReturnJson(isDeleted);
    }
}
