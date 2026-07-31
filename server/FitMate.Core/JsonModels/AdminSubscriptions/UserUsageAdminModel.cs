using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.AdminSubscriptions;

public class UserUsageAdminModel
{
    public long Id { get; set; }
    public long UserId { get; set; }
    public string? Email { get; set; }
    public SubscriptionFeature Feature { get; set; }
    public DateOnly PeriodStart { get; set; }
    public DateOnly PeriodEnd { get; set; }
    public int Used { get; set; }
    public int Reserved { get; set; }
    public int? EffectiveLimit { get; set; }
}
