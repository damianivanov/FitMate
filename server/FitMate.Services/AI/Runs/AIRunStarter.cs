using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.AI;
using FitMate.Core.Settings;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Integrations.AI.Serialization;
using FitMate.Services.Subscriptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace FitMate.Services.AI.Runs;

public class AIRunStarter : IAIRunStarter
{
    private const int MaximumClientRequestIdLength = 64;

    private readonly AppDbContext dbContext;
    private readonly IAIConversationService conversationService;
    private readonly IAIBudgetResolver budgetResolver;
    private readonly IEntitlementService entitlementService;
    private readonly IUsageService usageService;
    private readonly IAIProgressService progressService;
    private readonly IAIPromptBuilder promptBuilder;
    private readonly AIOptions options;

    public AIRunStarter(
        AppDbContext dbContext,
        IAIConversationService conversationService,
        IAIBudgetResolver budgetResolver,
        IEntitlementService entitlementService,
        IUsageService usageService,
        IAIProgressService progressService,
        IAIPromptBuilder promptBuilder,
        IOptions<AIOptions> options)
    {
        this.dbContext = dbContext;
        this.conversationService = conversationService;
        this.budgetResolver = budgetResolver;
        this.entitlementService = entitlementService;
        this.usageService = usageService;
        this.progressService = progressService;
        this.promptBuilder = promptBuilder;
        this.options = options.Value;
    }

    public async Task<StartAIRunResponse> StartAsync(
        long conversationId,
        SendAIMessageRequest request,
        long userId)
    {
        if (string.IsNullOrWhiteSpace(request.Content))
        {
            throw new FitMateException("The message cannot be empty.");
        }

        if (string.IsNullOrWhiteSpace(request.ClientRequestId)
            || request.ClientRequestId.Length > MaximumClientRequestIdLength)
        {
            throw new FitMateException("The request is missing a valid client request id.");
        }

        // A retry of the same submission must not charge quota or start a second run.
        var existing = await FindExistingAsync(userId, request.ClientRequestId);
        if (existing != null)
        {
            return existing;
        }

        // Plan gate first (403), then quota (429): neither should cost a provider call.
        await entitlementService.RequireFeatureAsync(userId, SubscriptionFeature.AIChat);

        var budget = await budgetResolver.ResolveAsync(userId);

        if (request.Content.Length > budget.MaximumMessageCharacters)
        {
            throw new FitMateException(
                $"That message is too long. Please keep it under {budget.MaximumMessageCharacters:N0} characters.");
        }

        var conversation = await dbContext.AIConversations
            .FirstOrDefaultAsync(x => x.Id == conversationId
                && x.UserId == userId
                && x.Status != AIConversationStatus.Deleted)
            ?? throw new FitMateException("Conversation not found.");

        if (conversation.ActiveRunId is { } alreadyActive)
        {
            throw new AIRunAlreadyActiveException(conversationId, alreadyActive);
        }

        // One transaction: a visible user message with neither a run nor a recoverable reservation
        // is the one state a user cannot get themselves out of.
        await using var transaction = await dbContext.Database.BeginTransactionAsync();

        try
        {
            var reservation = await usageService.ReserveAsync(userId, SubscriptionFeature.AIChat, 1);
            var userMessage = await conversationService.AddUserMessageAsync(conversationId, request.Content, userId);

            var now = DateTime.UtcNow;
            var run = new AIRun
            {
                UserId = userId,
                ConversationId = conversationId,
                UserMessageId = userMessage.Id,
                UsageReservationId = reservation.Id,
                ClientRequestId = request.ClientRequestId,
                Status = AIRunStatus.Queued,
                Provider = options.Provider,
                Model = budget.Model,
                PromptVersion = promptBuilder.SystemPromptVersion,
                ExecutionBudgetJson = AIJsonSerializer.Serialize(budget),
                StartedAt = now,
                QueuedAt = now,
                NextAttemptAt = now,
            };

            dbContext.AIRuns.Add(run);
            await dbContext.SaveChangesAsync();

            // Claim the conversation only if nobody else did between the read above and here.
            var claimed = await dbContext.AIConversations
                .Where(x => x.Id == conversationId && x.ActiveRunId == null)
                .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.ActiveRunId, run.Id));

            if (claimed != 1)
            {
                await transaction.RollbackAsync();
                throw new AIRunAlreadyActiveException(conversationId, 0);
            }

            await conversationService.SetRunOnMessageAsync(userMessage.Id, run.Id);
            await progressService.PublishAsync(run.Id, AIProgressCodes.RunQueued);

            await transaction.CommitAsync();

            return new StartAIRunResponse
            {
                ConversationId = conversationId,
                RunId = run.Id,
                Status = AIRunStatus.Queued,
                UserMessage = userMessage,
            };
        }
        catch (AIRunAlreadyActiveException)
        {
            throw;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    private async Task<StartAIRunResponse?> FindExistingAsync(long userId, string clientRequestId)
    {
        var run = await dbContext.AIRuns
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.UserId == userId && x.ClientRequestId == clientRequestId);

        if (run == null)
        {
            return null;
        }

        var message = await dbContext.AIMessages
            .AsNoTracking()
            .Where(x => x.Id == run.UserMessageId)
            .Select(x => new AIMessageModel
            {
                Id = x.Id,
                Role = x.Role,
                Content = x.Content,
                ToolName = x.ToolName,
                DateCreated = x.DateCreated,
            })
            .FirstOrDefaultAsync();

        return new StartAIRunResponse
        {
            ConversationId = run.ConversationId,
            RunId = run.Id,
            Status = run.Status,
            UserMessage = message ?? new AIMessageModel
            {
                Id = 0,
                Role = AIMessageRole.User,
                Content = string.Empty,
            },
        };
    }
}
