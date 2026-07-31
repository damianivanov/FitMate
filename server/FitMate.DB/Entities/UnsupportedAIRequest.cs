using FitMate.DB.Entities.Base;
using FitMate.DB.Enums;

namespace FitMate.DB.Entities;

/// <summary>
/// Something a user asked the coach for that FitMate cannot do, deduplicated on
/// (Category, NormalizedKey) so the backlog counts demand instead of listing every mention.
/// The user, conversation and message columns are plain references without foreign keys: this
/// backlog must outlive account deletion and conversation retention purges.
/// </summary>
public class UnsupportedAIRequest : BaseEntity
{
    public long UserId { get; set; }
    public long ConversationId { get; set; }
    public long? MessageId { get; set; }
    public string Category { get; set; } = string.Empty;
    public string NormalizedKey { get; set; } = string.Empty;
    public string RequestedFunctionality { get; set; } = string.Empty;
    public string? UserIntentSummary { get; set; }
    public string? SuggestedFallback { get; set; }
    public UnsupportedRequestStatus Status { get; set; }
    public int OccurrenceCount { get; set; }
    public DateTime FirstRequestedAt { get; set; }
    public DateTime LastRequestedAt { get; set; }
    public string? AdminNotes { get; set; }
    public string? ExternalTrackingUrl { get; set; }
    public string? ExternalTrackingKey { get; set; }

    public ICollection<UnsupportedAIRequestOccurrence> Occurrences { get; set; } = [];
}
