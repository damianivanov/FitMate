using System.ComponentModel.DataAnnotations;
using FitMate.Core.JsonModels.Common;
using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.AdminAI;

public class AIRunQueryRequest : PagedRequest
{
    public long? UserId { get; set; }
    public long? ConversationId { get; set; }
    public AIRunStatus? Status { get; set; }

    [StringLength(100)]
    public string? Model { get; set; }

    public DateTime? From { get; set; }
    public DateTime? To { get; set; }

    /// <summary>Only runs that failed — the ones worth looking at first.</summary>
    public bool FailuresOnly { get; set; }
}
