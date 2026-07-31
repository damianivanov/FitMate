using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.AI;

public class AIMessageModel
{
    public long Id { get; set; }
    public AIMessageRole Role { get; set; }
    public string Content { get; set; } = string.Empty;
    public string? ToolName { get; set; }
    public DateTime DateCreated { get; set; }
}
