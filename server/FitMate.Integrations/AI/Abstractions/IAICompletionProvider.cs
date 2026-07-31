using FitMate.Integrations.AI.Models;

namespace FitMate.Integrations.AI.Abstractions;

public interface IAICompletionProvider
{
    Task<AICompletionResponse> CompleteAsync(
        AICompletionRequest request,
        CancellationToken cancellationToken = default);
}
