namespace FitMate.Core.JsonModels.Analytics;

public class VolumeTrendPointModel
{
    public DateTime PeriodStart { get; set; }
    public decimal TotalVolumeKg { get; set; }
    public int WorkoutCount { get; set; }
}
