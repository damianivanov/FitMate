namespace FitMate.Core.JsonModels.Analytics;

public class PersonalRecordSummaryModel
{
    public long ExerciseId { get; set; }
    public string ExerciseName { get; set; } = string.Empty;
    public long PrimaryMuscleGroupId { get; set; }
    public string PrimaryMuscleGroupName { get; set; } = string.Empty;
    public decimal? BestWeightKg { get; set; }
    public int? BestReps { get; set; }
    public decimal? BestEstimatedOneRepMax { get; set; }
    public decimal? BestVolumeKg { get; set; }
    public DateTime LastTrainedOn { get; set; }
}
