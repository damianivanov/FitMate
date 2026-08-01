using FitMate.Core.JsonModels.AI;
using FitMate.DB;
using FitMate.Integrations.AI.Models;
using FitMate.Services.AI;
using FitMate.Tests.TestInfrastructure;

namespace FitMate.Tests.Unit.Services;

public class AIContextTrimmingTests
{
    private static AIBudget BudgetWith(int contextTokens, int messages = 100) => new(
        Model: "test-model",
        MaximumContextTokens: contextTokens,
        MaximumConversationMessages: messages,
        MaximumOutputTokens: 1_000,
        MaximumMessageCharacters: 100_000,
        TimeoutSeconds: 30,
        MaximumToolIterations: 6,
        MaximumToolCallsPerRun: 12);

    private static async Task<(AIContextBuilder Builder, long ConversationId)> CreateAsync(
        AppDbContext context,
        int turns,
        int charactersPerTurn)
    {
        var conversationService = new AIConversationService(context, new AIRedactionService());
        var conversation = await conversationService.CreateAsync(
            new CreateAIConversationRequest(),
            SqliteTestDatabase.UserId);

        for (var index = 0; index < turns; index++)
        {
            await conversationService.AddUserMessageAsync(
                conversation.Id,
                $"{index}:{new string('x', charactersPerTurn)}",
                SqliteTestDatabase.UserId);
        }

        var builder = new AIContextBuilder(conversationService, new AIPromptBuilder(), new AITokenEstimator());
        return (builder, conversation.Id);
    }

    [Fact]
    public async Task GenerousBudget_KeepsEveryTurn()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var (builder, conversationId) = await CreateAsync(context, turns: 5, charactersPerTurn: 40);

        var messages = await builder.BuildAsync(conversationId, SqliteTestDatabase.UserId, BudgetWith(32_000));

        Assert.Equal(AIProviderMessageRole.System, messages[0].Role);
        Assert.Equal(6, messages.Count);
    }

    [Fact]
    public async Task TightBudget_DropsOldestFirstAndKeepsSystemPrompt()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var (builder, conversationId) = await CreateAsync(context, turns: 8, charactersPerTurn: 400);

        var messages = await builder.BuildAsync(conversationId, SqliteTestDatabase.UserId, BudgetWith(1_200));

        Assert.Equal(AIProviderMessageRole.System, messages[0].Role);
        Assert.True(messages.Count < 9, "history should have been trimmed");

        // The newest turn survives and the oldest is gone.
        Assert.StartsWith("7:", messages[^1].Content);
        Assert.DoesNotContain(messages, x => x.Content.StartsWith("0:", StringComparison.Ordinal));
    }

    // Trimming can drop older turns but never the message being answered: without it the run has
    // nothing to respond to. Oversized single messages are refused by the inbound length guard.
    [Fact]
    public async Task BudgetSmallerThanNewestMessage_StillKeepsSystemPromptAndNewestMessage()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var (builder, conversationId) = await CreateAsync(context, turns: 3, charactersPerTurn: 2_000);

        var messages = await builder.BuildAsync(conversationId, SqliteTestDatabase.UserId, BudgetWith(10));

        Assert.Equal(2, messages.Count);
        Assert.Equal(AIProviderMessageRole.System, messages[0].Role);
        Assert.StartsWith("2:", messages[1].Content);
    }

    [Fact]
    public async Task MessageWindow_LimitsHowMuchHistoryIsEvenConsidered()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var (builder, conversationId) = await CreateAsync(context, turns: 10, charactersPerTurn: 20);

        var messages = await builder.BuildAsync(
            conversationId,
            SqliteTestDatabase.UserId,
            BudgetWith(32_000, messages: 3));

        Assert.Equal(4, messages.Count);
    }
}
