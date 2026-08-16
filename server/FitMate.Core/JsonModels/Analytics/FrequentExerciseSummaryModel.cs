namespace FitMate.Core.JsonModels.Analytics;

public class FrequentExerciseSummaryModel
{
    public long ExerciseId { get; set; }
    public string ExerciseName { get; set; } = string.Empty;
    public long PrimaryMuscleGroupId { get; set; }
    public string PrimaryMuscleGroupName { get; set; } = string.Empty;
    public int WorkoutCount { get; set; }
    public int SetCount { get; set; }
    public DateTime LastTrainedOn { get; set; }
}
