using FitMate.Integrations.AI.Models;

namespace FitMate.Services.AI;

public interface IAIContextBuilder
{
    Task<List<AIProviderMessage>> BuildAsync(
        long conversationId,
        long userId,
        AIBudget budget,
        long? runId = null,
        CancellationToken cancellationToken = default);
}
