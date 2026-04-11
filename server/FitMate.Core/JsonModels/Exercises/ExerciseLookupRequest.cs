namespace FitMate.Core.JsonModels.Exercises;

public class ExerciseLookupRequest
{
    public string? Search { get; set; }
    public long? MuscleGroupId { get; set; }
    public int Skip { get; set; } = 0;
    public int Take { get; set; } = 30;
}
