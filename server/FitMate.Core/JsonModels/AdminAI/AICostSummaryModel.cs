namespace FitMate.Core.JsonModels.AdminAI;

public class AICostSummaryModel
{
    public DateTime From { get; set; }
    public DateTime To { get; set; }
    public decimal EstimatedCost { get; set; }
    public long InputTokens { get; set; }
    public long OutputTokens { get; set; }
    public long CachedInputTokens { get; set; }
    public List<AICostByDayModel> ByDay { get; set; } = [];
    public List<AICostByModelModel> ByModel { get; set; } = [];
    public List<AICostByPlanModel> ByPlan { get; set; } = [];
}

public class AICostByModelModel
{
    public string Model { get; set; } = string.Empty;
    public int RunCount { get; set; }
    public decimal EstimatedCost { get; set; }
}

public class AICostByPlanModel
{
    public string PlanCode { get; set; } = string.Empty;
    public int RunCount { get; set; }
    public decimal EstimatedCost { get; set; }
}
