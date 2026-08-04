using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.AI;
using FitMate.Core.Settings;
using FitMate.DB.Enums;
using FitMate.Integrations.AI.Abstractions;
using FitMate.Integrations.AI.Models;
using FitMate.Integrations.AI.Serialization;
using FitMate.Core.JsonModels.AIActions;
using FitMate.Services.AI.Tools;
using FitMate.Services.AIActions;
using FitMate.Services.Subscriptions;
using Microsoft.Extensions.Options;

namespace FitMate.Services.AI;

/// <summary>
/// The bounded tool loop. Entitlements and quota are checked before anything runs, the loop can
/// never spin forever, and the reserved usage is either committed once or released once.
/// </summary>
public class AIOrchestrator : IAIOrchestrator
{
    private readonly IAIConversationService conversationService;
    private readonly IAIRunService runService;
    private readonly IAIContextBuilder contextBuilder;
    private readonly IAIToolRegistry toolRegistry;
    private readonly IAICompletionProvider completionProvider;
    private readonly IAIModelRouter modelRouter;
    private readonly IAIPromptBuilder promptBuilder;
    private readonly IEntitlementService entitlementService;
    private readonly IUsageService usageService;
    private readonly IAIActionService actionService;
    private readonly IAIBudgetResolver budgetResolver;
    private readonly AIOptions options;

    public AIOrchestrator(
        IAIConversationService conversationService,
        IAIRunService runService,
        IAIContextBuilder contextBuilder,
        IAIToolRegistry toolRegistry,
        IAICompletionProvider completionProvider,
        IAIModelRouter modelRouter,
        IAIPromptBuilder promptBuilder,
        IEntitlementService entitlementService,
        IUsageService usageService,
        IAIActionService actionService,
        IAIBudgetResolver budgetResolver,
        IOptions<AIOptions> options)
    {
        this.conversationService = conversationService;
        this.runService = runService;
        this.contextBuilder = contextBuilder;
        this.toolRegistry = toolRegistry;
        this.completionProvider = completionProvider;
        this.modelRouter = modelRouter;
        this.promptBuilder = promptBuilder;
        this.entitlementService = entitlementService;
        this.usageService = usageService;
        this.actionService = actionService;
        this.budgetResolver = budgetResolver;
        this.options = options.Value;
    }

