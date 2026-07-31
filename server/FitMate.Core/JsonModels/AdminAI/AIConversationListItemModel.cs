using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.AdminAI;

/// <summary>Conversation metadata only — list endpoints never read message bodies.</summary>
public class AIConversationListItemModel
{
    public long Id { get; set; }
    public long UserId { get; set; }
    public string? UserEmail { get; set; }
    public string? Title { get; set; }
    public AIConversationStatus Status { get; set; }
    public int MessageCount { get; set; }
    public int RunCount { get; set; }
    public decimal EstimatedCost { get; set; }
    public DateTime LastMessageAt { get; set; }
    public DateTime DateCreated { get; set; }
}
