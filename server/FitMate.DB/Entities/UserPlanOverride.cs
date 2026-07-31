using FitMate.DB.Entities.Base;

namespace FitMate.DB.Entities;

public class UserPlanOverride : BaseEntity
{
    public long UserId { get; set; }
    public long PlanId { get; set; }
    public long CreatedByUserId { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string? PreviousPlanCode { get; set; }
    public DateTime StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }
    public bool IsActive { get; set; }

    public Plan Plan { get; set; } = null!;
}
