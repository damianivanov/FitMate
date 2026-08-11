using FitMate.Core.JsonModels.AI;

namespace FitMate.Services.AI.Runs;

/// <summary>Assembles everything the client needs to rebuild a run's UI state from scratch.</summary>
public interface IAIRunSnapshotService
{
    Task<AIRunSnapshotModel?> GetAsync(long runId, long userId, long afterEventId = 0);
}
