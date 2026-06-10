using System.ComponentModel.DataAnnotations;

namespace FitMate.Core.JsonModels.BodyMetrics;

public class LogBodyMetricRequest
{
    [Required]
    [Range(20, 500)]
    public decimal BodyWeightKg { get; set; }

    [Range(1, 75)]
    public decimal? BodyFatPercentage { get; set; }

    [StringLength(2000)]
    public string? Notes { get; set; }
}
