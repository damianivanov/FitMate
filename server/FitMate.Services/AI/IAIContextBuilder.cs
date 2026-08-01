using FitMate.Integrations.AI.Models;

namespace FitMate.Services.AI;

public interface IAIContextBuilder
{
    /// <summary>
    /// System prompt plus the most recent conversation turns, oldest first, trimmed to the
    /// budget's token ceiling.
    /// </summary>
    Task<List<AIProviderMessage>> BuildAsync(long conversationId, long userId, AIBudget budget);
}
