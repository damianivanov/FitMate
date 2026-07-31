using FitMate.DB;
using FitMate.Services.AIActions;
using FitMate.Services.Users;
using FitMate.Web.Controllers.Base;
using FitMate.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FitMate.Web.Controllers;

[Authorize]
[Route("api/ai/actions")]
public class AIActionController : BaseApiController
{
    private readonly IAIActionService actionService;

    public AIActionController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService,
        IAIActionService actionService)
        : base(logger, dbContext, userService)
    {
        this.actionService = actionService;
    }

    [HttpGet("{actionId:long}")]
    public async Task<ActionResult> GetById(long actionId)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var action = await actionService.GetByIdAsync(actionId, userId.Value);

        return action == null
            ? this.ReturnJsonError("Suggestion not found.")
            : this.ReturnJson(action);
    }

    /// <summary>
    /// Applies the proposal. Idempotent: confirming twice returns the first result rather than
    /// creating a second copy.
    /// </summary>
    [HttpPost("{actionId:long}/confirm")]
    public async Task<ActionResult> Confirm(long actionId)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        return this.ReturnJson(await actionService.ConfirmAsync(actionId, userId.Value));
    }

    [HttpPost("{actionId:long}/reject")]
    public async Task<ActionResult> Reject(long actionId)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        return this.ReturnJson(await actionService.RejectAsync(actionId, userId.Value));
    }
}
