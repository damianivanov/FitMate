using FitMate.Core.JsonModels.AI;
using FitMate.Core.Settings;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Integrations.AI.Models;
using FitMate.Services.AI;
using FitMate.Services.AI.Summaries;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace FitMate.Tests.Unit.Services;

public class AIConversationSummaryTests
{
    private const int RetainedWindow = 10;

    private static AIBudget Budget => new(
        Model: "test-model",
        MaximumContextTokens: 32_000,
        MaximumConversationMessages: RetainedWindow,
        MaximumOutputTokens: 4_000,
        MaximumMessageCharacters: 16_000,
        TimeoutSeconds: 30,
        MaximumToolIterations: 6,
        MaximumToolCallsPerRun: 12);

    // Обобщава се само това, което е излязло извън прозореца
    [Fact]
    public async Task Summarize_OnlyCoversMessagesOutsideTheRetainedWindow()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var provider = new FakeAICompletionProvider().EnqueueText("User trains 4x a week, no barbell.");
        var (summarizer, conversationId) = await CreateAsync(context, provider);

        var messageIds = await SeedMessagesAsync(context, conversationId, count: 40);

        await summarizer.EnsureSummaryAsync(
            conversationId, SqliteTestDatabase.UserId, Budget, null, CancellationToken.None);

        var conversation = await context.AIConversations.AsNoTracking().SingleAsync(x => x.Id == conversationId);

