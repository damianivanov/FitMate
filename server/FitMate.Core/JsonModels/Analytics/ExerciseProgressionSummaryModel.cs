namespace FitMate.Core.JsonModels.Analytics;

public class ExerciseProgressionSummaryModel
{
    public int SessionCount { get; set; }
    public int TotalSets { get; set; }
    public int TotalReps { get; set; }
    public decimal TotalVolumeKg { get; set; }
    public DateTime? FirstTrainedOn { get; set; }
    public DateTime? LastTrainedOn { get; set; }
}
