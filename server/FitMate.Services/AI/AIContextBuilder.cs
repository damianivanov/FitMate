using FitMate.Core.Settings;
using FitMate.DB.Enums;
using FitMate.Integrations.AI.Models;
using Microsoft.Extensions.Options;
using System.Reflection;

namespace FitMate.Services.AI;

public class AIContextBuilder : IAIContextBuilder
{
    private readonly IAIConversationService conversationService;
    private readonly IAIPromptBuilder promptBuilder;
    private readonly AIOptions options;

    public AIContextBuilder(
        IAIConversationService conversationService,
        IAIPromptBuilder promptBuilder,
        IOptions<AIOptions> options)
    {
        this.conversationService = conversationService;
        this.promptBuilder = promptBuilder;
        this.options = options.Value;
    }

    public async Task<List<AIProviderMessage>> BuildAsync(long conversationId, long userId)
    {
        var history = await conversationService.GetContextMessagesAsync(
            conversationId,
            userId,
            options.MaximumConversationMessages);

        var messages = new List<AIProviderMessage>
        {
            AIProviderMessage.FromSystem(promptBuilder.BuildSystemPrompt()),
        };

        foreach (var message in history)
        {
            switch (message.Role)
            {
                case AIMessageRole.User:
                    messages.Add(AIProviderMessage.FromUser(message.Content));
                    break;
                case AIMessageRole.Assistant:
                    messages.Add(AIProviderMessage.FromAssistant(message.Content));
                    break;
                default:
                    // Tool traffic is persisted for auditing but only replayed inside the run that
                    // produced it, so it never comes back from history.
                    break;
            }
        }

        return messages;
    }
}
