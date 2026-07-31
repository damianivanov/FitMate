using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.Subscriptions;

public class UsageReservationModel
{
    public long Id { get; set; }
    public SubscriptionFeature Feature { get; set; }
    public int Quantity { get; set; }
    public UsageReservationStatus Status { get; set; }
    public DateTime ExpiresAt { get; set; }
}
