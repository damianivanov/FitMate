using FitMate.Core.JsonModels.AI;

namespace FitMate.Services.AI.Runs;

/// <summary>
/// Accepts a message and enqueues a run. Everything that can reject the request — plan, quota,
/// ownership, length — is settled here, before a worker or a provider call is ever involved.
/// </summary>
public interface IAIRunStarter
{
    Task<StartAIRunResponse> StartAsync(long conversationId, SendAIMessageRequest request, long userId);
}
