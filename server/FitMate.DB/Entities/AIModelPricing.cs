using FitMate.DB.Entities.Base;

namespace FitMate.DB.Entities;

/// <summary>
/// Model prices over time. A run is costed with the row that was effective when it started, so
/// historical costs never change when prices do.
/// </summary>
public class AIModelPricing : BaseEntity
{
    public string Provider { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public decimal InputCostPerMillionTokens { get; set; }
    public decimal CachedInputCostPerMillionTokens { get; set; }
    public decimal OutputCostPerMillionTokens { get; set; }
    public decimal? ImageCostPerGeneration { get; set; }
    public DateTime EffectiveFrom { get; set; }
    public DateTime? EffectiveTo { get; set; }
}
