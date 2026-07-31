using FitMate.DB.Entities.Base;
using FitMate.DB.Enums;

namespace FitMate.DB.Entities;

/// <summary>
/// A mutation the assistant proposed and the user must confirm. The payload is a proposal, never
/// trusted input: it is revalidated at confirmation time before anything is written.
/// </summary>
public class AIAction : BaseEntity
{
    public long UserId { get; set; }
    public long ConversationId { get; set; }
    public long AIRunId { get; set; }
    public AIActionType ActionType { get; set; }
    public AIActionStatus Status { get; set; }
    public string PayloadJson { get; set; } = "{}";
    public string? ResultJson { get; set; }
    public string? ValidationSummaryJson { get; set; }
    public DateTime? ConfirmedAt { get; set; }
    public DateTime? RejectedAt { get; set; }
    public DateTime? ExecutedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public string? FailureReason { get; set; }

    /// <summary>
    /// Optimistic concurrency guard. Two confirmation requests racing each other cannot both
    /// execute: the loser fails the version check and reads back the winner's result.
    /// </summary>
    public int Version { get; set; }

    public AIConversation Conversation { get; set; } = null!;
}
