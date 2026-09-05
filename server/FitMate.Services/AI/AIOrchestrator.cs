using FitMate.Core.Exceptions;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Integrations.AI.Abstractions;
using FitMate.Integrations.AI.Models;
using FitMate.Integrations.AI.Serialization;
using FitMate.Services.AI.Runs;
using FitMate.Services.AI.Tools;
using FitMate.Services.Subscriptions;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.AI;

/// <summary>
/// The bounded tool loop, driven by a worker rather than an HTTP request. The loop can never spin
/// forever, the reserved usage is either committed once or released once, and every exit path
/// writes exactly one terminal progress event.
/// </summary>
public class AIOrchestrator : IAIOrchestrator
{
    private readonly AppDbContext dbContext;
    private readonly IAIConversationService conversationService;
    private readonly IAIRunService runService;
    private readonly IAIRunQueue runQueue;
    private readonly IAIProgressService progressService;
    private readonly IAIContextBuilder contextBuilder;
    private readonly IAIToolRegistry toolRegistry;
    private readonly IAICompletionProvider completionProvider;
    private readonly IUsageService usageService;
    private readonly IAIBudgetResolver budgetResolver;

    public AIOrchestrator(
        AppDbContext dbContext,
        IAIConversationService conversationService,
        IAIRunService runService,
        IAIRunQueue runQueue,
        IAIProgressService progressService,
        IAIContextBuilder contextBuilder,
        IAIToolRegistry toolRegistry,
        IAICompletionProvider completionProvider,
        IUsageService usageService,
        IAIBudgetResolver budgetResolver)
    {
        this.dbContext = dbContext;
        this.conversationService = conversationService;
        this.runService = runService;
        this.runQueue = runQueue;
        this.progressService = progressService;
        this.contextBuilder = contextBuilder;
        this.toolRegistry = toolRegistry;
        this.completionProvider = completionProvider;
        this.usageService = usageService;
        this.budgetResolver = budgetResolver;
    }

    public async Task ProcessAsync(long runId, string workerId, CancellationToken cancellationToken)
    {
        var run = await dbContext.AIRuns.AsNoTracking().FirstOrDefaultAsync(x => x.Id == runId, cancellationToken)
            ?? throw new KeyNotFoundException("AI run not found.");

        // Another worker reclaimed this run between the claim and here.
        if (run.Status != AIRunStatus.Running || run.LeaseOwner != workerId)
        {
            return;
        }

        var budget = ResolveBudget(run) ?? await budgetResolver.ResolveAsync(run.UserId);
        var conversationId = run.ConversationId;
        var userId = run.UserId;

        await progressService.PublishAsync(run.Id, AIProgressCodes.RunStarted, null, cancellationToken);

        try
        {
            await RunLoopAsync(run, budget, workerId, cancellationToken);
        }
        catch (OperationCanceledException)
        {
            // Only a run that already touched something has to be written off here. A clean one is
            // left Running so the worker can hand it back to the queue for a safe retry.
            if (!await HasSideEffectsAsync(run.Id))
            {
                throw;
            }

            await runService.MarkCancelledAsync(run.Id);
            await ReleaseAsync(run);
            await FinishAsync(run, AIProgressCodes.RunCancelled);
        }
        catch (Exception exception)
        {
            await runService.FailAsync(run.Id, exception);
            await ReleaseAsync(run);

            // Leave the thread readable: without this the conversation ends on the user's message
            // with no reply, which looks like the assistant simply never answered.
            try
            {
                await conversationService.AddAssistantMessageAsync(
                    conversationId,
                    "Something went wrong while I was working on that. Please try again.",
                    userId,
                    runId: run.Id);
            }
            catch (Exception)
            {
                // The original failure is what matters; never mask it with a logging failure.
            }

            await FinishAsync(run, AIProgressCodes.RunFailed);
        }
    }

