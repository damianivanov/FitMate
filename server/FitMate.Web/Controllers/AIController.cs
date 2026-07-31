using FitMate.Core.JsonModels.AI;
using FitMate.DB;
using FitMate.DB.Enums;
using FitMate.Services.AI;
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
    private readonly IAIOrchestrator orchestrator;
    private readonly IEntitlementService entitlementService;

    public AIController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService,
        IAIConversationService conversationService,
        IAIOrchestrator orchestrator,
        IEntitlementService entitlementService)
        : base(logger, dbContext, userService)
    {
        this.conversationService = conversationService;
        this.orchestrator = orchestrator;
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

    [HttpPost("conversations/{conversationId:long}/messages")]
    public async Task<ActionResult> SendMessage(long conversationId, [FromBody] SendAIMessageRequest request)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        return this.ReturnJson(await orchestrator.SendAsync(conversationId, request, userId.Value));
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
