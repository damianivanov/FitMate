using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.AdminAI;

public class AIAdminRunModel
{
    public long Id { get; set; }
    public long UserId { get; set; }
    public string? UserEmail { get; set; }
    public long ConversationId { get; set; }
    public AIRunStatus Status { get; set; }
    public string Provider { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public string PromptVersion { get; set; } = string.Empty;
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
    public List<AIAdminToolExecutionModel> ToolExecutions { get; set; } = [];
}

public class AIAdminToolExecutionModel
{
    public long Id { get; set; }
    public string ToolName { get; set; } = string.Empty;
    public AIToolExecutionStatus Status { get; set; }
    public int DurationMilliseconds { get; set; }
    public string? ErrorCode { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime StartedAt { get; set; }
}
