namespace FitMate.Integrations.AI.Models;

public class AICompletionResponse
{
    public string Text { get; set; } = string.Empty;
    public List<AIProviderToolCall> ToolCalls { get; set; } = [];
    public AIProviderUsage Usage { get; set; } = new();
    public string? ProviderRequestId { get; set; }
    public string Model { get; set; } = string.Empty;
}
