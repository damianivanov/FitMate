using FitMate.Integrations.AI.Models;

namespace FitMate.Services.AI;

public class AITokenEstimator : IAITokenEstimator
{
    private const double CharactersPerToken = 3.5;

    private const int PerMessageOverhead = 4;

    public int EstimateText(string? text)
    {
        if (string.IsNullOrEmpty(text))
        {
            return 0;
        }

        return (int)Math.Ceiling(text.Length / CharactersPerToken);
    }

    public int EstimateMessage(AIProviderMessage message)
    {
        var total = PerMessageOverhead + EstimateText(message.Content);

        foreach (var toolCall in message.ToolCalls)
        {
            total += EstimateText(toolCall.Name) + EstimateText(toolCall.ArgumentsJson) + PerMessageOverhead;
        }

        return total;
    }
}
