namespace FitMate.Services.AI.Runs;

/// <summary>
/// The claim and lease protocol. Every contended transition is a single conditional UPDATE whose
/// affected-row count decides the winner, so two workers can never both own one run.
/// </summary>
public interface IAIRunQueue
{
    /// <summary>Claims one eligible run and returns its id, or null when nothing is claimable.</summary>
    Task<long?> ClaimNextAsync(string workerId, DateTime utcNow, CancellationToken cancellationToken);

    /// <summary>Extends the lease. False means the lease was lost and the worker must stop touching the run.</summary>
    Task<bool> RenewLeaseAsync(long runId, string workerId, DateTime utcNow, CancellationToken cancellationToken);

    /// <summary>Returns a run to the queue. Refused once it has side effects or its attempts are spent.</summary>
    Task<bool> RequeueSafeAsync(long runId, string workerId, DateTime nextAttemptAt, CancellationToken cancellationToken);

    /// <summary>Requeues or fails runs whose lease expired. Returns how many were touched.</summary>
    Task<int> ReclaimStaleAsync(DateTime utcNow, CancellationToken cancellationToken);
}
