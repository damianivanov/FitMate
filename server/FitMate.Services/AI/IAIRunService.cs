using FitMate.DB.Entities;
using FitMate.Integrations.AI.Models;

namespace FitMate.Services.AI;

/// <summary>
/// Records what every AI run did: provider, model, prompt version, tokens, duration, cost and errors.
/// </summary>
public interface IAIRunService
{
    Task<AIRun> StartAsync(long userId, long conversationId, string provider, string model, string promptVersion);
    Task AddUsageAsync(long runId, AIProviderUsage usage, string? providerRequestId);
    Task IncrementToolCallCountAsync(long runId, int count);
    Task CompleteAsync(long runId, long assistantMessageId);
    Task FailAsync(long runId, Exception exception);
    Task MarkLimitExceededAsync(long runId, string errorCode, string errorMessage);

    /// <summary>
    /// Links the reply the user was shown without touching the run status, so a run that stopped at
    /// a ceiling still reports why in the admin grid.
    /// </summary>
    Task AttachAssistantMessageAsync(long runId, long assistantMessageId);

    /// <summary>
    /// Marks the run as past the point of safe replay. Called before the first tool runs, not after:
    /// a crash mid-tool must still count as having had side effects.
    /// </summary>
    Task MarkSideEffectsAsync(long runId);

    /// <summary>Releases the one-active-run guard. Safe to call more than once.</summary>
    Task ClearActiveRunAsync(long conversationId, long runId);

    Task MarkCancelledAsync(long runId);
}
