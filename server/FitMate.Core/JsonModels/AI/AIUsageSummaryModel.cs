using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.AI;

public class AIUsageSummaryModel
{
    public string Feature { get; set; } = string.Empty;
    public int Used { get; set; }
    public int? Limit { get; set; }
    public int? Remaining { get; set; }
}
