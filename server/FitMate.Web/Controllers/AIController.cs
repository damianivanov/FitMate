using FitMate.Core.JsonModels.AI;
using FitMate.DB;
using FitMate.DB.Enums;
using FitMate.Services.AI;
using FitMate.Services.AI.Runs;
using FitMate.Services.Subscriptions;
using FitMate.Services.Users;
using FitMate.Web.Controllers.Base;
using FitMate.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FitMate.Web.Controllers;

[Authorize]
[Route("api/ai")]
public class AIController : BaseApiController
{
    private readonly IAIConversationService conversationService;
    private readonly IAIRunStarter runStarter;
    private readonly IEntitlementService entitlementService;

    public AIController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService,
        IAIConversationService conversationService,
        IAIRunStarter runStarter,
        IEntitlementService entitlementService)
        : base(logger, dbContext, userService)
    {
        this.conversationService = conversationService;
        this.runStarter = runStarter;
        this.entitlementService = entitlementService;
    }

    [HttpGet("conversations")]
    public async Task<ActionResult> ListConversations()
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        return this.ReturnJson(await conversationService.ListAsync(userId.Value));
    }

    [HttpPost("conversations")]
    public async Task<ActionResult> CreateConversation([FromBody] CreateAIConversationRequest request)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        return this.ReturnJson(await conversationService.CreateAsync(request, userId.Value));
    }

    [HttpGet("conversations/{conversationId:long}")]
    public async Task<ActionResult> GetConversation(long conversationId)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var conversation = await conversationService.GetByIdAsync(conversationId, userId.Value);

        return conversation == null
            ? this.ReturnJsonError("Conversation not found.")
            : this.ReturnJson(conversation);
    }

    [HttpDelete("conversations/{conversationId:long}")]
    public async Task<ActionResult> DeleteConversation(long conversationId)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        return this.ReturnJson(await conversationService.DeleteAsync(conversationId, userId.Value));
    }

    /// <summary>
    /// Accepts the message and returns immediately. The run is executed by the worker, so the
    /// answer is read back from the run snapshot rather than from this response.
    /// </summary>
    [HttpPost("conversations/{conversationId:long}/messages")]
    public async Task<ActionResult> SendMessage(long conversationId, [FromBody] SendAIMessageRequest request)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        try
        {
            var started = await runStarter.StartAsync(conversationId, request, userId.Value);
            Response.StatusCode = StatusCodes.Status202Accepted;

            return this.ReturnJson(started);
        }
        catch (AIRunAlreadyActiveException)
        {
            Response.StatusCode = StatusCodes.Status409Conflict;

            return this.ReturnJsonError("This conversation is still working on the previous message.");
        }
    }

    [HttpGet("usage")]
    public async Task<ActionResult> GetUsage()
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var availability = await entitlementService.GetAvailabilityAsync(userId.Value, SubscriptionFeature.AIChat);

        return this.ReturnJson(new AIUsageSummaryModel
        {
            Feature = nameof(SubscriptionFeature.AIChat),
            Used = availability.Used,
            Limit = availability.Limit,
            Remaining = availability.Remaining,
        });
    }
}