    private async Task RunLoopAsync(AIRun run, AIBudget budget, string workerId, CancellationToken cancellationToken)
    {
        var conversationId = run.ConversationId;
        var userId = run.UserId;

        var messages = await contextBuilder.BuildAsync(conversationId, userId, budget, run.Id, cancellationToken);
        var toolContext = new AIToolContext
        {
            UserId = userId,
            ConversationId = conversationId,
            AIRunId = run.Id,
            IsAdmin = false,
        };

        var providerTools = toolRegistry.GetDefinitions(toolContext)
            .Select(definition => new AIProviderTool
            {
                Name = definition.Name,
                Description = definition.Description,
                ParametersJsonSchema = definition.ParametersJsonSchema,
            })
            .ToList();

        var totalToolCalls = 0;
        var hasRunTools = false;

        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(budget.TimeoutSeconds));

        for (var iteration = 0; iteration < budget.MaximumToolIterations; iteration++)
        {
            // A lost lease means another worker owns this run now. Stop without writing anything:
            // two workers finishing the same run would double-charge and duplicate the reply.
            if (!await runQueue.RenewLeaseAsync(run.Id, workerId, DateTime.UtcNow, cancellationToken))
            {
                return;
            }

            await progressService.PublishAsync(
                run.Id,
                hasRunTools ? AIProgressCodes.ResponseComposing : AIProgressCodes.ProviderThinking,
                null,
                cancellationToken);

            AICompletionResponse providerResponse;
            try
            {
                providerResponse = await completionProvider.CompleteAsync(
                    new AICompletionRequest
                    {
                        Messages = messages,
                        Tools = providerTools,
                        Model = run.Model,
                        MaxOutputTokens = budget.MaximumOutputTokens,
                    },
                    timeout.Token);
            }
            catch
            {
                // Ignore a late provider failure after recovery transferred the run.
                if (!await OwnsRunAsync(run.Id, workerId)) return;
                throw;
            }

            // A provider call can outlive a lease. Check again before recording its result or
            // starting a proposal; the next iteration's renewal would be too late.
            if (!await runQueue.RenewLeaseAsync(run.Id, workerId, DateTime.UtcNow, cancellationToken))
            {
                return;
            }

            await runService.AddUsageAsync(run.Id, providerResponse.Usage, providerResponse.ProviderRequestId);

            if (providerResponse.ToolCalls.Count == 0)
            {
                // A reasoning model can spend its whole output budget on hidden reasoning tokens and
                // come back with no visible text. Persisting that verbatim stores a blank assistant
                // message, which the user reads as a chat that hung rather than as a failure.
                if (string.IsNullOrWhiteSpace(providerResponse.Text))
                {
                    var ranOutOfTokens = string.Equals(
                        providerResponse.FinishReason, "Length", StringComparison.OrdinalIgnoreCase);

                    await runService.MarkLimitExceededAsync(
                        run.Id,
                        ranOutOfTokens ? "output_token_limit" : "empty_response",
                        ranOutOfTokens
                            ? "The model used its entire output budget before writing a reply."
                            : "The model returned an empty reply.");
                    await ReleaseAsync(run);

                    await StopWithNoticeAsync(
                        run,
                        "I ran out of room before I could write that answer. Ask me for a smaller "
                            + "piece of it — one training week at a time, say — and I'll get through it.");
                    return;
                }

                var assistantMessage = await conversationService.AddAssistantMessageAsync(
                    conversationId,
                    providerResponse.Text,
                    userId,
                    runId: run.Id);

                await runService.CompleteAsync(run.Id, assistantMessage.Id);
                await CommitAsync(run);
                await FinishAsync(run, AIProgressCodes.RunCompleted);
                return;
            }

            totalToolCalls += providerResponse.ToolCalls.Count;
            if (totalToolCalls > budget.MaximumToolCallsPerRun)
            {
                const string message = "The assistant requested too many tools for a single message.";
                await runService.MarkLimitExceededAsync(run.Id, "tool_call_limit", message);
                await ReleaseAsync(run);

                await StopWithNoticeAsync(
                    run,
                    "I got stuck looking things up and stopped before finishing. Could you narrow "
                        + "the request down a little and ask again?");
                return;
            }

            await runService.IncrementToolCallCountAsync(run.Id, providerResponse.ToolCalls.Count);

            // Flipped before the first tool runs, not after: a crash mid-tool must still count as
            // having had side effects, or the run could be replayed and duplicate the work.
            if (!hasRunTools)
            {
                await runService.MarkSideEffectsAsync(run.Id);
                hasRunTools = true;
            }

            foreach (var toolCall in providerResponse.ToolCalls)
            {
                AIToolExecutionResult result;
                try
                {
                    result = await toolRegistry.ExecuteAsync(toolCall, toolContext, timeout.Token);
                }
                catch (AIToolNotFoundException notFound)
                {
                    // The registry already recorded the rejection; hand the failure back to the
                    // model so it can apologise or try another route.
                    result = AIToolExecutionResult.Fail("tool_not_found", notFound.Message);
                }

                var resultJson = result.Success
                    ? AIJsonSerializer.Serialize(new
                    {
                        success = true,
                        requiresConfirmation = result.RequiresConfirmation,
                        aiActionId = result.AIActionId,
                        data = result.Data,
                    })
                    : AIJsonSerializer.Serialize(new
                    {
                        success = false,
                        error = result.ErrorCode,
                        message = result.ErrorMessage,
                    });

                await conversationService.AddToolCallMessageAsync(
                    conversationId, userId, toolCall.Name, toolCall.Id, toolCall.ArgumentsJson, run.Id);
                await conversationService.AddToolResultMessageAsync(
                    conversationId, userId, toolCall.Name, toolCall.Id, resultJson, run.Id);

                messages.Add(AIProviderMessage.FromToolCall(toolCall));
                messages.Add(AIProviderMessage.FromToolResult(toolCall.Id, resultJson));
            }
        }

