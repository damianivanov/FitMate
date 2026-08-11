using FitMate.DB.Entities.Base;
using FitMate.DB.Enums;

namespace FitMate.DB.Entities;

public class AIConversation : BaseEntity
{
    public long UserId { get; set; }
    public string? Title { get; set; }
    public AIConversationStatus Status { get; set; }
    public DateTime LastMessageAt { get; set; }

    /// <summary>The one-active-run guard. Plain reference, cleared by every terminal path.</summary>
    public long? ActiveRunId { get; set; }

    /// <summary>Rolling summary of messages that fell outside the retained context window.</summary>
    public string? Summary { get; set; }

    public long? SummaryThroughMessageId { get; set; }
    public DateTime? SummaryUpdatedAt { get; set; }

    public User User { get; set; } = null!;
    public ICollection<AIMessage> Messages { get; set; } = [];
}
