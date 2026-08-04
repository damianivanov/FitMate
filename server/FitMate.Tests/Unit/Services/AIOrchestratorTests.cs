using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.AI;
using FitMate.Core.Settings;
using FitMate.DB;
using FitMate.DB.Enums;
using FitMate.Services.AI;
using FitMate.Services.AI.Tools;
using FitMate.Services.AIActions;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace FitMate.Tests.Unit.Services;

public class AIOrchestratorTests
{
    private sealed record Harness(
        AIOrchestrator Orchestrator,
        AppDbContext Context,
        FakeAICompletionProvider Provider,
        FakeUsageService Usage,
        FakeEntitlementService Entitlements,
        long ConversationId);

    private static async Task<Harness> CreateAsync(
        SqliteTestDatabase db,
        FakeAICompletionProvider provider,
        int maxIterations = 6,
        int maxToolCalls = 12,
        IEnumerable<IAIToolHandler>? tools = null)
    {
        var context = db.CreateContext();
        var redaction = new AIRedactionService();
        var conversationService = new AIConversationService(context, redaction);
        var conversation = await conversationService.CreateAsync(
            new CreateAIConversationRequest(),
            SqliteTestDatabase.UserId);

        var options = Options.Create(new AIOptions
        {
            Provider = "OpenAI",
            DefaultModel = "test-model",
            MaximumToolIterations = maxIterations,
            MaximumToolCallsPerRun = maxToolCalls,
            MaximumConversationMessages = 30,
            TimeoutSeconds = 30,
        });

        var registry = new AIToolRegistry(context, redaction, tools ?? []);
        var usage = new FakeUsageService();
        var entitlements = new FakeEntitlementService();
        var promptBuilder = new AIPromptBuilder();

        var budgetResolver = new FakeAIBudgetResolver
        {
            Budget = new AIBudget(
                Model: "test-model",
                MaximumContextTokens: 32_000,
                MaximumConversationMessages: 30,
                MaximumOutputTokens: 4_000,
                MaximumMessageCharacters: 16_000,
                TimeoutSeconds: 30,
                MaximumToolIterations: maxIterations,
                MaximumToolCallsPerRun: maxToolCalls),
        };

        var orchestrator = new AIOrchestrator(
            conversationService,
            new AIRunService(context, new AICostCalculator(context), redaction),
            new AIContextBuilder(conversationService, promptBuilder, new AITokenEstimator()),
            registry,
            provider,
            new AIModelRouter(options),
            promptBuilder,
            entitlements,
            usage,
            new AIActionService(context, []),
            budgetResolver,
            options);

        return new Harness(orchestrator, context, provider, usage, entitlements, conversation.Id);
    }

    // Отговор без инструменти: запазва съобщението и таксува веднъж
    [Fact]
    public async Task Send_NoToolCalls_PersistsAssistantMessageAndCommitsUsage()
    {
        using var db = new SqliteTestDatabase();
        var provider = new FakeAICompletionProvider().EnqueueText("Train legs today.");
        var harness = await CreateAsync(db, provider);

        var response = await harness.Orchestrator.SendAsync(
            harness.ConversationId,
            new SendAIMessageRequest { Content = "What should I train?" },
            SqliteTestDatabase.UserId);

        Assert.Equal("Train legs today.", response.Message.Content);
        Assert.Single(harness.Usage.Committed);
        Assert.Empty(harness.Usage.Released);

        var run = await harness.Context.AIRuns.AsNoTracking().SingleAsync();
        Assert.Equal(AIRunStatus.Completed, run.Status);
        Assert.Equal(10, run.InputTokens);
        Assert.Equal("system-v1", run.PromptVersion);
        Assert.Equal(2, await harness.Context.AIMessages.CountAsync()); // user + assistant
    }

    // Инструмент се изпълнява, после моделът отговаря
    [Fact]
    public async Task Send_WithReadToolCall_ExecutesToolThenAnswers()
    {
        using var db = new SqliteTestDatabase();
        var tool = new FakeEchoToolHandler();
        var provider = new FakeAICompletionProvider()
            .EnqueueToolCall("call-1", tool.Name, """{"value":"hello"}""")
            .EnqueueText("Done.");
        var harness = await CreateAsync(db, provider, tools: [tool]);

        var response = await harness.Orchestrator.SendAsync(
            harness.ConversationId,
            new SendAIMessageRequest { Content = "Use the tool." },
            SqliteTestDatabase.UserId);

        Assert.Equal("Done.", response.Message.Content);
        Assert.Contains(tool.Name, response.UsedTools);
        Assert.Single(tool.Calls);

        var execution = await harness.Context.AIToolExecutions.AsNoTracking().SingleAsync();
        Assert.Equal(AIToolExecutionStatus.Completed, execution.Status);
        Assert.Equal("call-1", execution.ToolCallId);

        var run = await harness.Context.AIRuns.AsNoTracking().SingleAsync();
        Assert.Equal(1, run.ToolCallCount);
        Assert.Equal(20, run.InputTokens); // accumulated over both provider calls
    }