        // 40 messages with the newest 10 retained, so everything up to and including #30 is covered.
        Assert.Equal(messageIds[29], conversation.SummaryThroughMessageId);
        Assert.Equal("User trains 4x a week, no barbell.", conversation.Summary);
        Assert.NotNull(conversation.SummaryUpdatedAt);
    }

    // Къс разговор не се обобщава изобщо
    [Fact]
    public async Task Summarize_IsSkipped_WhenEverythingStillFitsInTheWindow()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var provider = new FakeAICompletionProvider().EnqueueText("Should not be used.");
        var (summarizer, conversationId) = await CreateAsync(context, provider);

        await SeedMessagesAsync(context, conversationId, count: RetainedWindow);

        var summary = await summarizer.EnsureSummaryAsync(
            conversationId, SqliteTestDatabase.UserId, Budget, null, CancellationToken.None);

        Assert.Null(summary);
        Assert.Empty(provider.Requests);
    }

    // Второ извикване без нови изпаднали съобщения не вика доставчика пак
    [Fact]
    public async Task Summarize_IsSkipped_WhenNothingNewFellOutOfTheWindow()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var provider = new FakeAICompletionProvider().EnqueueText("Summary.");
        var (summarizer, conversationId) = await CreateAsync(context, provider);

        await SeedMessagesAsync(context, conversationId, count: 40);

        await summarizer.EnsureSummaryAsync(
            conversationId, SqliteTestDatabase.UserId, Budget, null, CancellationToken.None);
        await summarizer.EnsureSummaryAsync(
            conversationId, SqliteTestDatabase.UserId, Budget, null, CancellationToken.None);

        Assert.Single(provider.Requests);
    }

    // Инструменталният трафик никога не влиза в обобщението
    [Fact]
    public async Task Summarize_NeverIncludesToolMessages()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var provider = new FakeAICompletionProvider().EnqueueText("Summary.");
        var (summarizer, conversationId) = await CreateAsync(context, provider);

        await SeedMessagesAsync(context, conversationId, count: 40);

        context.AIMessages.Add(new AIMessage
        {
            ConversationId = conversationId,
            UserId = SqliteTestDatabase.UserId,
            Role = AIMessageRole.ToolResult,
            ToolName = "get_training_profile",
            ToolCallId = "call-1",
            Content = """{"secretPayload":"must-not-be-summarized"}""",
            DateCreated = new DateTime(2026, 8, 1, 0, 0, 0, DateTimeKind.Utc),
        });
        await context.SaveChangesAsync();

        await summarizer.EnsureSummaryAsync(
            conversationId, SqliteTestDatabase.UserId, Budget, null, CancellationToken.None);

        var sent = string.Join(
            "\n",
            provider.Requests.SelectMany(request => request.Messages).Select(message => message.Content));

        Assert.DoesNotContain("secretPayload", sent);
        Assert.DoesNotContain("must-not-be-summarized", sent);
    }

    // Провалено обобщение не проваля разговора
    [Fact]
    public async Task SummaryFailure_DoesNotFailTheRun()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var provider = new FakeAICompletionProvider { ThrowOnCall = new InvalidOperationException("down") };
        var (summarizer, conversationId) = await CreateAsync(context, provider);

        // Odd count so the newest message is the user's, which is what a real run answers.
        await SeedMessagesAsync(context, conversationId, count: 41);

        var summary = await summarizer.EnsureSummaryAsync(
            conversationId, SqliteTestDatabase.UserId, Budget, null, CancellationToken.None);

        Assert.Null(summary);

        var builder = NewContextBuilder(context, summarizer);
        var messages = await builder.BuildAsync(conversationId, SqliteTestDatabase.UserId, Budget);

        Assert.NotEmpty(messages);
        Assert.Equal(AIProviderMessageRole.User, messages[^1].Role);
        Assert.Contains("message-41", messages[^1].Content);
    }

    // Обобщението стои преди скорошните съобщения, а най-новото никога не пада
    [Fact]
    public async Task ContextBuild_PlacesSummaryBeforeRecentMessages_AndKeepsNewestUserMessage()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var provider = new FakeAICompletionProvider().EnqueueText("Prefers dumbbells.");
        var (summarizer, conversationId) = await CreateAsync(context, provider);

        await SeedMessagesAsync(context, conversationId, count: 41);

        var builder = NewContextBuilder(context, summarizer);
        var messages = await builder.BuildAsync(conversationId, SqliteTestDatabase.UserId, Budget);

        Assert.Equal(AIProviderMessageRole.System, messages[0].Role);
        Assert.Equal(AIProviderMessageRole.System, messages[1].Role);
        Assert.Contains("Prefers dumbbells.", messages[1].Content);
        Assert.Contains("Earlier conversation summary", messages[1].Content);

        Assert.Equal(AIProviderMessageRole.User, messages[^1].Role);
        Assert.Contains("message-41", messages[^1].Content);
    }

    // При тесен бюджет обобщението отпада преди последното съобщение
    [Fact]
    public async Task ContextBuild_DropsSummaryBeforeNewestMessage_WhenTokensAreTight()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var provider = new FakeAICompletionProvider().EnqueueText(new string('x', 4_000));
        var (summarizer, conversationId) = await CreateAsync(context, provider);

        await SeedMessagesAsync(context, conversationId, count: 41);

        var tightBudget = Budget with { MaximumContextTokens = 400 };
        var builder = NewContextBuilder(context, summarizer);
        var messages = await builder.BuildAsync(conversationId, SqliteTestDatabase.UserId, tightBudget);

        Assert.DoesNotContain(messages, x => x.Content.Contains("Earlier conversation summary"));
        Assert.Equal(AIProviderMessageRole.User, messages[^1].Role);
        Assert.Contains("message-41", messages[^1].Content);
    }

    private static async Task<(IAIConversationSummarizer Summarizer, long ConversationId)> CreateAsync(
        AppDbContext context,
        FakeAICompletionProvider provider)
    {
        var redaction = new AIRedactionService();
        var conversationService = new AIConversationService(context, redaction);

        var conversation = await conversationService.CreateAsync(
            new CreateAIConversationRequest(),
            SqliteTestDatabase.UserId);

        var summarizer = new AIConversationSummarizer(
            context,
            provider,
            new AISettingsService(
                context,
                new MemoryCache(new MemoryCacheOptions()),
                Options.Create(new AIOptions { DefaultModel = "test-model", FastModel = "test-fast-model" }),
                new FakeAIModelCatalog()),
            new AIRunService(context, new AICostCalculator(context), redaction),
            NullLogger<AIConversationSummarizer>.Instance);

        return (summarizer, conversation.Id);
    }

    private static AIContextBuilder NewContextBuilder(
        AppDbContext context,
        IAIConversationSummarizer summarizer) =>
        new(
            new AIConversationService(context, new AIRedactionService()),
            new AIPromptBuilder(),
            new AITokenEstimator(),
            summarizer);

    /// <summary>
    /// Alternating user/assistant messages, oldest first. DateCreated is set explicitly because the
    /// context window orders by it, and a tight insert loop can otherwise share a timestamp.
    /// </summary>
    private static async Task<List<long>> SeedMessagesAsync(AppDbContext context, long conversationId, int count)
    {
        var ids = new List<long>(count);

        for (var index = 1; index <= count; index++)
        {
            var message = new AIMessage
            {
                ConversationId = conversationId,
                UserId = SqliteTestDatabase.UserId,
                Role = index % 2 == 1 ? AIMessageRole.User : AIMessageRole.Assistant,
                Content = $"message-{index}",
                DateCreated = new DateTime(2026, 8, 1, 0, 0, 0, DateTimeKind.Utc).AddMinutes(index),
            };

            context.AIMessages.Add(message);
            await context.SaveChangesAsync();
            ids.Add(message.Id);
        }

        return ids;
    }
}
