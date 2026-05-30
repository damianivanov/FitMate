namespace FitMate.Core.JsonModels.Analytics;

public class ExerciseProgressionPointModel
{
    public DateTime Date { get; set; }
    public decimal? BestWeightKg { get; set; }
    public int? BestReps { get; set; }
    public decimal? EstimatedOneRepMax { get; set; }
    public decimal TotalVolumeKg { get; set; }
}
