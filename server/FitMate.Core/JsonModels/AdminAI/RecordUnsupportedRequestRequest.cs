namespace FitMate.Core.JsonModels.AdminAI;

/// <summary>What the coach reports when the user asks for something FitMate cannot do.</summary>
public class RecordUnsupportedRequestRequest
{
    public string Category { get; set; } = string.Empty;
    public string RequestedFunctionality { get; set; } = string.Empty;
    public string? UserIntentSummary { get; set; }
    public string? SuggestedFallback { get; set; }
    public long ConversationId { get; set; }
    public long? MessageId { get; set; }
}
