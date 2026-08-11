namespace FitMate.Core.JsonModels.AI;

public class AIProgressEventModel
{
    public long Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string? ToolName { get; set; }
    public DateTime OccurredAt { get; set; }
}
