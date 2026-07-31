using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.AdminAI;

/// <summary>How much of each metered feature the platform consumed in a period.</summary>
public class AIAdminUsageSummaryModel
{
    public string Period { get; set; } = string.Empty;
    public List<AIAdminFeatureUsageModel> Features { get; set; } = [];
}

public class AIAdminFeatureUsageModel
{
    public SubscriptionFeature Feature { get; set; }
    public int UserCount { get; set; }
    public int UsedTotal { get; set; }
    public int AtOrOverLimitCount { get; set; }
}
