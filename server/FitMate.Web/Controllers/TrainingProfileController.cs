using FitMate.Core.JsonModels.TrainingProfiles;
using FitMate.DB;
using FitMate.Services.TrainingProfiles;
using FitMate.Services.Users;
using FitMate.Web.Controllers.Base;
using FitMate.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FitMate.Web.Controllers;

[Authorize]
[Route("api/training-profile")]
public class TrainingProfileController : BaseApiController
{
    private readonly ITrainingProfileService trainingProfileService;

    public TrainingProfileController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService,
        ITrainingProfileService trainingProfileService)
        : base(logger, dbContext, userService)
    {
        this.trainingProfileService = trainingProfileService;
    }

    [HttpGet]
    public async Task<ActionResult> Get()
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        // Null data is the "not filled in yet" state, not an error.
        var model = await trainingProfileService.GetAsync(userId.Value);
        return this.ReturnJson(model);
    }

    [HttpPut]
    public async Task<ActionResult> Save([FromBody] SaveTrainingProfileRequest request)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var model = await trainingProfileService.SaveAsync(request, userId.Value);
        return this.ReturnJson(model);
    }
}
