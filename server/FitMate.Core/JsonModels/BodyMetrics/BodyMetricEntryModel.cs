namespace FitMate.Core.JsonModels.BodyMetrics;

public class BodyMetricEntryModel
{
    public long Id { get; set; }
    public decimal? BodyWeightKg { get; set; }
    public decimal? BodyFatPercentage { get; set; }
    public string? Notes { get; set; }
    public DateTime LoggedAt { get; set; }
}
