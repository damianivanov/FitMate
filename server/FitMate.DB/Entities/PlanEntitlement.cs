using FitMate.DB.Entities.Base;
using FitMate.DB.Enums;

namespace FitMate.DB.Entities;

public class PlanEntitlement : BaseEntity
{
    public long PlanId { get; set; }
    public SubscriptionFeature Feature { get; set; }
    public bool IsEnabled { get; set; }
    public int? DailyLimit { get; set; }
    public int? MonthlyLimit { get; set; }
    public int? MaximumPerRequest { get; set; }
    public int? SoftLimit { get; set; }
    public int? HardLimit { get; set; }
    public string? ConfigurationJson { get; set; }

    public Plan Plan { get; set; } = null!;
}
