namespace FitMate.Core.JsonModels.Workouts;

/// <summary>
/// The session the user is in the middle of: started and not yet finished. A workout that exists but
/// has never been started is a draft, not a running session, and is deliberately not reported here.
/// </summary>
public class ActiveWorkoutModel
{
    public long Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public DateTime? StartedAt { get; set; }
    public int ExerciseCount { get; set; }
}
