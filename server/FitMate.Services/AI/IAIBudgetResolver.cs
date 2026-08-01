namespace FitMate.Services.AI;

/// <summary>Everything a run is allowed to spend, after the plan and the global ceiling are combined.</summary>
public record AIBudget(
    string Model,
    int MaximumContextTokens,
    int MaximumConversationMessages,
    int MaximumOutputTokens,
    int MaximumMessageCharacters,
    int TimeoutSeconds,
    int MaximumToolIterations,
    int MaximumToolCallsPerRun);

public interface IAIBudgetResolver
{
    Task<AIBudget> ResolveAsync(long userId);
}
