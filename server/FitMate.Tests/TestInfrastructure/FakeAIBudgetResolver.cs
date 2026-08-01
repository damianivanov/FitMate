using FitMate.Services.AI;

namespace FitMate.Tests.TestInfrastructure;

/// <summary>Hands back a fixed budget so tests can pin limits without seeding settings rows.</summary>
public sealed class FakeAIBudgetResolver : IAIBudgetResolver
{
    public AIBudget Budget { get; set; } = new(
        Model: "test-model",
        MaximumContextTokens: 32_000,
        MaximumConversationMessages: 30,
        MaximumOutputTokens: 4_000,
        MaximumMessageCharacters: 16_000,
        TimeoutSeconds: 30,
        MaximumToolIterations: 6,
        MaximumToolCallsPerRun: 12);

    public Task<AIBudget> ResolveAsync(long userId) => Task.FromResult(Budget);
}
