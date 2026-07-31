using FitMate.Integrations.AI.Abstractions;
using FitMate.Integrations.AI.Models;

namespace FitMate.Tests.TestInfrastructure;

/// <summary>
/// Deterministic scripted provider: queue one response per expected provider call. Real OpenAI is
/// never contacted from tests.
/// </summary>
public sealed class FakeAICompletionProvider : IAICompletionProvider
{
    private readonly Queue<AICompletionResponse> responses = new();

    public List<AICompletionRequest> Requests { get; } = [];

    public Exception? ThrowOnCall { get; set; }

    public FakeAICompletionProvider EnqueueText(string text, int inputTokens = 10, int outputTokens = 5)
    {
        responses.Enqueue(new AICompletionResponse
        {
            Text = text,
            Usage = new AIProviderUsage { InputTokens = inputTokens, OutputTokens = outputTokens },
            ProviderRequestId = $"fake-{responses.Count}",
            Model = "test-model",
        });

        return this;
    }

    public FakeAICompletionProvider EnqueueToolCall(string toolCallId, string toolName, string argumentsJson)
    {
        responses.Enqueue(new AICompletionResponse
        {
            Text = string.Empty,
            ToolCalls =
            [
                new AIProviderToolCall { Id = toolCallId, Name = toolName, ArgumentsJson = argumentsJson },
            ],
            Usage = new AIProviderUsage { InputTokens = 10, OutputTokens = 5 },
            ProviderRequestId = $"fake-{responses.Count}",
            Model = "test-model",
        });

        return this;
    }

    public Task<AICompletionResponse> CompleteAsync(
        AICompletionRequest request,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        Requests.Add(request);

        if (ThrowOnCall != null)
        {
            throw ThrowOnCall;
        }

        if (responses.Count == 0)
        {
            throw new InvalidOperationException("FakeAICompletionProvider ran out of scripted responses.");
        }

        return Task.FromResult(responses.Dequeue());
    }
}
