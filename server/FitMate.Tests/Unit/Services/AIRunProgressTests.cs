using FitMate.Core.Exceptions;
using FitMate.DB.Enums;
using FitMate.Services.AI.Runs;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Tests.Unit.Services;

public class AIRunProgressTests
{
    // Прогон без инструменти: подредена последователност до завършване
    [Fact]
    public async Task NoToolRun_EmitsQueuedStartedThinkingCompleted()
    {
        using var db = new SqliteTestDatabase();
        var provider = new FakeAICompletionProvider().EnqueueText("Done.");
        var harness = await WorkerHarness.CreateAsync(db, provider);

        var started = await harness.SendAsync("hi");

        Assert.Equal(
            [
                AIProgressCodes.RunQueued,
                AIProgressCodes.RunStarted,
                AIProgressCodes.ProviderThinking,
                AIProgressCodes.RunCompleted,
            ],
            await harness.ProgressCodesAsync(started.RunId));
    }

    // Инструментите се съобщават по име, без никакви полезни товари
    [Fact]
    public async Task ToolRun_EmitsToolStartedAndCompleted_WithoutLeakingPayloads()
    {
        using var db = new SqliteTestDatabase();
        var tool = new FakeEchoToolHandler("get_training_profile");
        var provider = new FakeAICompletionProvider()
            .EnqueueToolCall("call-1", tool.Name, """{"value":"do-not-leak"}""")
            .EnqueueText("Here you go.");
        var harness = await WorkerHarness.CreateAsync(db, provider, tools: [tool]);

        var started = await harness.SendAsync("profile?");

        var events = await harness.Context.AIProgressEvents.AsNoTracking()
            .Where(x => x.AIRunId == started.RunId)
            .OrderBy(x => x.Id)
            .ToListAsync();

        Assert.Contains(events, x => x.Code == AIProgressCodes.ToolStarted && x.ToolName == "get_training_profile");
        Assert.Contains(events, x => x.Code == AIProgressCodes.ToolCompleted && x.ToolName == "get_training_profile");
        Assert.Contains(events, x => x.Code == AIProgressCodes.ResponseComposing);

        // A progress row carries a code and a registered tool name. Nothing else.
        Assert.All(events, x => Assert.DoesNotContain("do-not-leak", x.Code));
        Assert.All(events, x => Assert.DoesNotContain("do-not-leak", x.ToolName ?? string.Empty));
    }

    // Успешният прогон освобождава разговора и таксува веднъж
    [Fact]
    public async Task CompletedRun_ClearsActiveRunAndCommitsQuotaOnce()
    {
        using var db = new SqliteTestDatabase();
        var provider = new FakeAICompletionProvider().EnqueueText("Done.");
        var harness = await WorkerHarness.CreateAsync(db, provider);

        await harness.SendAsync("hi");

        var conversation = await harness.Context.AIConversations.AsNoTracking().SingleAsync();
        Assert.Null(conversation.ActiveRunId);
        Assert.Single(harness.Usage.Committed);
        Assert.Empty(harness.Usage.Released);
    }

    // Провал: точно едно терминално събитие, освободена квота, освободен разговор
    [Fact]
    public async Task FailedRun_EmitsOneTerminalEvent_ReleasesQuota_AndClearsActiveRun()
    {
        using var db = new SqliteTestDatabase();
        var provider = new FakeAICompletionProvider { ThrowOnCall = new AIProviderException("boom") };
        var harness = await WorkerHarness.CreateAsync(db, provider);

        var started = await harness.SendAsync("hi");

        var codes = await harness.ProgressCodesAsync(started.RunId);
        Assert.Single(codes, code => AIProgressCodes.IsTerminal(code));
        Assert.Contains(AIProgressCodes.RunFailed, codes);

        Assert.Single(harness.Usage.Released);
        Assert.Empty(harness.Usage.Committed);

        var conversation = await harness.Context.AIConversations.AsNoTracking().SingleAsync();
        Assert.Null(conversation.ActiveRunId);
        Assert.Equal(AIRunStatus.Failed, (await harness.RunRowAsync()).Status);
    }

