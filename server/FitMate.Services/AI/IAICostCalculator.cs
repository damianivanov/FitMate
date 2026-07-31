using FitMate.Integrations.AI.Models;

namespace FitMate.Services.AI;

public interface IAICostCalculator
{
    /// <summary>
    /// Cost for the given usage using the pricing row effective at <paramref name="occurredAt"/>.
    /// Returns null when no pricing row matches, so an unknown cost stays unknown rather than wrong.
    /// </summary>
    Task<decimal?> EstimateAsync(string provider, string model, AIProviderUsage usage, DateTime occurredAt);
}
