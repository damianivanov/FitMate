using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.AIActions;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Integrations.AI.Serialization;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.AIActions;

public class AIActionService : IAIActionService
{
    /// <summary>How long a proposal stays confirmable before the user has to ask again.</summary>
    public static readonly TimeSpan ConfirmationWindow = TimeSpan.FromHours(24);

    private readonly AppDbContext dbContext;
    private readonly IReadOnlyDictionary<AIActionType, IAIActionExecutor> executors;

    public AIActionService(AppDbContext dbContext, IEnumerable<IAIActionExecutor> executors)
    {
        this.dbContext = dbContext;
        this.executors = executors.ToDictionary(executor => executor.ActionType);
    }

    public async Task<AIActionModel> CreatePendingAsync(CreateAIActionRequest request, long userId)
    {
        var action = new AIAction
        {
            UserId = userId,
            ConversationId = request.ConversationId,
            AIRunId = request.AIRunId,
            ActionType = request.ActionType,
            Status = AIActionStatus.PendingConfirmation,
            PayloadJson = request.PayloadJson,
            ValidationSummaryJson = AIJsonSerializer.Serialize(request.ValidationSummary),
            ResultJson = null,
            ExpiresAt = DateTime.UtcNow.Add(ConfirmationWindow),
        };

        // The preview travels with the validation summary so the card can render without the payload.
        action.ResultJson = null;
        dbContext.AIActions.Add(action);
        await dbContext.SaveChangesAsync();

        await StorePreviewAsync(action, request.Preview);

        return ToModel(action, request.Preview);
    }

    public async Task<AIActionModel?> GetByIdAsync(long actionId, long userId)
    {
        var action = await dbContext.AIActions
            .FirstOrDefaultAsync(x => x.Id == actionId && x.UserId == userId);

        if (action == null)
        {
            return null;
        }

        await ExpireIfDueAsync(action);
        return ToModel(action);
    }

    public async Task<IReadOnlyList<AIActionModel>> ListForConversationAsync(long conversationId, long userId)
    {
        var actions = await dbContext.AIActions
            .Where(x => x.ConversationId == conversationId && x.UserId == userId)
            .OrderBy(x => x.DateCreated)
            .ToListAsync();

        foreach (var action in actions)
        {
            await ExpireIfDueAsync(action);
        }

        return actions.Select(x => ToModel(x)).ToList();
    }

    public async Task<AIActionModel> ConfirmAsync(long actionId, long userId)
    {
        var action = await dbContext.AIActions
            .FirstOrDefaultAsync(x => x.Id == actionId && x.UserId == userId)
            ?? throw new FitMateException("Suggestion not found.");

        // Already done: hand back the original result rather than creating a second copy.
        if (action.Status == AIActionStatus.Executed)
        {
            return ToModel(action);
        }

        if (action.Status is AIActionStatus.Rejected or AIActionStatus.Expired)
        {
            throw new FitMateException("This suggestion is no longer available.");
        }

        if (action.Status == AIActionStatus.Executing)
        {
            throw new AIActionAlreadyExecutedException();
        }

        if (action.Status != AIActionStatus.PendingConfirmation)
        {
            throw new FitMateException("This suggestion cannot be confirmed.");
        }

        if (await ExpireIfDueAsync(action))
        {
            throw new AIActionExpiredException();
        }

        if (!executors.TryGetValue(action.ActionType, out var executor))
        {
            throw new FitMateException($"No executor is registered for {action.ActionType}.");
        }

        // Claim the action first. The concurrency token means a parallel confirmation loses here
        // rather than running the executor twice.
        action.Status = AIActionStatus.Executing;
        action.ConfirmedAt = DateTime.UtcNow;
        action.Version++;

        try
        {
            await dbContext.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            dbContext.ChangeTracker.Clear();
            var winner = await dbContext.AIActions.AsNoTracking()
                .FirstAsync(x => x.Id == actionId && x.UserId == userId);

            return winner.Status == AIActionStatus.Executed
                ? ToModel(winner)
                : throw new AIActionAlreadyExecutedException();
        }

        try
        {
            var result = await executor.ExecuteAsync(action, userId, CancellationToken.None);

            action.Status = AIActionStatus.Executed;
            action.ExecutedAt = DateTime.UtcNow;
            action.ResultJson = AIJsonSerializer.Serialize(result);
            action.Version++;
            await dbContext.SaveChangesAsync();

            return ToModel(action);
        }
        catch (Exception exception)
        {
            action.Status = AIActionStatus.Failed;
            action.FailureReason = exception.Message;
            action.Version++;
            await dbContext.SaveChangesAsync();
            throw;
        }
    }

