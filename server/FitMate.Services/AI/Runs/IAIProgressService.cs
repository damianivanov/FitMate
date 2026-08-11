using FitMate.Core.JsonModels.AI;

namespace FitMate.Services.AI.Runs;

/// <summary>Appends and reads the sanitized run timeline the client is allowed to see.</summary>
public interface IAIProgressService
{
    Task PublishAsync(
        long runId,
        string code,
        string? toolName = null,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AIProgressEventModel>> GetEventsAsync(
        long runId,
        long afterEventId,
        CancellationToken cancellationToken = default);
}
