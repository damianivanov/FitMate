using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.AI;

public class AIConversationSummaryModel
{
    public long Id { get; set; }
    public string? Title { get; set; }
    public AIConversationStatus Status { get; set; }
    public DateTime LastMessageAt { get; set; }
    public int MessageCount { get; set; }
}
