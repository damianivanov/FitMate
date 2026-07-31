namespace FitMate.Integrations.AI.Models;

/// <summary>
/// A provider-neutral conversation message. Nothing outside this project knows how a specific
/// vendor represents roles, tool calls or image parts.
/// </summary>
public class AIProviderMessage
{
    public AIProviderMessageRole Role { get; set; }
    public string Content { get; set; } = string.Empty;

    /// <summary>Set for ToolCall messages: the calls the assistant asked for.</summary>
    public List<AIProviderToolCall> ToolCalls { get; set; } = [];

    /// <summary>Set for ToolResult messages: which call this result answers.</summary>
    public string? ToolCallId { get; set; }

    /// <summary>Optional image parts for vision requests.</summary>
    public List<AIProviderMessageImage> Images { get; set; } = [];

    public static AIProviderMessage FromSystem(string content) => new()
    {
        Role = AIProviderMessageRole.System,
        Content = content,
    };

    public static AIProviderMessage FromUser(string content) => new()
    {
        Role = AIProviderMessageRole.User,
        Content = content,
    };

    public static AIProviderMessage FromAssistant(string content) => new()
    {
        Role = AIProviderMessageRole.Assistant,
        Content = content,
    };

    public static AIProviderMessage FromToolCall(AIProviderToolCall toolCall) => new()
    {
        Role = AIProviderMessageRole.ToolCall,
        Content = string.Empty,
        ToolCalls = [toolCall],
    };

    public static AIProviderMessage FromToolResult(string toolCallId, string resultJson) => new()
    {
        Role = AIProviderMessageRole.ToolResult,
        Content = resultJson,
        ToolCallId = toolCallId,
    };
}
