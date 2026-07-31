namespace FitMate.Core.JsonModels.AdminAI;

/// <summary>The AI subsystem at a glance, over a caller-chosen window of days.</summary>
public class AIAdminOverviewModel
{
    public int Days { get; set; }
    public DateTime From { get; set; }
    public DateTime To { get; set; }

    public int TotalRuns { get; set; }
    public int FailedRuns { get; set; }
    public int ActiveUsers { get; set; }
    public int Conversations { get; set; }
    public int Messages { get; set; }
    public int ToolCalls { get; set; }
    public int FailedToolCalls { get; set; }
    public int ProposedActions { get; set; }
    public int ConfirmedActions { get; set; }

    public long InputTokens { get; set; }
    public long OutputTokens { get; set; }
    public decimal EstimatedCost { get; set; }

    public int AverageDurationMilliseconds { get; set; }
    public int P95DurationMilliseconds { get; set; }

    public List<AIToolUsageModel> TopTools { get; set; } = [];
    public List<AIUserCostModel> TopUsersByCost { get; set; } = [];
    public List<AICostByDayModel> CostByDay { get; set; } = [];
    public List<UnsupportedCategoryCountModel> TopUnsupportedCategories { get; set; } = [];
}

public class AIToolUsageModel
{
    public string ToolName { get; set; } = string.Empty;
    public int CallCount { get; set; }
    public int FailureCount { get; set; }
    public int AverageDurationMilliseconds { get; set; }
}

public class AIUserCostModel
{
    public long UserId { get; set; }
    public string? Email { get; set; }
    public int RunCount { get; set; }
    public decimal EstimatedCost { get; set; }
}

public class AICostByDayModel
{
    public DateOnly Date { get; set; }
    public int RunCount { get; set; }
    public decimal EstimatedCost { get; set; }
}

public class UnsupportedCategoryCountModel
{
    public string Category { get; set; } = string.Empty;
    public int GroupCount { get; set; }
    public int OccurrenceCount { get; set; }
}