    // Достигнат лимит на итерации: маркира LimitExceeded и освобождава квотата
    [Fact]
    public async Task Send_ToolIterationLimitReached_MarksLimitExceededAndReleasesUsage()
    {
        using var db = new SqliteTestDatabase();
        var tool = new FakeEchoToolHandler();
        var provider = new FakeAICompletionProvider();
        for (var i = 0; i < 3; i++)
        {
            provider.EnqueueToolCall($"call-{i}", tool.Name, """{"value":"loop"}""");
        }

        var harness = await CreateAsync(db, provider, maxIterations: 3, tools: [tool]);

        // The user gets a readable reply rather than an error, so the thread stays coherent, but
        // the run still records that a ceiling stopped it.
        var response = await harness.Orchestrator.SendAsync(
            harness.ConversationId,
            new SendAIMessageRequest { Content = "Loop forever." },
            SqliteTestDatabase.UserId);

        Assert.Equal(AIMessageRole.Assistant, response.Message.Role);
        Assert.False(string.IsNullOrWhiteSpace(response.Message.Content));

        var run = await harness.Context.AIRuns.AsNoTracking().SingleAsync();
        Assert.Equal(AIRunStatus.LimitExceeded, run.Status);
        Assert.Equal(response.Message.Id, run.AssistantMessageId);
        Assert.Single(harness.Usage.Released);
        Assert.Empty(harness.Usage.Committed);
    }

    // Отказ от доставчика: маркира Failed и освобождава квотата
    [Fact]
    public async Task Send_ProviderFailure_FailsRunAndReleasesUsage()
    {
        using var db = new SqliteTestDatabase();
        var provider = new FakeAICompletionProvider { ThrowOnCall = new AIProviderException("upstream exploded") };
        var harness = await CreateAsync(db, provider);

        await Assert.ThrowsAsync<AIProviderException>(() =>
            harness.Orchestrator.SendAsync(
                harness.ConversationId,
                new SendAIMessageRequest { Content = "Hi" },
                SqliteTestDatabase.UserId));

        var run = await harness.Context.AIRuns.AsNoTracking().SingleAsync();
        Assert.Equal(AIRunStatus.Failed, run.Status);
        Assert.Single(harness.Usage.Released);
        Assert.Empty(harness.Usage.Committed);
    }

    // Изключена функция: хвърля преди какъвто и да е разговор с доставчика
    [Fact]
    public async Task Send_FeatureDisabled_ThrowsBeforeCallingProvider()
    {
        using var db = new SqliteTestDatabase();
        var provider = new FakeAICompletionProvider();
        var harness = await CreateAsync(db, provider);
        harness.Entitlements.DisabledFeatures.Add(SubscriptionFeature.AIChat);

        await Assert.ThrowsAsync<SubscriptionFeatureDisabledException>(() =>
            harness.Orchestrator.SendAsync(
                harness.ConversationId,
                new SendAIMessageRequest { Content = "Hi" },
                SqliteTestDatabase.UserId));

        Assert.Empty(provider.Requests);
        Assert.Empty(await harness.Context.AIRuns.ToListAsync());
        Assert.Empty(harness.Usage.Reserved);
    }

    // Непознат инструмент: отхвърля се, но моделът може да продължи
    [Fact]
    public async Task Send_UnknownTool_IsRejectedAndRunStillCompletes()
    {
        using var db = new SqliteTestDatabase();
        var provider = new FakeAICompletionProvider()
            .EnqueueToolCall("call-1", "no_such_tool", "{}")
            .EnqueueText("Sorry, I could not do that.");
        var harness = await CreateAsync(db, provider);

        var response = await harness.Orchestrator.SendAsync(
            harness.ConversationId,
            new SendAIMessageRequest { Content = "Do the impossible." },
            SqliteTestDatabase.UserId);

        Assert.Equal("Sorry, I could not do that.", response.Message.Content);
        var execution = await harness.Context.AIToolExecutions.AsNoTracking().SingleAsync();
        Assert.Equal(AIToolExecutionStatus.Rejected, execution.Status);
        Assert.Equal("tool_not_found", execution.ErrorCode);
        Assert.Single(harness.Usage.Committed);
    }

