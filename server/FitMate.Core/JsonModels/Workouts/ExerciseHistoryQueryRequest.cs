namespace FitMate.Core.JsonModels.Workouts;

public class ExerciseHistoryQueryRequest
{
    public List<long> ExerciseIds { get; set; } = [];
    public int Take { get; set; } = 3;
}
