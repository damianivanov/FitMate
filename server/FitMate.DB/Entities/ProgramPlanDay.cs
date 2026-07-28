using FitMate.DB.Entities.Base;
using FitMate.DB.Enums;

namespace FitMate.DB.Entities;

public class ProgramPlanDay : BaseEntity
{
    public long ProgramPlanId { get; set; }
    public DateOnly ScheduledDate { get; set; }
    public DateOnly? OriginalScheduledDate { get; set; }
    public ProgramPlanDayType DayType { get; set; }
    public ProgramPlanDayStatus Status { get; set; }
    public long? WorkoutTemplateId { get; set; }
    public long? StartedWorkoutId { get; set; }
    public long? CompletedWorkoutId { get; set; }
    public string? Notes { get; set; }
    public int OrderIndex { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }

    public ProgramPlan ProgramPlan { get; set; } = null!;
    public WorkoutTemplate? WorkoutTemplate { get; set; }
    public Workout? StartedWorkout { get; set; }
    public Workout? CompletedWorkout { get; set; }
}