    public async Task<AIActionModel> RejectAsync(long actionId, long userId)
    {
        var action = await dbContext.AIActions
            .FirstOrDefaultAsync(x => x.Id == actionId && x.UserId == userId)
            ?? throw new FitMateException("Suggestion not found.");

        if (action.Status == AIActionStatus.Rejected)
        {
            return ToModel(action);
        }

        if (action.Status != AIActionStatus.PendingConfirmation)
        {
            throw new FitMateException("This suggestion can no longer be rejected.");
        }

        action.Status = AIActionStatus.Rejected;
        action.RejectedAt = DateTime.UtcNow;
        action.Version++;
        await dbContext.SaveChangesAsync();

        return ToModel(action);
    }

    /// <summary>Lazily expires a stale proposal so a forgotten card cannot be confirmed weeks later.</summary>
    private async Task<bool> ExpireIfDueAsync(AIAction action)
    {
        if (action.Status != AIActionStatus.PendingConfirmation
            || action.ExpiresAt is not { } expiresAt
            || expiresAt > DateTime.UtcNow)
        {
            return false;
        }

        action.Status = AIActionStatus.Expired;
        action.Version++;
        await dbContext.SaveChangesAsync();
        return true;
    }

    private async Task StorePreviewAsync(AIAction action, AIActionPreviewModel preview)
    {
        var summary = AIJsonSerializer.Deserialize<AIActionValidationSummaryModel>(
            action.ValidationSummaryJson ?? "{}") ?? new AIActionValidationSummaryModel();

        action.ValidationSummaryJson = AIJsonSerializer.Serialize(new StoredSummary
        {
            Preview = preview,
            Warnings = summary.Warnings,
            Errors = summary.Errors,
            DuplicateCandidates = summary.DuplicateCandidates,
        });

        await dbContext.SaveChangesAsync();
    }

    private static AIActionModel ToModel(AIAction action, AIActionPreviewModel? preview = null)
    {
        var stored = AIJsonSerializer.Deserialize<StoredSummary>(action.ValidationSummaryJson ?? "{}")
            ?? new StoredSummary();

        return new AIActionModel
        {
            Id = action.Id,
            ConversationId = action.ConversationId,
            ActionType = action.ActionType,
            Status = action.Status,
            Preview = preview ?? stored.Preview,
            ValidationSummary = new AIActionValidationSummaryModel
            {
                Warnings = stored.Warnings,
                Errors = stored.Errors,
                DuplicateCandidates = stored.DuplicateCandidates,
            },
            Result = string.IsNullOrWhiteSpace(action.ResultJson)
                ? null
                : AIJsonSerializer.Deserialize<AIActionResultModel>(action.ResultJson),
            ExpiresAt = action.ExpiresAt,
            ExecutedAt = action.ExecutedAt,
            FailureReason = action.FailureReason,
            DateCreated = action.DateCreated,
        };
    }

    /// <summary>Preview and validation share one jsonb column; this is its shape.</summary>
    private sealed class StoredSummary
    {
        public AIActionPreviewModel Preview { get; set; } = new();
        public List<string> Warnings { get; set; } = [];
        public List<string> Errors { get; set; } = [];
        public List<DuplicateCandidateModel> DuplicateCandidates { get; set; } = [];
    }
}
