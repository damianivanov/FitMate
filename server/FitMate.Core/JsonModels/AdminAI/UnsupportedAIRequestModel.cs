using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.AdminAI;

/// <summary>One grouped gap in the product, with the demand behind it.</summary>
public class UnsupportedAIRequestModel
{
    public long Id { get; set; }
    public string Category { get; set; } = string.Empty;
    public string NormalizedKey { get; set; } = string.Empty;
    public string RequestedFunctionality { get; set; } = string.Empty;
    public string? UserIntentSummary { get; set; }
    public string? SuggestedFallback { get; set; }
    public UnsupportedRequestStatus Status { get; set; }
    public int OccurrenceCount { get; set; }
    public int DistinctUserCount { get; set; }
    public DateTime FirstRequestedAt { get; set; }
    public DateTime LastRequestedAt { get; set; }
    public string? AdminNotes { get; set; }
    public string? ExternalTrackingUrl { get; set; }
    public string? ExternalTrackingKey { get; set; }
    public List<UnsupportedRequestOccurrenceModel> RecentOccurrences { get; set; } = [];
}

public class UnsupportedRequestOccurrenceModel
{
    public long Id { get; set; }
    public long UserId { get; set; }
    public string? UserEmail { get; set; }
    public long ConversationId { get; set; }
    public DateTime ReportedAt { get; set; }
}
