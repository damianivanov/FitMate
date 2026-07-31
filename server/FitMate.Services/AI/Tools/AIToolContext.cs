namespace FitMate.Services.AI.Tools;

/// <summary>
/// Everything the model is allowed to know about the caller. Handlers must derive every ownership
/// decision from this, never from tool arguments.
/// </summary>
public class AIToolContext
{
    public long UserId { get; set; }
    public long ConversationId { get; set; }
    public long AIRunId { get; set; }
    public bool IsAdmin { get; set; }
    public string? SubscriptionPlanCode { get; set; }
}
