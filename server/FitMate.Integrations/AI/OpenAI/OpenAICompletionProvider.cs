using FitMate.Integrations.AI.Abstractions;
using FitMate.Integrations.AI.Models;
using Microsoft.Extensions.Options;
using OpenAI;
using OpenAI.Chat;
using System.ClientModel;
using System.Text.Json;

namespace FitMate.Integrations.AI.OpenAI;

/// <summary>
/// Translates the neutral request/response models into the OpenAI SDK and back. This is the only
/// type in the solution that knows about OpenAI's shapes.
/// </summary>
public class OpenAICompletionProvider : IAICompletionProvider
{
    private readonly OpenAIOptions options;

    public OpenAICompletionProvider(IOptions<OpenAIOptions> options)
    {
        this.options = options.Value;
    }

    public async Task<AICompletionResponse> CompleteAsync(
        AICompletionRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!options.IsConfigured)
        {
            throw new InvalidOperationException("The OpenAI API key is not configured.");
        }

        var client = CreateClient(request.Model);
        var messages = request.Messages.Select(ToChatMessage).ToList();

        var chatOptions = new ChatCompletionOptions();
        if (request.MaxOutputTokens is { } maxOutputTokens)
        {
            chatOptions.MaxOutputTokenCount = maxOutputTokens;
        }

        if (request.Temperature is { } temperature)
        {
            chatOptions.Temperature = temperature;
        }

        foreach (var tool in request.Tools)
        {
            chatOptions.Tools.Add(ChatTool.CreateFunctionTool(
                tool.Name,
                tool.Description,
                BinaryData.FromString(tool.ParametersJsonSchema)));
        }

        ClientResult<ChatCompletion> result = await client.CompleteChatAsync(
            messages,
            chatOptions,
            cancellationToken);

        var completion = result.Value;

        return new AICompletionResponse
        {
            Text = string.Concat(completion.Content.Where(part => part.Kind == ChatMessageContentPartKind.Text)
                .Select(part => part.Text)),
            ToolCalls = completion.ToolCalls
                .Select(call => new AIProviderToolCall
                {
                    Id = call.Id,
                    Name = call.FunctionName,
                    ArgumentsJson = call.FunctionArguments.ToString(),
                })
                .ToList(),
            Usage = new AIProviderUsage
            {
                InputTokens = completion.Usage?.InputTokenCount ?? 0,
                OutputTokens = completion.Usage?.OutputTokenCount ?? 0,
                CachedInputTokens = completion.Usage?.InputTokenDetails?.CachedTokenCount ?? 0,
            },
            ProviderRequestId = completion.Id,
            Model = completion.Model ?? request.Model,
            FinishReason = completion.FinishReason.ToString(),
        };
    }

    private ChatClient CreateClient(string model)
    {
        var credential = new ApiKeyCredential(options.ApiKey);

        if (string.IsNullOrWhiteSpace(options.Endpoint))
        {
            return new ChatClient(model, credential);
        }

        return new ChatClient(model, credential, new OpenAIClientOptions
        {
            Endpoint = new Uri(options.Endpoint),
        });
    }

    private static ChatMessage ToChatMessage(AIProviderMessage message) => message.Role switch
    {
        AIProviderMessageRole.System => new SystemChatMessage(message.Content),
        AIProviderMessageRole.User => BuildUserMessage(message),
        AIProviderMessageRole.Assistant => new AssistantChatMessage(message.Content),
        AIProviderMessageRole.ToolCall => new AssistantChatMessage(
            message.ToolCalls.Select(call => ChatToolCall.CreateFunctionToolCall(
                call.Id,
                call.Name,
                BinaryData.FromString(call.ArgumentsJson)))),
        AIProviderMessageRole.ToolResult => new ToolChatMessage(message.ToolCallId, message.Content),
        _ => throw new ArgumentOutOfRangeException(nameof(message), message.Role, "Unsupported message role."),
    };

    private static UserChatMessage BuildUserMessage(AIProviderMessage message)
    {
        if (message.Images.Count == 0)
        {
            return new UserChatMessage(message.Content);
        }

        var parts = new List<ChatMessageContentPart>();
        if (!string.IsNullOrWhiteSpace(message.Content))
        {
            parts.Add(ChatMessageContentPart.CreateTextPart(message.Content));
        }

        foreach (var image in message.Images)
        {
            parts.Add(ChatMessageContentPart.CreateImagePart(
                BinaryData.FromBytes(image.Data),
                image.MediaType));
        }

        return new UserChatMessage(parts);
    }
}
