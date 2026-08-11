using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.AI;

public class AIActiveRunModel
{
    public long RunId { get; set; }
    public AIRunStatus Status { get; set; }
    public string CurrentProgressCode { get; set; } = string.Empty;
    public long LastEventId { get; set; }
}
