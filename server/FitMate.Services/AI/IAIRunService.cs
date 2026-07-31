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
}
