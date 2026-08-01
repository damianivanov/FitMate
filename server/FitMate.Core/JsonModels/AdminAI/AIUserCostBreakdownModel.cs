using FitMate.Core.JsonModels.Common;

namespace FitMate.Core.JsonModels.AdminAI;

/// <summary>What one user burned over the window, and on which models.</summary>
public class AIUserCostBreakdownModel
{
    public long UserId { get; set; }
    public string? Email { get; set; }
    public string PlanCode { get; set; } = string.Empty;
    public string PlanName { get; set; } = string.Empty;
    public int RunCount { get; set; }
    public long InputTokens { get; set; }
    public long CachedInputTokens { get; set; }
    public long OutputTokens { get; set; }
    public long TotalTokens { get; set; }
    public decimal EstimatedCost { get; set; }
    public List<AIUserModelCostModel> ByModel { get; set; } = [];
}

public class AIUserModelCostModel
{
    public string Model { get; set; } = string.Empty;
    public int RunCount { get; set; }
    public long InputTokens { get; set; }
    public long CachedInputTokens { get; set; }
    public long OutputTokens { get; set; }
    public decimal EstimatedCost { get; set; }
}

public class AIUserCostQueryRequest : PagedRequest
{
    public int Days { get; set; } = 30;
    public string? Search { get; set; }
}
