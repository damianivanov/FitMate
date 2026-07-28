using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.ProgramPlans;

public class ProgramPlanDayModel
{
    public long Id { get; set; }
    public long ProgramPlanId { get; set; }
    public DateOnly ScheduledDate { get; set; }
    public DateOnly? OriginalScheduledDate { get; set; }
    public ProgramPlanDayType DayType { get; set; }
    public ProgramPlanDayStatus Status { get; set; }
    public long? WorkoutTemplateId { get; set; }
    public string? WorkoutTemplateName { get; set; }
    public int? EstimatedDurationMinutes { get; set; }
    public int ExerciseCount { get; set; }
    public long? StartedWorkoutId { get; set; }
    public long? CompletedWorkoutId { get; set; }
    public string? Notes { get; set; }
}
