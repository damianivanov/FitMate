using FitMate.Core.JsonModels.AIActions;
using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.AI;

public class AIRunSnapshotModel
{
    public long Id { get; set; }
    public long ConversationId { get; set; }
    public AIRunStatus Status { get; set; }
    public string CurrentProgressCode { get; set; } = string.Empty;

    /// <summary>Replay cursor: the client resumes SSE from here after a reconnect.</summary>
    public long LastEventId { get; set; }

    public List<AIProgressEventModel> Events { get; set; } = [];
    public AIMessageModel? AssistantMessage { get; set; }
    public List<AIActionModel> Actions { get; set; } = [];
    public AIUsageSummaryModel? Usage { get; set; }

    /// <summary>Stable failure code for UI copy. Never carries exception text.</summary>
    public string? PublicErrorCode { get; set; }
}
