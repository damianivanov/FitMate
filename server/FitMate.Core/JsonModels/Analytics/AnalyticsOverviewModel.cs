namespace FitMate.Core.JsonModels.Analytics;

public class AnalyticsOverviewModel
{
    public int WorkoutCount { get; set; }
    public decimal TotalVolumeKg { get; set; }
    public int TotalSets { get; set; }
    public int TotalReps { get; set; }
    public List<VolumeTrendPointModel> VolumeTrend { get; set; } = [];
    public List<MuscleGroupVolumeModel> MuscleGroupVolumes { get; set; } = [];
    public List<PersonalRecordSummaryModel> PersonalRecords { get; set; } = [];
}
