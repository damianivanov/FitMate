namespace FitMate.Core.JsonModels.Workouts;

public class ExerciseHistoryModel
{
    public long ExerciseId { get; set; }
    public string ExerciseName { get; set; } = string.Empty;
    public List<ExerciseHistorySessionModel> Sessions { get; set; } = [];
}
