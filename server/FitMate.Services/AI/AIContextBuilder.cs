using FitMate.DB.Enums;
using FitMate.Integrations.AI.Models;

namespace FitMate.Services.AI;

public class AIContextBuilder : IAIContextBuilder
{
    private readonly IAIConversationService conversationService;
    private readonly IAIPromptBuilder promptBuilder;
    private readonly IAITokenEstimator tokenEstimator;

    public AIContextBuilder(
        IAIConversationService conversationService,
        IAIPromptBuilder promptBuilder,
        IAITokenEstimator tokenEstimator)
    {
        this.conversationService = conversationService;
        this.promptBuilder = promptBuilder;
        this.tokenEstimator = tokenEstimator;
    }

    public async Task<List<AIProviderMessage>> BuildAsync(long conversationId, long userId, AIBudget budget)
    {
        var history = await conversationService.GetContextMessagesAsync(
            conversationId,
            userId,
            budget.MaximumConversationMessages);

        var systemMessage = AIProviderMessage.FromSystem(promptBuilder.BuildSystemPrompt());

        var replayable = new List<AIProviderMessage>();
        foreach (var message in history)
        {
            switch (message.Role)
            {
                case AIMessageRole.User:
                    replayable.Add(AIProviderMessage.FromUser(message.Content));
                    break;
                case AIMessageRole.Assistant:
                    replayable.Add(AIProviderMessage.FromAssistant(message.Content));
                    break;
                default:
                    // Tool traffic is persisted for auditing but only replayed inside the run that
                    // produced it, so it never comes back from history.
                    break;
            }
        }

        return Trim(systemMessage, replayable, budget.MaximumContextTokens);
    }

    /// <summary>
    /// Keeps the system prompt and the newest message, then walks backwards adding as much history
    /// as the budget allows. The newest message is never dropped: without it there is nothing to
    /// answer, so an oversized one is the inbound length guard's problem, not the trimmer's.
    /// </summary>
    private List<AIProviderMessage> Trim(
        AIProviderMessage systemMessage,
        List<AIProviderMessage> history,
        int maximumTokens)
    {
        var kept = new List<AIProviderMessage>();
        var used = tokenEstimator.EstimateMessage(systemMessage);

        for (var index = history.Count - 1; index >= 0; index--)
        {
            var message = history[index];
            var cost = tokenEstimator.EstimateMessage(message);

            if (used + cost > maximumTokens && kept.Count > 0)
            {
                break;
            }

            kept.Insert(0, message);
            used += cost;
        }

        kept.Insert(0, systemMessage);
        return kept;
    }
}
