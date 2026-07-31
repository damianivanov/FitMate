using FitMate.DB.Entities.Base;
using FitMate.DB.Enums;

namespace FitMate.DB.Entities;

public class UsageEntry : BaseEntity
{
    public long UserId { get; set; }
    public SubscriptionFeature Feature { get; set; }
    public long? AIRunId { get; set; }
    public long? UsageReservationId { get; set; }
    public int Quantity { get; set; }
    public UsageEntryType Type { get; set; }
    public string? ReferenceType { get; set; }
    public long? ReferenceId { get; set; }
}
