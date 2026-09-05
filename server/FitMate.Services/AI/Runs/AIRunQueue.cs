using FitMate.DB;
using FitMate.DB.Enums;
using FitMate.Services.Subscriptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace FitMate.Services.AI.Runs;

public class AIRunQueue : IAIRunQueue
{
    private const int ClaimCandidateBatch = 10;

    private readonly AppDbContext dbContext;
    private readonly IAIProgressService progressService;
    private readonly AIRunOptions options;
    private readonly IUsageService usageService;

    public AIRunQueue(
        AppDbContext dbContext,
        IAIProgressService progressService,
        IOptions<AIRunOptions> options,
        IUsageService usageService)
    {
        this.dbContext = dbContext;
        this.progressService = progressService;
        this.options = options.Value;
        this.usageService = usageService;
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
                .Where(x => x.Id == candidateId && x.Status == AIRunStatus.Queued
                    && (x.NextAttemptAt == null || x.NextAttemptAt <= utcNow))
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
                x.UsageReservationId,
            })
            .ToListAsync(cancellationToken);

        var reclaimed = 0;
        foreach (var run in stale)
        {
            // Recheck the live row at the UPDATE. The initial read is only a candidate list:
            // a worker may have renewed its lease, completed, or started a tool since then.
            await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);
            var expired = dbContext.AIRuns.Where(x => x.Id == run.Id
                && x.Status == AIRunStatus.Running
                && x.LeaseExpiresAt != null && x.LeaseExpiresAt < utcNow);

            var requeued = await expired
                .Where(x => !x.HasSideEffects && x.AttemptCount < options.MaximumSafeAttempts)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(x => x.Status, AIRunStatus.Queued)
                    .SetProperty(x => x.LeaseOwner, (string?)null)
                    .SetProperty(x => x.LeaseExpiresAt, (DateTime?)null)
                    .SetProperty(x => x.NextAttemptAt, utcNow), cancellationToken);

            if (requeued == 1)
            {
                await transaction.CommitAsync(cancellationToken);
                reclaimed++;
                continue;
            }

            var failed = await expired
                .Where(x => x.HasSideEffects || x.AttemptCount >= options.MaximumSafeAttempts)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(x => x.Status, AIRunStatus.Failed)
                    .SetProperty(x => x.ErrorCode, "run_interrupted")
                    .SetProperty(x => x.ErrorMessage, "The run was interrupted and could not be resumed.")
                    .SetProperty(x => x.CompletedAt, utcNow)
                    .SetProperty(x => x.LeaseOwner, (string?)null)
                    .SetProperty(x => x.LeaseExpiresAt, (DateTime?)null), cancellationToken);

            if (failed == 1)
            {
                // Recovery, quota release and the terminal event either all commit or all retry.
                if (run.UsageReservationId is { } reservationId)
                {
                    await usageService.ReleaseAsync(reservationId);
                }

                await dbContext.AIConversations
                    .Where(x => x.Id == run.ConversationId && x.ActiveRunId == run.Id)
                    .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.ActiveRunId, (long?)null),
                        cancellationToken);
                await progressService.PublishAsync(run.Id, AIProgressCodes.RunFailed, null, cancellationToken);
            }

            await transaction.CommitAsync(cancellationToken);
            reclaimed += failed;
        }

        return reclaimed;
    }
}
