namespace FitMate.Core.JsonModels.ProgramPlans;

public class ProgramProgressModel
{
    public int ScheduledWorkouts { get; set; }
    public int CompletedWorkouts { get; set; }
    public int StartedWorkouts { get; set; }
    public int MissedWorkouts { get; set; }
    public int SkippedWorkouts { get; set; }
    public int RemainingWorkouts { get; set; }
    public decimal? CompletionPercentage { get; set; }   // null for open-ended plans
    public decimal AdherencePercentage { get; set; }
    public int CurrentStreak { get; set; }
}
