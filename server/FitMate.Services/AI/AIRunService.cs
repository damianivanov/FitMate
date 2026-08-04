using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Integrations.AI.Models;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.AI;

/// <summary>
/// Records what every AI run did: provider, model, prompt version, tokens, duration, cost and errors.
/// </summary>
public class AIRunService : IAIRunService
{
    private readonly AppDbContext dbContext;
    private readonly IAICostCalculator costCalculator;
    private readonly IAIRedactionService redactionService;

    public AIRunService(
        AppDbContext dbContext,
        IAICostCalculator costCalculator,
        IAIRedactionService redactionService)
    {
        this.dbContext = dbContext;
        this.costCalculator = costCalculator;
        this.redactionService = redactionService;
    }

    public async Task<AIRun> StartAsync(
        long userId,
        long conversationId,
        string provider,
        string model,
        string promptVersion)
    {
        var run = new AIRun
        {
            UserId = userId,
            ConversationId = conversationId,
            Status = AIRunStatus.Running,
            Provider = provider,
            Model = model,
            PromptVersion = promptVersion,
            StartedAt = DateTime.UtcNow,
        };

        dbContext.AIRuns.Add(run);
        await dbContext.SaveChangesAsync();
        return run;
    }

    public async Task AddUsageAsync(long runId, AIProviderUsage usage, string? providerRequestId)
    {
        var run = await RequireRunAsync(runId);

        // A run makes several provider calls, so usage accumulates.
        run.InputTokens += usage.InputTokens;
        run.OutputTokens += usage.OutputTokens;
        run.CachedInputTokens += usage.CachedInputTokens;

        if (!string.IsNullOrWhiteSpace(providerRequestId))
        {
            run.ProviderRequestId = providerRequestId;
        }

        run.EstimatedCost = await costCalculator.EstimateAsync(
            run.Provider,
            run.Model,
            new AIProviderUsage
            {
                InputTokens = run.InputTokens,
                OutputTokens = run.OutputTokens,
                CachedInputTokens = run.CachedInputTokens,
            },
            run.StartedAt);

        await dbContext.SaveChangesAsync();
    }

    public async Task IncrementToolCallCountAsync(long runId, int count)
    {
        var run = await RequireRunAsync(runId);
        run.ToolCallCount += count;
        await dbContext.SaveChangesAsync();
    }

    public async Task CompleteAsync(long runId, long assistantMessageId)
    {
        var run = await RequireRunAsync(runId);
        run.Status = AIRunStatus.Completed;
        run.AssistantMessageId = assistantMessageId;
        Finish(run);
        await dbContext.SaveChangesAsync();
    }

    public async Task AttachAssistantMessageAsync(long runId, long assistantMessageId)
    {
        var run = await RequireRunAsync(runId);
        run.AssistantMessageId = assistantMessageId;
        await dbContext.SaveChangesAsync();
    }

    public async Task FailAsync(long runId, Exception exception)
    {
        var run = await RequireRunAsync(runId);
        run.Status = AIRunStatus.Failed;
        run.ErrorCode = exception.GetType().Name;
        run.ErrorMessage = redactionService.RedactText(exception.Message);
        Finish(run);
        await dbContext.SaveChangesAsync();
    }

    public async Task MarkLimitExceededAsync(long runId, string errorCode, string errorMessage)
    {
        var run = await RequireRunAsync(runId);
        run.Status = AIRunStatus.LimitExceeded;
        run.ErrorCode = errorCode;
        run.ErrorMessage = redactionService.RedactText(errorMessage);
        Finish(run);
        await dbContext.SaveChangesAsync();
    }

    private static void Finish(AIRun run)
    {
        run.CompletedAt = DateTime.UtcNow;
        run.DurationMilliseconds = (int)Math.Max(0, (run.CompletedAt.Value - run.StartedAt).TotalMilliseconds);
    }

    private async Task<AIRun> RequireRunAsync(long runId) =>
        await dbContext.AIRuns.FirstOrDefaultAsync(x => x.Id == runId)
        ?? throw new KeyNotFoundException("AI run not found.");
}