        const string iterationMessage = "The assistant could not finish within the allowed number of steps.";
        await runService.MarkLimitExceededAsync(run.Id, "tool_iteration_limit", iterationMessage);
        await ReleaseAsync(run);

        await StopWithNoticeAsync(
            run,
            "I ran out of steps before I could finish that. Try asking for one thing at a time — "
                + "for example the exercises first, then the sets and reps.");
    }

    /// <summary>
    /// Ends a run that hit a budget ceiling as a normal assistant turn. The user gets an answer they
    /// can act on instead of an error, and the stored conversation stays coherent when reloaded.
    /// </summary>
    private async Task StopWithNoticeAsync(AIRun run, string notice)
    {
        var assistantMessage = await conversationService.AddAssistantMessageAsync(
            run.ConversationId,
            notice,
            run.UserId,
            runId: run.Id);

        await runService.AttachAssistantMessageAsync(run.Id, assistantMessage.Id);
        await FinishAsync(run, AIProgressCodes.RunLimited);
    }

    /// <summary>
    /// Every exit funnels through here, so the active-run guard is always released and an observer
    /// always sees exactly one terminal event.
    /// </summary>
    private async Task FinishAsync(AIRun run, string terminalCode)
    {
        await runService.ClearActiveRunAsync(run.ConversationId, run.Id);
        await progressService.PublishAsync(run.Id, terminalCode);
    }

    private async Task CommitAsync(AIRun run)
    {
        if (run.UsageReservationId is { } reservationId)
        {
            await usageService.CommitAsync(reservationId);
        }
    }

    private async Task ReleaseAsync(AIRun run)
    {
        if (run.UsageReservationId is { } reservationId)
        {
            await usageService.ReleaseAsync(reservationId);
        }
    }

    private Task<bool> OwnsRunAsync(long runId, string workerId) =>
        dbContext.AIRuns.AsNoTracking().AnyAsync(x => x.Id == runId
            && x.Status == AIRunStatus.Running && x.LeaseOwner == workerId);

    private async Task<bool> HasSideEffectsAsync(long runId) =>
        await dbContext.AIRuns.AsNoTracking()
            .Where(x => x.Id == runId)
            .Select(x => x.HasSideEffects)
            .FirstOrDefaultAsync();

    /// <summary>
    /// The budget is frozen at enqueue so a settings change while the run sat in the queue cannot
    /// alter what it is allowed to spend.
    /// </summary>
    private static AIBudget? ResolveBudget(AIRun run)
    {
        if (string.IsNullOrWhiteSpace(run.ExecutionBudgetJson))
        {
            return null;
        }

        try
        {
            return AIJsonSerializer.Deserialize<AIBudget>(run.ExecutionBudgetJson);
        }
        catch (Exception)
        {
            return null;
        }
    }
}
