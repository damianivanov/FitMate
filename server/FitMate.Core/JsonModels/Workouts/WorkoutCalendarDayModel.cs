namespace FitMate.Core.JsonModels.Workouts;

public class WorkoutCalendarDayModel
{
    public long WorkoutId { get; set; }
    public string Title { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public int? DurationSeconds { get; set; }
    public decimal? TotalVolumeKg { get; set; }
    public int ExerciseCount { get; set; }
    public int SetCount { get; set; }
}
