using FitMate.Integrations.AI.Models;

namespace FitMate.Services.AI;

/// <summary>
/// Approximate token counting, used only to decide how much history fits. It deliberately
/// over-estimates so trimming errs toward sending less than the ceiling rather than more.
/// </summary>
public interface IAITokenEstimator
{
    int EstimateText(string? text);

    int EstimateMessage(AIProviderMessage message);
}
