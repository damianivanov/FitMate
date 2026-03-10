using FitMate.Core.JsonModels.MuscleGroups;
using FitMate.DB;
using FitMate.Services.Users;
using FitMate.Web.Controllers.Base;
using FitMate.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Web.Controllers;

[Route("api/musclegroups")]
public class MuscleGroupController : BaseApiController
{
    public MuscleGroupController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService)
        : base(logger, dbContext, userService)
    {
    }

    [AllowAnonymous]
    [HttpGet("lookup")]
    public async Task<ActionResult> GetLookup()
    {
        var items = await DbContext.MuscleGroups
            .AsNoTracking()
            .OrderBy(x => x.Name)
            .Select(x => new MuscleGroupModel
            {
                Id = x.Id,
                Name = x.Name,
            })
            .ToListAsync();

        return this.ReturnJson(items);
    }
}
