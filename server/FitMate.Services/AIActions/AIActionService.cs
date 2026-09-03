using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.AIActions;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Integrations.AI.Serialization;
using FitMate.Services.AIActions.Executors;
using FitMate.Services.Exercises;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.AIActions;

public class AIActionService : IAIActionService
{
    /// <summary>How long a proposal stays confirmable before the user has to ask again.</summary>
    public static readonly TimeSpan ConfirmationWindow = TimeSpan.FromHours(24);

    private readonly AppDbContext dbContext;
    private readonly IExerciseService exerciseService;
    private readonly IAIProposalDetailService detailService;
    private readonly IReadOnlyDictionary<AIActionType, IAIActionExecutor> executors;

    public AIActionService(
        AppDbContext dbContext,
        IExerciseService exerciseService,
        IAIProposalDetailService detailService,
        IEnumerable<IAIActionExecutor> executors)
    {
        this.dbContext = dbContext;
        this.exerciseService = exerciseService;
        this.detailService = detailService;
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
        var action = await ReadForExecutionAsync(actionId, userId);

        // Checked before the executor lookup: an already-applied action still returns its result
        // even if its executor has since been unregistered.
        if (action.Status == AIActionStatus.Executed)
        {
            return ToModel(action);
        }

        if (!executors.TryGetValue(action.ActionType, out var executor))
        {
            throw new FitMateException($"No executor is registered for {action.ActionType}.");
        }

        var claim = await ClaimAsync(action, actionId, userId);
        if (claim != null)
        {
            return claim;
        }

        return await RunClaimedAsync(
            action,
            () => executor.ExecuteAsync(action, userId, CancellationToken.None));
    }

    /// <summary>
    /// Applies a workout proposal to a session the user already has running instead of creating a
    /// second one. Nothing is written to the workout here: the resolved exercises go back to the
    /// client, which appends them to the live draft. A server-side append would be undone by the
    /// builder's next autosave, which persists its whole draft over the workout.
    /// </summary>
    public async Task<AIActionMergeResultModel> MergeIntoWorkoutAsync(long actionId, long userId, long workoutId)
    {
        var action = await ReadForExecutionAsync(actionId, userId);

        if (action.ActionType != AIActionType.CreateWorkout)
        {
            throw new FitMateException("Only a workout suggestion can be added to a running session.");
        }

        var target = await dbContext.Workouts
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == workoutId && x.UserId == userId)
            ?? throw new FitMateException("Workout not found.");

        if (target.FinishedAt != null)
        {
            throw new FitMateException("That workout is already finished.");
        }

        var claim = await ClaimAsync(action, actionId, userId);
        if (claim != null)
        {
            return new AIActionMergeResultModel
            {
                Action = claim,
                Detail = await detailService.BuildAsync(action),
            };
        }

        var confirmed = await RunClaimedAsync(action, async () =>
        {
            var payload = AIJsonSerializer.Deserialize<ProposeWorkoutPayload>(action.PayloadJson)
                ?? throw new FitMateException("The suggestion payload is empty.");

            await ProposedExerciseReader.CreateNewExercisesAsync(
                dbContext, exerciseService, payload.Exercises, payload.NewExercises, userId);
            await ProposedExerciseReader.ValidateAsync(dbContext, payload.Exercises, userId);

            action.PayloadJson = AIJsonSerializer.Serialize(payload);

            return new AIActionResultModel
            {
                CreatedEntityId = workoutId,
                CreatedEntityName = target.Title,
                EntityKind = "workouts",
            };
        });

        return new AIActionMergeResultModel
        {
            Action = confirmed,
            Detail = await detailService.BuildAsync(action),
        };
    }

    /// <summary>Loads a confirmable action and runs the guards shared by confirming and merging.</summary>
    private async Task<AIAction> ReadForExecutionAsync(long actionId, long userId)
    {
        var action = await dbContext.AIActions
            .FirstOrDefaultAsync(x => x.Id == actionId && x.UserId == userId)
            ?? throw new FitMateException("Suggestion not found.");

        // Already done: hand back the original result rather than creating a second copy.
        if (action.Status == AIActionStatus.Executed)
        {
            return action;
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

        return action;
    }

    /// <summary>
    /// Claims the action for execution. Returns a model when there is nothing left to run — the
    /// action was already executed, or a parallel request won the race — and null to carry on.
    /// </summary>
    private async Task<AIActionModel?> ClaimAsync(AIAction action, long actionId, long userId)
    {
        if (action.Status == AIActionStatus.Executed)
        {
            return ToModel(action);
        }

        // The concurrency token means a parallel confirmation loses here rather than running twice.
        action.Status = AIActionStatus.Executing;
        action.ConfirmedAt = DateTime.UtcNow;
        action.Version++;

        try
        {
            await dbContext.SaveChangesAsync();
            return null;
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
    }

    private async Task<AIActionModel> RunClaimedAsync(AIAction action, Func<Task<AIActionResultModel>> execute)
    {
        try
        {
            var result = await execute();

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
            AIRunId = action.AIRunId,
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