    public async Task<SendAIMessageResponse> SendAsync(
        long conversationId,
        SendAIMessageRequest request,
        long userId)
    {
        if (string.IsNullOrWhiteSpace(request.Content))
        {
            throw new FitMateException("The message cannot be empty.");
        }

        // Plan gate first (403), then quota (429): neither should cost a provider call.
        await entitlementService.RequireFeatureAsync(userId, SubscriptionFeature.AIChat);

        var budget = await budgetResolver.ResolveAsync(userId);

        if (request.Content.Length > budget.MaximumMessageCharacters)
        {
            throw new FitMateException(
                $"That message is too long. Please keep it under {budget.MaximumMessageCharacters:N0} characters.");
        }

        var reservation = await usageService.ReserveAsync(userId, SubscriptionFeature.AIChat, 1);

        // Ownership is enforced here, before a run row exists.
        await conversationService.AddUserMessageAsync(conversationId, request.Content, userId);

        var model = budget.Model;
        var run = await runService.StartAsync(
            userId,
            conversationId,
            options.Provider,
            model,
            promptBuilder.SystemPromptVersion);

        var usedTools = new List<string>();
        var pendingActionIds = new List<long>();

        try
        {
            var messages = await contextBuilder.BuildAsync(conversationId, userId, budget);
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

            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(budget.TimeoutSeconds));

            for (var iteration = 0; iteration < budget.MaximumToolIterations; iteration++)
            {
                var providerResponse = await completionProvider.CompleteAsync(
                    new AICompletionRequest
                    {
                        Messages = messages,
                        Tools = providerTools,
                        Model = model,
                        MaxOutputTokens = budget.MaximumOutputTokens,
                    },
                    timeout.Token);

                await runService.AddUsageAsync(run.Id, providerResponse.Usage, providerResponse.ProviderRequestId);

                if (providerResponse.ToolCalls.Count == 0)
                {
                    var assistantMessage = await conversationService.AddAssistantMessageAsync(
                        conversationId,
                        providerResponse.Text,
                        userId);

                    await runService.CompleteAsync(run.Id, assistantMessage.Id);
                    await usageService.CommitAsync(reservation.Id);

                    return new SendAIMessageResponse
                    {
                        ConversationId = conversationId,
                        Message = assistantMessage,
                        UsedTools = usedTools,
                        Actions = await LoadActionsAsync(pendingActionIds, userId),
                        Usage = await BuildUsageAsync(userId),
                    };
                }

                totalToolCalls += providerResponse.ToolCalls.Count;
                if (totalToolCalls > budget.MaximumToolCallsPerRun)
                {
                    const string message = "The assistant requested too many tools for a single message.";
                    await runService.MarkLimitExceededAsync(run.Id, "tool_call_limit", message);
                    await usageService.ReleaseAsync(reservation.Id);

                    return await StopWithNoticeAsync(
                        conversationId,
                        userId,
                        run.Id,
                        "I got stuck looking things up and stopped before finishing. Could you narrow "
                            + "the request down a little and ask again?",
                        usedTools,
                        pendingActionIds);
                }

                await runService.IncrementToolCallCountAsync(run.Id, providerResponse.ToolCalls.Count);

                foreach (var toolCall in providerResponse.ToolCalls)
                {
                    usedTools.Add(toolCall.Name);

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

                    if (result.AIActionId is { } pendingActionId)
                    {
                        pendingActionIds.Add(pendingActionId);
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
                        conversationId, userId, toolCall.Name, toolCall.Id, toolCall.ArgumentsJson);
                    await conversationService.AddToolResultMessageAsync(
                        conversationId, userId, toolCall.Name, toolCall.Id, resultJson);

                    messages.Add(AIProviderMessage.FromToolCall(toolCall));
                    messages.Add(AIProviderMessage.FromToolResult(toolCall.Id, resultJson));
                }
            }

            const string iterationMessage = "The assistant could not finish within the allowed number of steps.";
            await runService.MarkLimitExceededAsync(run.Id, "tool_iteration_limit", iterationMessage);
            await usageService.ReleaseAsync(reservation.Id);

            return await StopWithNoticeAsync(
                conversationId,
                userId,
                run.Id,
                "I ran out of steps before I could finish that. Try asking for one thing at a time — "
                    + "for example the exercises first, then the sets and reps.",
                usedTools,
                pendingActionIds);
        }
        catch (AIToolLimitExceededException)
        {
            throw; // run already marked and usage already released
        }
        catch (Exception exception)
        {
            await runService.FailAsync(run.Id, exception);
            await usageService.ReleaseAsync(reservation.Id);

            // Leave the thread readable: without this the conversation ends on the user's message
            // with no reply, which looks like the assistant simply never answered.
            try
            {
                await conversationService.AddAssistantMessageAsync(
                    conversationId,
                    "Something went wrong while I was working on that. Please try again.",
                    userId);
            }
            catch (Exception)
            {
                // The original failure is what matters; never mask it with a logging failure.
            }

            throw;
        }
    }

    /// <summary>
    /// Ends a run that hit a budget ceiling as a normal assistant turn. The user gets an answer they
    /// can act on instead of an error, and the stored conversation stays coherent when reloaded.
    /// </summary>
    private async Task<SendAIMessageResponse> StopWithNoticeAsync(
        long conversationId,
        long userId,
        long runId,
        string notice,
        List<string> usedTools,
        List<long> pendingActionIds)
    {
        var assistantMessage = await conversationService.AddAssistantMessageAsync(
            conversationId,
            notice,
            userId);

        await runService.AttachAssistantMessageAsync(runId, assistantMessage.Id);

        return new SendAIMessageResponse
        {
            ConversationId = conversationId,
            Message = assistantMessage,
            UsedTools = usedTools,
            Actions = await LoadActionsAsync(pendingActionIds, userId),
            Usage = await BuildUsageAsync(userId),
        };
    }

    /// <summary>Loads the proposals raised during this run so the client can render their cards.</summary>
    private async Task<List<AIActionModel>> LoadActionsAsync(IReadOnlyList<long> actionIds, long userId)
    {
        if (actionIds.Count == 0)
        {
            return [];
        }

        var actions = new List<AIActionModel>(actionIds.Count);
        foreach (var actionId in actionIds)
        {
            var action = await actionService.GetByIdAsync(actionId, userId);
            if (action != null)
            {
                actions.Add(action);
            }
        }

        return actions;
    }

    private async Task<AIUsageSummaryModel> BuildUsageAsync(long userId)
    {
        var availability = await entitlementService.GetAvailabilityAsync(userId, SubscriptionFeature.AIChat);

        return new AIUsageSummaryModel
        {
            Feature = nameof(SubscriptionFeature.AIChat),
            Used = availability.Used,
            Limit = availability.Limit,
            Remaining = availability.Remaining,
        };
    }
}
