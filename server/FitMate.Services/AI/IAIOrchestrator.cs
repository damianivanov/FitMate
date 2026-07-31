using FitMate.Core.JsonModels.AI;

namespace FitMate.Services.AI;

public interface IAIOrchestrator
{
    Task<SendAIMessageResponse> SendAsync(long conversationId, SendAIMessageRequest request, long userId);
}
