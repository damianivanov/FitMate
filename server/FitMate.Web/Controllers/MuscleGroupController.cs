using FitMate.DB;
using FitMate.Services.MuscleGroups;
using FitMate.Services.Users;
using FitMate.Web.Controllers.Base;
using FitMate.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FitMate.Web.Controllers;

[Route("api/musclegroups")]
public class MuscleGroupController : BaseApiController
{
    private readonly IMuscleGroupService muscleGroupService;

    public MuscleGroupController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService,
        IMuscleGroupService muscleGroupService)
        : base(logger, dbContext, userService)
    {
        this.muscleGroupService = muscleGroupService;
    }

    [AllowAnonymous]
    [HttpGet("lookup")]
    public async Task<ActionResult> GetLookup()
    {
        var items = await muscleGroupService.GetAllForLookupAsync();
        return this.ReturnJson(items);
    }

    [Authorize]
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
}
