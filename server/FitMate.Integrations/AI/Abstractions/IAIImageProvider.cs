using FitMate.Integrations.AI.Models;

namespace FitMate.Integrations.AI.Abstractions;

public interface IAIImageProvider
{
    Task<AIGeneratedImageResult> GenerateAsync(
        AIImageGenerationRequest request,
        CancellationToken cancellationToken = default);
}
