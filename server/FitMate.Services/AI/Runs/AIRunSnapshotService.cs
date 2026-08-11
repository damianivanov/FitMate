using FitMate.Core.JsonModels.AI;
using FitMate.DB;
using FitMate.DB.Enums;
using FitMate.Services.AIActions;
using FitMate.Services.Subscriptions;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.AI.Runs;

public class AIRunSnapshotService : IAIRunSnapshotService
{
    private readonly AppDbContext dbContext;
    private readonly IAIProgressService progressService;
    private readonly IAIActionService actionService;
    private readonly IEntitlementService entitlementService;

    public AIRunSnapshotService(
        AppDbContext dbContext,
        IAIProgressService progressService,
        IAIActionService actionService,
        IEntitlementService entitlementService)
    {
        this.dbContext = dbContext;
        this.progressService = progressService;
        this.actionService = actionService;
        this.entitlementService = entitlementService;
    }

    public async Task<AIRunSnapshotModel?> GetAsync(long runId, long userId, long afterEventId = 0)
    {
        // Ownership is part of the lookup, so another user's run is indistinguishable from a missing one.
        var run = await dbContext.AIRuns
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == runId && x.UserId == userId);

        if (run == null)
        {
            return null;
        }

        var events = await progressService.GetEventsAsync(runId, afterEventId);

        var latest = await dbContext.AIProgressEvents
            .AsNoTracking()
            .Where(x => x.AIRunId == runId)
            .OrderByDescending(x => x.Id)
            .Select(x => new { x.Id, x.Code })
            .FirstOrDefaultAsync();

        AIMessageModel? assistantMessage = null;
        if (run.AssistantMessageId is { } assistantMessageId)
        {
            assistantMessage = await dbContext.AIMessages
                .AsNoTracking()
                .Where(x => x.Id == assistantMessageId)
                .Select(x => new AIMessageModel
                {
                    Id = x.Id,
                    Role = x.Role,
                    Content = x.Content,
                    ToolName = x.ToolName,
                    DateCreated = x.DateCreated,
                })
                .FirstOrDefaultAsync();
        }

        var actions = await actionService.ListForConversationAsync(run.ConversationId, userId);
        var availability = await entitlementService.GetAvailabilityAsync(userId, SubscriptionFeature.AIChat);

        return new AIRunSnapshotModel
        {
            Id = run.Id,
            ConversationId = run.ConversationId,
            Status = run.Status,
            CurrentProgressCode = latest?.Code ?? AIProgressCodes.RunQueued,
            LastEventId = latest?.Id ?? 0,
            Events = [.. events],
            AssistantMessage = assistantMessage,
            Actions = [.. actions],
            Usage = new AIUsageSummaryModel
            {
                Feature = nameof(SubscriptionFeature.AIChat),
                Used = availability.Used,
                Limit = availability.Limit,
                Remaining = availability.Remaining,
            },
            PublicErrorCode = run.Status is AIRunStatus.Failed or AIRunStatus.LimitExceeded
                ? AIPublicErrorCodes.Resolve(run.ErrorCode)
                : null,
        };
    }
}
