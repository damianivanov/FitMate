using FitMate.DB.Entities.Base;
using FitMate.DB.Enums;

namespace FitMate.DB.Entities;

public class AIConversation : BaseEntity
{
    public long UserId { get; set; }
    public string? Title { get; set; }
    public AIConversationStatus Status { get; set; }
    public DateTime LastMessageAt { get; set; }

    public User User { get; set; } = null!;
    public ICollection<AIMessage> Messages { get; set; } = [];
}
