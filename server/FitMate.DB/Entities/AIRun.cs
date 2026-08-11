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

    /// <summary>Browser idempotency key, unique per user.</summary>
    public string ClientRequestId { get; set; } = string.Empty;

    /// <summary>Links the queued run to the AI chat unit reserved when it was accepted.</summary>
    public long? UsageReservationId { get; set; }

    public DateTime? QueuedAt { get; set; }

    /// <summary>Worker start, so queue delay is not counted as run duration.</summary>
    public DateTime? ProcessingStartedAt { get; set; }

    public DateTime? HeartbeatAt { get; set; }
    public string? LeaseOwner { get; set; }
    public DateTime? LeaseExpiresAt { get; set; }
    public int AttemptCount { get; set; }
    public DateTime? NextAttemptAt { get; set; }

    /// <summary>Budget frozen at enqueue, so a settings change mid-queue cannot alter a run.</summary>
    public string? ExecutionBudgetJson { get; set; }

    /// <summary>
    /// Set once a tool has run. A run past this point is never replayed: a second pass could create
    /// a duplicate proposal or charge generation quota twice.
    /// </summary>
    public bool HasSideEffects { get; set; }

    public AIConversation Conversation { get; set; } = null!;
    public ICollection<AIToolExecution> ToolExecutions { get; set; } = [];
    public ICollection<AIProgressEvent> ProgressEvents { get; set; } = [];
}
