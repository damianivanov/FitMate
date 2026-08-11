using FitMate.Core.Exceptions;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Integrations.AI.Models;
using FitMate.Integrations.AI.Serialization;
using FitMate.Services.AI.Runs;
using System.Diagnostics;
using System.Text.Json;

namespace FitMate.Services.AI.Tools;

/// <summary>
/// The allow-list. A tool the container does not know about cannot run, and every attempt — allowed,
/// rejected or failed — is recorded against the run with its own duration.
/// </summary>
public class AIToolRegistry : IAIToolRegistry
{
    private readonly AppDbContext dbContext;
    private readonly IAIRedactionService redactionService;
    private readonly IAIProgressService progressService;
    private readonly IReadOnlyDictionary<string, IAIToolHandler> handlers;

    public AIToolRegistry(
        AppDbContext dbContext,
        IAIRedactionService redactionService,
        IAIProgressService progressService,
        IEnumerable<IAIToolHandler> handlers)
    {
        this.dbContext = dbContext;
        this.redactionService = redactionService;
        this.progressService = progressService;
        this.handlers = handlers.ToDictionary(handler => handler.Name, StringComparer.Ordinal);
    }

    public IReadOnlyList<AIToolDefinition> GetDefinitions(AIToolContext context) =>
        handlers.Values
            .Where(handler => handler.IsAvailable(context))
            .Select(handler => handler.Definition)
            .OrderBy(definition => definition.Name, StringComparer.Ordinal)
            .ToList();

    public async Task<AIToolExecutionResult> ExecuteAsync(
        AIProviderToolCall toolCall,
        AIToolContext context,
        CancellationToken cancellationToken)
    {
        var execution = new AIToolExecution
        {
            AIRunId = context.AIRunId,
            ToolCallId = toolCall.Id,
            ToolName = toolCall.Name,
            ArgumentsJson = redactionService.RedactJson(toolCall.ArgumentsJson),
            Status = AIToolExecutionStatus.Running,
            StartedAt = DateTime.UtcNow,
        };

        dbContext.AIToolExecutions.Add(execution);
        await dbContext.SaveChangesAsync(cancellationToken);

        // Published from the same lifecycle as the audit row, so the two can never disagree about
        // what the assistant actually did.
        await progressService.PublishAsync(
            context.AIRunId, AIProgressCodes.ToolStarted, toolCall.Name, cancellationToken);

        var stopwatch = Stopwatch.StartNew();

        if (!handlers.TryGetValue(toolCall.Name, out var handler))
        {
            await CompleteAsync(execution, stopwatch, AIToolExecutionStatus.Rejected, "tool_not_found",
                $"'{toolCall.Name}' is not a registered tool.", cancellationToken);
            throw new AIToolNotFoundException($"'{toolCall.Name}' is not a registered tool.");
        }

        if (!handler.IsAvailable(context))
        {
            var result = AIToolExecutionResult.Fail(
                "tool_not_available",
                $"'{toolCall.Name}' is not available for this account.");
            await CompleteAsync(execution, stopwatch, AIToolExecutionStatus.Rejected, result.ErrorCode,
                result.ErrorMessage, cancellationToken);
            return result;
        }

        if (!IsValidJson(toolCall.ArgumentsJson))
        {
            var result = AIToolExecutionResult.Fail(
                "invalid_arguments",
                "The tool arguments were not valid JSON.");
            await CompleteAsync(execution, stopwatch, AIToolExecutionStatus.Rejected, result.ErrorCode,
                result.ErrorMessage, cancellationToken);
            return result;
        }

        try
        {
            var result = await handler.ExecuteAsync(toolCall.ArgumentsJson, context, cancellationToken);

            execution.ResultJson = redactionService.RedactJson(SerializeResult(result));
            await CompleteAsync(
                execution,
                stopwatch,
                result.Success ? AIToolExecutionStatus.Completed : AIToolExecutionStatus.Failed,
                result.ErrorCode,
                result.ErrorMessage,
                cancellationToken);

            return result;
        }
        catch (OperationCanceledException)
        {
            await CompleteAsync(execution, stopwatch, AIToolExecutionStatus.Failed, "cancelled",
                "The tool was cancelled.", CancellationToken.None);
            throw;
        }
        catch (Exception exception)
        {
            // A failing tool must not kill the run: the orchestrator hands the failure back to the
            // model so it can recover or explain.
            var message = redactionService.RedactText(exception.Message);
            await CompleteAsync(execution, stopwatch, AIToolExecutionStatus.Failed, "tool_failed",
                message, cancellationToken);
            return AIToolExecutionResult.Fail("tool_failed", message);
        }
    }

    private async Task CompleteAsync(
        AIToolExecution execution,
        Stopwatch stopwatch,
        AIToolExecutionStatus status,
        string? errorCode,
        string? errorMessage,
        CancellationToken cancellationToken)
    {
        stopwatch.Stop();
        execution.Status = status;
        execution.DurationMilliseconds = (int)stopwatch.ElapsedMilliseconds;
        execution.ErrorCode = errorCode;
        execution.ErrorMessage = errorMessage;
        execution.CompletedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        await progressService.PublishAsync(
            execution.AIRunId,
            status == AIToolExecutionStatus.Completed ? AIProgressCodes.ToolCompleted : AIProgressCodes.ToolFailed,
            execution.ToolName,
            cancellationToken);
    }

    private static string SerializeResult(AIToolExecutionResult result) =>
        result.Success
            ? AIJsonSerializer.Serialize(new
            {
                success = true,
                requiresConfirmation = result.RequiresConfirmation,
                data = result.Data,
                aiActionId = result.AIActionId,
            })
            : AIJsonSerializer.Serialize(new
            {
                success = false,
                error = result.ErrorCode,
                message = result.ErrorMessage,
            });

    private static bool IsValidJson(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return false;
        }

        try
        {
            using var _ = JsonDocument.Parse(json);
            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }
}
