using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.AdminAI;

/// <summary>
/// A full conversation for support purposes. Message bodies are redacted, and hidden entirely when
/// the user opted out of admin content review.
/// </summary>
public class AIConversationDetailModel
{
    public long Id { get; set; }
    public long UserId { get; set; }
    public string? UserEmail { get; set; }
    public string? Title { get; set; }
    public AIConversationStatus Status { get; set; }
    public DateTime LastMessageAt { get; set; }
    public DateTime DateCreated { get; set; }

    /// <summary>False when the user turned off admin content review; bodies are placeholders.</summary>
    public bool ContentVisible { get; set; }

    public List<AIAdminMessageModel> Messages { get; set; } = [];
    public List<AIAdminRunModel> Runs { get; set; } = [];
    public List<AIAdminActionModel> Actions { get; set; } = [];
}

public class AIAdminMessageModel
{
    public long Id { get; set; }
    public AIMessageRole Role { get; set; }
    public string Content { get; set; } = string.Empty;
    public string? ToolName { get; set; }
    public DateTime DateCreated { get; set; }
}

public class AIAdminActionModel
{
    public long Id { get; set; }
    public AIActionType ActionType { get; set; }
    public AIActionStatus Status { get; set; }
    public DateTime DateCreated { get; set; }
    public DateTime? ExecutedAt { get; set; }
    public string? FailureReason { get; set; }
}
