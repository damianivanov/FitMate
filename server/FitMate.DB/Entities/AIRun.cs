using FitMate.DB.Entities.Base;
using FitMate.DB.Enums;

namespace FitMate.DB.Entities;

public class AIRun : BaseEntity
{
    public long UserId { get; set; }
    public long ConversationId { get; set; }

    /// <summary>Plain reference columns (no FK) so message retention never blocks run auditing.</summary>
    public long? UserMessageId { get; set; }

    public long? AssistantMessageId { get; set; }
    public AIRunStatus Status { get; set; }
    public string Provider { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public string PromptVersion { get; set; } = string.Empty;
    public string? ProviderRequestId { get; set; }
    public int InputTokens { get; set; }
    public int OutputTokens { get; set; }
    public int CachedInputTokens { get; set; }
    public decimal? EstimatedCost { get; set; }
    public int ToolCallCount { get; set; }
    public int DurationMilliseconds { get; set; }
    public string? ErrorCode { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }

    public AIConversation Conversation { get; set; } = null!;
    public ICollection<AIToolExecution> ToolExecutions { get; set; } = [];
}