    // Скрит за потребителя инструмент не се изпълнява
    [Fact]
    public async Task Send_UnavailableTool_IsRejectedWithoutExecuting()
    {
        using var db = new SqliteTestDatabase();
        var tool = new FakeEchoToolHandler { Available = false };
        var provider = new FakeAICompletionProvider()
            .EnqueueToolCall("call-1", tool.Name, """{"value":"x"}""")
            .EnqueueText("Not available.");
        var harness = await CreateAsync(db, provider, tools: [tool]);

        await harness.Orchestrator.SendAsync(
            harness.ConversationId,
            new SendAIMessageRequest { Content = "Use it." },
            SqliteTestDatabase.UserId);

        Assert.Empty(tool.Calls);
        var execution = await harness.Context.AIToolExecutions.AsNoTracking().SingleAsync();
        Assert.Equal(AIToolExecutionStatus.Rejected, execution.Status);
        Assert.Equal("tool_not_available", execution.ErrorCode);
    }

    // Невалиден JSON за аргументи се отхвърля, без да стига до инструмента
    [Fact]
    public async Task Send_InvalidToolArguments_AreRejected()
    {
        using var db = new SqliteTestDatabase();
        var tool = new FakeEchoToolHandler();
        var provider = new FakeAICompletionProvider()
            .EnqueueToolCall("call-1", tool.Name, "not json")
            .EnqueueText("Recovered.");
        var harness = await CreateAsync(db, provider, tools: [tool]);

        await harness.Orchestrator.SendAsync(
            harness.ConversationId,
            new SendAIMessageRequest { Content = "Break it." },
            SqliteTestDatabase.UserId);

        Assert.Empty(tool.Calls);
        var execution = await harness.Context.AIToolExecutions.AsNoTracking().SingleAsync();
        Assert.Equal("invalid_arguments", execution.ErrorCode);
    }

    // Провалил се инструмент не убива изпълнението
    [Fact]
    public async Task Send_ToolThrows_RunStillCompletesAndRecordsFailure()
    {
        using var db = new SqliteTestDatabase();
        var tool = new FakeEchoToolHandler { ThrowOnExecute = new InvalidOperationException("boom") };
        var provider = new FakeAICompletionProvider()
            .EnqueueToolCall("call-1", tool.Name, """{"value":"x"}""")
            .EnqueueText("Handled.");
        var harness = await CreateAsync(db, provider, tools: [tool]);

        var response = await harness.Orchestrator.SendAsync(
            harness.ConversationId,
            new SendAIMessageRequest { Content = "Use it." },
            SqliteTestDatabase.UserId);

        Assert.Equal("Handled.", response.Message.Content);
        var execution = await harness.Context.AIToolExecutions.AsNoTracking().SingleAsync();
        Assert.Equal(AIToolExecutionStatus.Failed, execution.Status);
        Assert.Equal("tool_failed", execution.ErrorCode);
    }

    // Чужд разговор: не се стига до доставчика
    [Fact]
    public async Task Send_OtherUsersConversation_Throws()
    {
        using var db = new SqliteTestDatabase();
        var provider = new FakeAICompletionProvider().EnqueueText("nope");
        var harness = await CreateAsync(db, provider);

        await Assert.ThrowsAsync<FitMateException>(() =>
            harness.Orchestrator.SendAsync(
                harness.ConversationId,
                new SendAIMessageRequest { Content = "Hi" },
                SqliteTestDatabase.OtherUserId));

        Assert.Empty(provider.Requests);
    }

    // Аргументите на инструмента се редактират, преди да се запишат
    [Fact]
    public async Task Send_ToolArguments_AreRedactedBeforeStorage()
    {
        using var db = new SqliteTestDatabase();
        var tool = new FakeEchoToolHandler();
        var provider = new FakeAICompletionProvider()
            .EnqueueToolCall("call-1", tool.Name, """{"value":"x","apiKey":"sk-live-0123456789abcdefghij"}""")
            .EnqueueText("Done.");
        var harness = await CreateAsync(db, provider, tools: [tool]);

        await harness.Orchestrator.SendAsync(
            harness.ConversationId,
            new SendAIMessageRequest { Content = "Use it." },
            SqliteTestDatabase.UserId);

        var execution = await harness.Context.AIToolExecutions.AsNoTracking().SingleAsync();
        Assert.DoesNotContain("sk-live-0123456789abcdefghij", execution.ArgumentsJson);

        var storedMessages = await harness.Context.AIMessages.AsNoTracking()
            .Where(x => x.Role == AIMessageRole.ToolCall)
            .ToListAsync();
        Assert.All(storedMessages, message =>
            Assert.DoesNotContain("sk-live-0123456789abcdefghij", message.Content));
    }
}
