namespace FitMate.Services.AI;

/// <summary>
/// Runs one queued AI run to a terminal state. It returns no user-facing payload: the client reads
/// the outcome from the run snapshot, which is what makes orchestration independent of the request
/// that started it.
/// </summary>
public interface IAIOrchestrator
{
    Task ProcessAsync(long runId, string workerId, CancellationToken cancellationToken);
}
