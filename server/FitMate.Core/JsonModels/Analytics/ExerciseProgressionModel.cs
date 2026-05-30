namespace FitMate.Core.JsonModels.Analytics;

public class ExerciseProgressionModel
{
    public long ExerciseId { get; set; }
    public string ExerciseName { get; set; } = string.Empty;
    public List<ExerciseProgressionPointModel> Points { get; set; } = [];
}
