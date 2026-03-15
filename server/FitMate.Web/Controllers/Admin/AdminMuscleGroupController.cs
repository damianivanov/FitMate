using FitMate.Core.JsonModels.MuscleGroups;
using FitMate.DB;
using FitMate.Services.MuscleGroups;
using FitMate.Services.Users;
using FitMate.Web.Controllers.Base;
using FitMate.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FitMate.Web.Controllers.Admin;

[Route("api/admin/musclegroups")]
[Authorize(Policy = "Admin")]
public class AdminMuscleGroupController : BaseApiController
{
    private readonly IMuscleGroupService muscleGroupService;

    public AdminMuscleGroupController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService,
        IMuscleGroupService muscleGroupService)
        : base(logger, dbContext, userService)
    {
        this.muscleGroupService = muscleGroupService;
    }

    [HttpGet]
    public async Task<ActionResult> List([FromQuery] MuscleGroupQueryRequest request)
    {
        var response = await muscleGroupService.ListAsync(request);
        return this.ReturnJson(response);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult> GetById(long id)
    {
        var item = await muscleGroupService.GetByIdAsync(id);
        if (item == null)
        {
            return this.ReturnJsonError("Muscle group not found.");
        }

        return this.ReturnJson(item);
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CreateMuscleGroupRequest request)
    {
        var created = await muscleGroupService.CreateAsync(
            request,
            UserService.LoggedInUserId);

        return this.ReturnJson(created);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> Update(long id, [FromBody] CreateMuscleGroupRequest request)
    {
        var updated = await muscleGroupService.UpdateAsync(
            id,
            request,
            UserService.LoggedInUserId);

        return this.ReturnJson(updated);
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(long id)
    {
        var isDeleted = await muscleGroupService.DeleteAsync(
            id,
            UserService.LoggedInUserId);

        return this.ReturnJson(isDeleted);
    }
}
