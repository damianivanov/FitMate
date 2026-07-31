using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.AI;

public class AIConversationModel
{
    public long Id { get; set; }
    public string? Title { get; set; }
    public AIConversationStatus Status { get; set; }
    public DateTime LastMessageAt { get; set; }
    public List<AIMessageModel> Messages { get; set; } = [];
}
