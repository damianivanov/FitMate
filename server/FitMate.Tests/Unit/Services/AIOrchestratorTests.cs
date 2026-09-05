using FitMate.Core.Exceptions;
using FitMate.DB.Enums;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Tests.Unit.Services;

public class AIOrchestratorTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task ProviderReturnsAfterLeaseChanges_DoesNotFinalizeAnotherWorkersRun(bool providerFails)
    {
        using var db = new SqliteTestDatabase();
        var provider = new FakeAICompletionProvider().EnqueueText("Stale reply");
        var harness = await WorkerHarness.CreateAsync(db, provider);
        provider.BeforeResponseAsync = async () =>
        {
            await using var other = db.CreateContext();
            await other.AIRuns.ExecuteUpdateAsync(s => s.SetProperty(x => x.LeaseOwner, "worker-b"));
        };
        if (providerFails) provider.ThrowOnCall = new InvalidOperationException("Stale failure");

        await harness.SendAsync("hello");

        var run = await harness.RunRowAsync();
        Assert.Equal(AIRunStatus.Running, run.Status);
        Assert.Equal("worker-b", run.LeaseOwner);
        Assert.Empty(harness.Usage.Committed);
        Assert.Empty(harness.Usage.Released);
        Assert.False(await harness.Context.AIMessages.AnyAsync(x => x.Role == AIMessageRole.Assistant));
        Assert.False(await harness.Context.AIToolExecutions.AnyAsync());
    }

    // Отговор без инструменти: запазва съобщението и таксува веднъж
    [Fact]
    public async Task Send_NoToolCalls_PersistsAssistantMessageAndCommitsUsage()
    {
        using var db = new SqliteTestDatabase();
        var provider = new FakeAICompletionProvider().EnqueueText("Train legs today.");
        var harness = await WorkerHarness.CreateAsync(db, provider);

        await harness.SendAsync("What should I train?");

        Assert.Equal("Train legs today.", (await harness.LastAssistantMessageAsync()).Content);
        Assert.Single(harness.Usage.Committed);
        Assert.Empty(harness.Usage.Released);

        var run = await harness.RunRowAsync();
        Assert.Equal(AIRunStatus.Completed, run.Status);
        Assert.Equal(10, run.InputTokens);
        Assert.Equal("system-v2", run.PromptVersion);
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
        var harness = await WorkerHarness.CreateAsync(db, provider, tools: [tool]);

        var started = await harness.SendAsync("Use the tool.");

        Assert.Equal("Done.", (await harness.LastAssistantMessageAsync()).Content);
        Assert.Contains(tool.Name, await harness.UsedToolsAsync(started.RunId));
        Assert.Single(tool.Calls);

        var execution = await harness.Context.AIToolExecutions.AsNoTracking().SingleAsync();
        Assert.Equal(AIToolExecutionStatus.Completed, execution.Status);
        Assert.Equal("call-1", execution.ToolCallId);

        var run = await harness.RunRowAsync();
        Assert.Equal(1, run.ToolCallCount);
        Assert.Equal(20, run.InputTokens); // accumulated over both provider calls
    }

    // Празен отговор от модела: не записва празно съобщение, а обяснява какво стана
    [Fact]
    public async Task Send_EmptyCompletion_ReplacesBlankReplyWithNoticeAndReleasesUsage()
    {
        using var db = new SqliteTestDatabase();
        var provider = new FakeAICompletionProvider().EnqueueEmpty();
        var harness = await WorkerHarness.CreateAsync(db, provider);

        await harness.SendAsync("Build me a 14 week program.");

        // The blank bubble was the bug: the user could not tell a finished run from a hung one.
        var reply = await harness.LastAssistantMessageAsync();
        Assert.Equal(AIMessageRole.Assistant, reply.Role);
        Assert.False(string.IsNullOrWhiteSpace(reply.Content));

        var run = await harness.RunRowAsync();
        Assert.Equal(AIRunStatus.LimitExceeded, run.Status);
        Assert.Equal("output_token_limit", run.ErrorCode);
        Assert.Equal(reply.Id, run.AssistantMessageId);
        Assert.Single(harness.Usage.Released);
        Assert.Empty(harness.Usage.Committed);
    }

    // Празен отговор без "Length": пак не записва празно съобщение
    [Fact]
    public async Task Send_EmptyCompletionWithoutLengthReason_IsStillReportedAsEmpty()
    {
        using var db = new SqliteTestDatabase();
        var provider = new FakeAICompletionProvider().EnqueueEmpty(finishReason: "Stop", outputTokens: 12);
        var harness = await WorkerHarness.CreateAsync(db, provider);

        await harness.SendAsync("Hello?");

        Assert.False(string.IsNullOrWhiteSpace((await harness.LastAssistantMessageAsync()).Content));

        var run = await harness.RunRowAsync();
        Assert.Equal(AIRunStatus.LimitExceeded, run.Status);
        Assert.Equal("empty_response", run.ErrorCode);
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

        var harness = await WorkerHarness.CreateAsync(db, provider, maxIterations: 3, tools: [tool]);

        // The user gets a readable reply rather than an error, so the thread stays coherent, but
        // the run still records that a ceiling stopped it.
        await harness.SendAsync("Loop forever.");

        var reply = await harness.LastAssistantMessageAsync();
        Assert.Equal(AIMessageRole.Assistant, reply.Role);
        Assert.False(string.IsNullOrWhiteSpace(reply.Content));

        var run = await harness.RunRowAsync();
        Assert.Equal(AIRunStatus.LimitExceeded, run.Status);
        Assert.Equal(reply.Id, run.AssistantMessageId);
        Assert.Single(harness.Usage.Released);
        Assert.Empty(harness.Usage.Committed);
    }

    // Отказ от доставчика: маркира Failed и освобождава квотата
    [Fact]
    public async Task Send_ProviderFailure_FailsRunAndReleasesUsage()
    {
        using var db = new SqliteTestDatabase();
        var provider = new FakeAICompletionProvider { ThrowOnCall = new AIProviderException("upstream exploded") };
        var harness = await WorkerHarness.CreateAsync(db, provider);

        // The worker has no caller to surface an exception to, so the failure is recorded rather
        // than thrown; the user reads it back from the run snapshot.
        await harness.SendAsync("Hi");

        var run = await harness.RunRowAsync();
        Assert.Equal(AIRunStatus.Failed, run.Status);
        Assert.Single(harness.Usage.Released);
        Assert.Empty(harness.Usage.Committed);
        Assert.Equal(nameof(AIProviderException), run.ErrorCode);

        // The thread still ends on a reply rather than on the user's unanswered message.
        Assert.Equal(AIMessageRole.Assistant, (await harness.LastAssistantMessageAsync()).Role);
    }

    // Изключена функция: хвърля преди какъвто и да е разговор с доставчика
    [Fact]
    public async Task Send_FeatureDisabled_ThrowsBeforeCallingProvider()
    {
        using var db = new SqliteTestDatabase();
        var provider = new FakeAICompletionProvider();
        var harness = await WorkerHarness.CreateAsync(db, provider);
        harness.Entitlements.DisabledFeatures.Add(SubscriptionFeature.AIChat);

        await Assert.ThrowsAsync<SubscriptionFeatureDisabledException>(() => harness.StartAsync("Hi"));

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
        var harness = await WorkerHarness.CreateAsync(db, provider);

        await harness.SendAsync("Do the impossible.");

        Assert.Equal("Sorry, I could not do that.", (await harness.LastAssistantMessageAsync()).Content);

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
        var harness = await WorkerHarness.CreateAsync(db, provider, tools: [tool]);

        await harness.SendAsync("Use it.");

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
        var harness = await WorkerHarness.CreateAsync(db, provider, tools: [tool]);

        await harness.SendAsync("Break it.");

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
        var harness = await WorkerHarness.CreateAsync(db, provider, tools: [tool]);

        await harness.SendAsync("Use it.");

        Assert.Equal("Handled.", (await harness.LastAssistantMessageAsync()).Content);
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
        var harness = await WorkerHarness.CreateAsync(db, provider);

        await Assert.ThrowsAsync<FitMateException>(() => harness.Starter.StartAsync(
            harness.ConversationId,
            new Core.JsonModels.AI.SendAIMessageRequest { Content = "Hi", ClientRequestId = "req-other" },
            SqliteTestDatabase.OtherUserId));

        Assert.Empty(provider.Requests);
        Assert.Empty(await harness.Context.AIRuns.ToListAsync());
    }

    // Аргументите на инструмента се редактират преди запис
    [Fact]
    public async Task Send_ToolArguments_AreRedactedBeforeStorage()
    {
        using var db = new SqliteTestDatabase();
        var tool = new FakeEchoToolHandler();
        var provider = new FakeAICompletionProvider()
            .EnqueueToolCall("call-1", tool.Name, """{"value":"x","apiKey":"sk-live-0123456789abcdefghij"}""")
            .EnqueueText("Done.");
        var harness = await WorkerHarness.CreateAsync(db, provider, tools: [tool]);

        await harness.SendAsync("Use it.");

        var execution = await harness.Context.AIToolExecutions.AsNoTracking().SingleAsync();
        Assert.DoesNotContain("sk-live-0123456789abcdefghij", execution.ArgumentsJson);

        var storedMessages = await harness.Context.AIMessages.AsNoTracking()
            .Where(x => x.Role == AIMessageRole.ToolCall)
            .ToListAsync();
        Assert.All(storedMessages, message =>
            Assert.DoesNotContain("sk-live-0123456789abcdefghij", message.Content));
    }

    // Няколко инструмента в един прогон: таксува се веднъж, всяко изпълнение се записва
    [Fact]
    public async Task Send_MultipleToolCalls_CommitsUsageOnceAndRecordsEveryExecution()
    {
        using var db = new SqliteTestDatabase();
        var profileTool = new FakeEchoToolHandler("get_training_profile");
        var workoutsTool = new FakeEchoToolHandler("get_recent_workouts");
        var provider = new FakeAICompletionProvider()
            .EnqueueToolCall("call-1", profileTool.Name, "{}")
            .EnqueueToolCall("call-2", workoutsTool.Name, "{}")
            .EnqueueText("Here is your plan.");

        var harness = await WorkerHarness.CreateAsync(db, provider, tools: [profileTool, workoutsTool]);

        var started = await harness.SendAsync("Plan my week.");

        Assert.Single(harness.Usage.Committed);
        Assert.Empty(harness.Usage.Released);

        var run = await harness.RunRowAsync();
        Assert.Equal(AIRunStatus.Completed, run.Status);
        Assert.Equal(2, run.ToolCallCount);
        Assert.NotNull(run.AssistantMessageId);

        Assert.Equal(
            ["get_training_profile", "get_recent_workouts"],
            await harness.UsedToolsAsync(started.RunId));
    }
}
