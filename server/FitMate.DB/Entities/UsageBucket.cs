using FitMate.DB.Entities.Base;
using FitMate.DB.Enums;

namespace FitMate.DB.Entities;

public class UsageBucket : BaseEntity
{
    public long UserId { get; set; }
    public User User { get; set; } = null!;
    
    public SubscriptionFeature Feature { get; set; }
    public DateOnly PeriodStart { get; set; }
    public DateOnly PeriodEnd { get; set; }
    public int Used { get; set; }
    public int Reserved { get; set; }
    public int? EffectiveLimit { get; set; }

    /// <summary>
    /// Optimistic concurrency guard, incremented on every mutation so two simultaneous
    /// reservations can never both pass the limit check.
    /// </summary>
    public int Version { get; set; }
}
