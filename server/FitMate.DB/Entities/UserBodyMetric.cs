using FitMate.DB.Entities.Base;

namespace FitMate.DB.Entities;

public class UserBodyMetric : BaseEntity
{
    public long UserId { get; set; }
    public decimal? BodyWeightKg { get; set; }
    public decimal? BodyFatPercentage { get; set; }
    public string? Notes { get; set; }

    public User User { get; set; } = null!;
}
