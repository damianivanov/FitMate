using FitMate.Core.JsonModels.AIActions;
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
    private readonly IAIProposalDetailService detailService;

    public AIActionController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService,
        IAIActionService actionService,
        IAIProposalDetailService detailService)
        : base(logger, dbContext, userService)
    {
        this.actionService = actionService;
        this.detailService = detailService;
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

    /// <summary>
    /// The proposal resolved for review: every exercise with its image and every prescribed set.
    /// </summary>
    [HttpGet("{actionId:long}/detail")]
    public async Task<ActionResult> GetDetail(long actionId, CancellationToken cancellationToken)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var detail = await detailService.GetAsync(actionId, userId.Value, cancellationToken);

        return detail == null
            ? this.ReturnJsonError("Suggestion not found.")
            : this.ReturnJson(detail);
    }

    /// <summary>
    /// Confirms a workout suggestion against a session that is already running. The response carries
    /// the resolved exercises; the client appends them to the live draft.
    /// </summary>
    [HttpPost("{actionId:long}/merge")]
    public async Task<ActionResult> Merge(long actionId, [FromBody] MergeAIActionRequest request)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        return this.ReturnJson(
            await actionService.MergeIntoWorkoutAsync(actionId, userId.Value, request.WorkoutId));
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
