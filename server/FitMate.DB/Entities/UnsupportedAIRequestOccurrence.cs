using FitMate.DB.Entities.Base;

namespace FitMate.DB.Entities;

/// <summary>One report of an already-known unsupported request. DateCreated is the report time.</summary>
public class UnsupportedAIRequestOccurrence : BaseEntity
{
    public long UnsupportedAIRequestId { get; set; }
    public long UserId { get; set; }
    public long ConversationId { get; set; }
    public long? MessageId { get; set; }

    public UnsupportedAIRequest UnsupportedAIRequest { get; set; } = null!;
}
