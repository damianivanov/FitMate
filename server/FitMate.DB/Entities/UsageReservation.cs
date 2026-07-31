using FitMate.DB.Entities.Base;
using FitMate.DB.Enums;

namespace FitMate.DB.Entities;

public class UsageReservation : BaseEntity
{
    public long UserId { get; set; }
    public SubscriptionFeature Feature { get; set; }
    public int Quantity { get; set; }
    public UsageReservationStatus Status { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? FinalizedAt { get; set; }
}
