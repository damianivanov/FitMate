using System.ComponentModel.DataAnnotations;
using FitMate.Core.JsonModels.Common;
using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.AdminAI;

public class AIConversationQueryRequest : PagedRequest
{
    [StringLength(200)]
    public string? Search { get; set; }

    public long? UserId { get; set; }
    public AIConversationStatus? Status { get; set; }
    public DateTime? From { get; set; }
    public DateTime? To { get; set; }
}
