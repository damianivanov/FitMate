using FitMate.Integrations.AI.Models;

namespace FitMate.Services.AI.Tools;

public interface IAIToolRegistry
{
    IReadOnlyList<AIToolDefinition> GetDefinitions(AIToolContext context);

    Task<AIToolExecutionResult> ExecuteAsync(
        AIProviderToolCall toolCall,
        AIToolContext context,
        CancellationToken cancellationToken);
}
