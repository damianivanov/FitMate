namespace FitMate.Core.JsonModels.Analytics;

public class ExerciseProgressionModel
{
    public long ExerciseId { get; set; }
    public string ExerciseName { get; set; } = string.Empty;
    public List<ExerciseProgressionPointModel> Points { get; set; } = [];
    public ExerciseProgressionSummaryModel Summary { get; set; } = new();
    public ExerciseRecordsModel Records { get; set; } = new();
    public List<ExerciseSessionModel> Sessions { get; set; } = [];
}
