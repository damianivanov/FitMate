using FitMate.Core.JsonModels.AI;
using FitMate.Core.Settings;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.AI;
using FitMate.Services.AI.Runs;
using FitMate.Services.AI.Tools;
using FitMate.Services.AIActions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace FitMate.Tests.TestInfrastructure;

/// <summary>
/// Start-then-process, the way the worker does it. Tests drive the same path production does:
/// enqueue through the starter, claim through the queue, execute through the orchestrator.
/// </summary>
public sealed class WorkerHarness
{
    private const string WorkerId = "test-worker";

    private int nextRequestId = 1;

    private WorkerHarness(
        AIRunStarter starter,
        AIRunQueue queue,
        AIOrchestrator orchestrator,
        AppDbContext context,
        FakeAICompletionProvider provider,
        FakeUsageService usage,
        FakeEntitlementService entitlements,
        long conversationId)
    {
        Starter = starter;
        Queue = queue;
        Orchestrator = orchestrator;
        Context = context;
        Provider = provider;
        Usage = usage;
        Entitlements = entitlements;
        ConversationId = conversationId;
    }

    public AIRunStarter Starter { get; }
    public AIRunQueue Queue { get; }
    public AIOrchestrator Orchestrator { get; }
    public AppDbContext Context { get; }
    public FakeAICompletionProvider Provider { get; }
    public FakeUsageService Usage { get; }
    public FakeEntitlementService Entitlements { get; }
    public long ConversationId { get; }

    public static async Task<WorkerHarness> CreateAsync(
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

        var runOptions = Options.Create(new AIRunOptions { LeaseSeconds = 180, MaximumSafeAttempts = 2 });

        var progress = new AIProgressService(context);
        var registry = new AIToolRegistry(context, redaction, progress, tools ?? []);
        var usage = new FakeUsageService();
        var entitlements = new FakeEntitlementService();
        var promptBuilder = new AIPromptBuilder();
        var runService = new AIRunService(context, new AICostCalculator(context), redaction);
        var queue = new AIRunQueue(context, progress, runOptions);

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

        var starter = new AIRunStarter(
            context,
            conversationService,
            budgetResolver,
            entitlements,
            usage,
            progress,
            promptBuilder,
            options);

        var orchestrator = new AIOrchestrator(
            context,
            conversationService,
            runService,
            queue,
            progress,
            new AIContextBuilder(conversationService, promptBuilder, new AITokenEstimator()),
            registry,
            provider,
            usage,
            budgetResolver);

        return new WorkerHarness(
            starter, queue, orchestrator, context, provider, usage, entitlements, conversation.Id);
    }

    /// <summary>Enqueues a message without executing it.</summary>
    public async Task<StartAIRunResponse> StartAsync(string content, string? clientRequestId = null) =>
        await Starter.StartAsync(
            ConversationId,
            new SendAIMessageRequest
            {
                Content = content,
                ClientRequestId = clientRequestId ?? $"req-{nextRequestId++}",
            },
            SqliteTestDatabase.UserId);

    /// <summary>Claims and executes the next queued run, exactly as the worker loop would.</summary>
    public async Task ProcessNextAsync()
    {
        var runId = await Queue.ClaimNextAsync(WorkerId, DateTime.UtcNow, CancellationToken.None);
        if (runId != null)
        {
            await Orchestrator.ProcessAsync(runId.Value, WorkerId, CancellationToken.None);
        }
    }

    /// <summary>The full turn: enqueue, then run it to a terminal state.</summary>
    public async Task<StartAIRunResponse> SendAsync(string content, string? clientRequestId = null)
    {
        var started = await StartAsync(content, clientRequestId);
        await ProcessNextAsync();
        return started;
    }

    public async Task<AIRun> RunRowAsync() => await Context.AIRuns.AsNoTracking().SingleAsync();

    public async Task<AIMessage> LastAssistantMessageAsync() =>
        await Context.AIMessages.AsNoTracking()
            .Where(x => x.Role == AIMessageRole.Assistant)
            .OrderByDescending(x => x.Id)
            .FirstAsync();

    public async Task<List<string>> ProgressCodesAsync(long runId) =>
        await Context.AIProgressEvents.AsNoTracking()
            .Where(x => x.AIRunId == runId)
            .OrderBy(x => x.Id)
            .Select(x => x.Code)
            .ToListAsync();

    public async Task<List<string>> UsedToolsAsync(long runId) =>
        await Context.AIToolExecutions.AsNoTracking()
            .Where(x => x.AIRunId == runId)
            .OrderBy(x => x.Id)
            .Select(x => x.ToolName)
            .ToListAsync();
}
