using System.ComponentModel.DataAnnotations;
using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.AdminAI;

/// <summary>Admin triage. Everything else on the row is written by the coach, not by hand.</summary>
public class UpdateUnsupportedRequestRequest
{
    public UnsupportedRequestStatus Status { get; set; }

    [StringLength(4000)]
    public string? AdminNotes { get; set; }

    [StringLength(1000)]
    public string? ExternalTrackingUrl { get; set; }

    [StringLength(100)]
    public string? ExternalTrackingKey { get; set; }
}
