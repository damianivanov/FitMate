using FitMate.DB.Entities.Base;

namespace FitMate.DB.Entities;

public class UserAIPreferences : BaseEntity
{
    public long UserId { get; set; }
    public bool AllowConversationHistory { get; set; } = true;
    public bool AllowProductImprovementUse { get; set; } = true;
    public bool AllowPersonalization { get; set; } = true;
    public bool AllowAdminContentReview { get; set; } = true;
    public DateTime UpdatedAt { get; set; }

    public User User { get; set; } = null!;
}
