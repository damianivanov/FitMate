namespace FitMate.Core.JsonModels.Analytics;

public class ExerciseSessionModel
{
    public long WorkoutId { get; set; }
    public string WorkoutTitle { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public decimal TotalVolumeKg { get; set; }
    public decimal? BestWeightKg { get; set; }
    public decimal? EstimatedOneRepMax { get; set; }
    public bool IsPersonalRecord { get; set; }
    public List<ExerciseSessionSetModel> Sets { get; set; } = [];
}