    // Достигнат таван: терминалното събитие е run_limited
    [Fact]
    public async Task LimitedRun_EmitsSingleLimitedTerminalEvent()
    {
        using var db = new SqliteTestDatabase();
        var tool = new FakeEchoToolHandler();
        var provider = new FakeAICompletionProvider();
        for (var i = 0; i < 2; i++)
        {
            provider.EnqueueToolCall($"call-{i}", tool.Name, """{"value":"loop"}""");
        }

        var harness = await WorkerHarness.CreateAsync(db, provider, maxIterations: 2, tools: [tool]);

        var started = await harness.SendAsync("Loop forever.");

        var codes = await harness.ProgressCodesAsync(started.RunId);
        Assert.Single(codes, code => AIProgressCodes.IsTerminal(code));
        Assert.Contains(AIProgressCodes.RunLimited, codes);

        var conversation = await harness.Context.AIConversations.AsNoTracking().SingleAsync();
        Assert.Null(conversation.ActiveRunId);
    }

    // Изпълнен инструмент прави прогона невъзстановим за преиграване
    [Fact]
    public async Task ToolExecution_SetsHasSideEffects()
    {
        using var db = new SqliteTestDatabase();
        var tool = new FakeEchoToolHandler("get_training_profile");
        var provider = new FakeAICompletionProvider()
            .EnqueueToolCall("call-1", tool.Name, "{}")
            .EnqueueText("Done.");
        var harness = await WorkerHarness.CreateAsync(db, provider, tools: [tool]);

        await harness.SendAsync("hi");

        Assert.True((await harness.RunRowAsync()).HasSideEffects);
    }

    // Прогон без инструменти остава безопасен за повторен опит
    [Fact]
    public async Task RunWithoutTools_LeavesHasSideEffectsFalse()
    {
        using var db = new SqliteTestDatabase();
        var provider = new FakeAICompletionProvider().EnqueueText("Done.");
        var harness = await WorkerHarness.CreateAsync(db, provider);

        await harness.SendAsync("hi");

        Assert.False((await harness.RunRowAsync()).HasSideEffects);
    }

    // Съобщенията се връзват към прогона, който ги е произвел
    [Fact]
    public async Task Messages_AreLinkedToTheRunThatProducedThem()
    {
        using var db = new SqliteTestDatabase();
        var tool = new FakeEchoToolHandler();
        var provider = new FakeAICompletionProvider()
            .EnqueueToolCall("call-1", tool.Name, """{"value":"x"}""")
            .EnqueueText("Done.");
        var harness = await WorkerHarness.CreateAsync(db, provider, tools: [tool]);

        var started = await harness.SendAsync("hi");

        var messages = await harness.Context.AIMessages.AsNoTracking().ToListAsync();
        Assert.NotEmpty(messages);
        Assert.All(messages, message => Assert.Equal(started.RunId, message.AIRunId));
    }

    // Загубен наем: прогонът се изоставя, без да пише терминално състояние
    [Fact]
    public async Task LostLease_StopsWithoutWritingTerminalState()
    {
        using var db = new SqliteTestDatabase();
        var provider = new FakeAICompletionProvider().EnqueueText("Done.");
        var harness = await WorkerHarness.CreateAsync(db, provider);

        var started = await harness.StartAsync("hi");
        await harness.Queue.ClaimNextAsync("worker-a", DateTime.UtcNow, CancellationToken.None);

        // A different worker now owns the run, so this one must not touch it.
        await harness.Orchestrator.ProcessAsync(started.RunId, "worker-b", CancellationToken.None);

        Assert.Empty(provider.Requests);
        Assert.Empty(harness.Usage.Committed);
        Assert.Empty(harness.Usage.Released);
        Assert.Equal(AIRunStatus.Running, (await harness.RunRowAsync()).Status);
    }
}
