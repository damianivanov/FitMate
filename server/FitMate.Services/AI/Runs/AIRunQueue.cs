using FitMate.DB;
using FitMate.DB.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace FitMate.Services.AI.Runs;

public class AIRunQueue : IAIRunQueue
{
    private const int ClaimCandidateBatch = 10;

    private readonly AppDbContext dbContext;
    private readonly IAIProgressService progressService;
    private readonly AIRunOptions options;

    public AIRunQueue(
        AppDbContext dbContext,
        IAIProgressService progressService,
        IOptions<AIRunOptions> options)
    {
        this.dbContext = dbContext;
        this.progressService = progressService;
        this.options = options.Value;
    }

    public async Task<long?> ClaimNextAsync(string workerId, DateTime utcNow, CancellationToken cancellationToken)
    {
        // Candidates are read unlocked and then claimed conditionally. Losing the race costs one
        // wasted UPDATE, which is cheaper than holding a row lock for the length of a run.
        var candidates = await dbContext.AIRuns
            .AsNoTracking()
            .Where(x => x.Status == AIRunStatus.Queued
                && (x.NextAttemptAt == null || x.NextAttemptAt <= utcNow))
            .OrderBy(x => x.QueuedAt)
            .Select(x => x.Id)
            .Take(ClaimCandidateBatch)
            .ToListAsync(cancellationToken);

        foreach (var candidateId in candidates)
        {
            var claimed = await dbContext.AIRuns
                .Where(x => x.Id == candidateId && x.Status == AIRunStatus.Queued)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(x => x.Status, AIRunStatus.Running)
                    .SetProperty(x => x.LeaseOwner, workerId)
                    .SetProperty(x => x.LeaseExpiresAt, utcNow.AddSeconds(options.LeaseSeconds))
                    .SetProperty(x => x.HeartbeatAt, utcNow)
                    .SetProperty(x => x.ProcessingStartedAt, utcNow)
                    .SetProperty(x => x.AttemptCount, x => x.AttemptCount + 1),
                    cancellationToken);

            if (claimed == 1)
            {
                return candidateId;
            }
        }

        return null;
    }

    public async Task<bool> RenewLeaseAsync(
        long runId,
        string workerId,
        DateTime utcNow,
        CancellationToken cancellationToken)
    {
        var renewed = await dbContext.AIRuns
            .Where(x => x.Id == runId && x.LeaseOwner == workerId && x.Status == AIRunStatus.Running)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(x => x.HeartbeatAt, utcNow)
                .SetProperty(x => x.LeaseExpiresAt, utcNow.AddSeconds(options.LeaseSeconds)),
                cancellationToken);

        return renewed == 1;
    }

    public async Task<bool> RequeueSafeAsync(
        long runId,
        string workerId,
        DateTime nextAttemptAt,
        CancellationToken cancellationToken)
    {
        var requeued = await dbContext.AIRuns
            .Where(x => x.Id == runId
                && x.LeaseOwner == workerId
                && x.Status == AIRunStatus.Running
                && !x.HasSideEffects
                && x.AttemptCount < options.MaximumSafeAttempts)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(x => x.Status, AIRunStatus.Queued)
                .SetProperty(x => x.LeaseOwner, (string?)null)
                .SetProperty(x => x.LeaseExpiresAt, (DateTime?)null)
                .SetProperty(x => x.NextAttemptAt, nextAttemptAt),
                cancellationToken);

        return requeued == 1;
    }

    public async Task<int> ReclaimStaleAsync(DateTime utcNow, CancellationToken cancellationToken)
    {
        var stale = await dbContext.AIRuns
            .AsNoTracking()
            .Where(x => x.Status == AIRunStatus.Running
                && x.LeaseExpiresAt != null
                && x.LeaseExpiresAt < utcNow)
            .Select(x => new
            {
                x.Id,
                x.ConversationId,
                x.HasSideEffects,
                x.AttemptCount,
            })
            .ToListAsync(cancellationToken);

        if (stale.Count == 0)
        {
            return 0;
        }

        var safeIds = stale
            .Where(x => !x.HasSideEffects && x.AttemptCount < options.MaximumSafeAttempts)
            .Select(x => x.Id)
            .ToList();

        // Anything past a tool call cannot be replayed: a second pass could create a duplicate
        // proposal or charge generation quota twice. Fail it and let the user retry deliberately.
        var abandoned = stale.Where(x => !safeIds.Contains(x.Id)).ToList();

        if (safeIds.Count > 0)
        {
            await dbContext.AIRuns
                .Where(x => safeIds.Contains(x.Id))
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(x => x.Status, AIRunStatus.Queued)
                    .SetProperty(x => x.LeaseOwner, (string?)null)
                    .SetProperty(x => x.LeaseExpiresAt, (DateTime?)null)
                    .SetProperty(x => x.NextAttemptAt, utcNow),
                    cancellationToken);
        }

        if (abandoned.Count > 0)
        {
            var abandonedIds = abandoned.Select(x => x.Id).ToList();

            await dbContext.AIRuns
                .Where(x => abandonedIds.Contains(x.Id))
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(x => x.Status, AIRunStatus.Failed)
                    .SetProperty(x => x.ErrorCode, "run_interrupted")
                    .SetProperty(x => x.ErrorMessage, "The run was interrupted and could not be resumed.")
                    .SetProperty(x => x.CompletedAt, utcNow)
                    .SetProperty(x => x.LeaseOwner, (string?)null)
                    .SetProperty(x => x.LeaseExpiresAt, (DateTime?)null),
                    cancellationToken);

            // Without this the conversation stays locked behind a run that will never finish and
            // the user can never send another message.
            var conversationIds = abandoned.Select(x => x.ConversationId).Distinct().ToList();
            await dbContext.AIConversations
                .Where(x => conversationIds.Contains(x.Id) && x.ActiveRunId != null
                    && abandonedIds.Contains(x.ActiveRunId!.Value))
                .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.ActiveRunId, (long?)null),
                    cancellationToken);

            foreach (var run in abandoned)
            {
                await progressService.PublishAsync(run.Id, AIProgressCodes.RunFailed, null, cancellationToken);
            }
        }

        return stale.Count;
    }
}
