using FitMate.DB.Entities.Base;
using FitMate.DB.Enums;

namespace FitMate.DB.Entities;

public class ProgramPlanScheduleRule : BaseEntity
{
    public long ProgramPlanId { get; set; }
    public DayOfWeek? DayOfWeek { get; set; }       // FixedWeekdays only
    public int? RotationDayIndex { get; set; }      // Rotation only, 1-based sequential
    public ProgramPlanDayType DayType { get; set; }
    public long? WorkoutTemplateId { get; set; }
    public int WeekInterval { get; set; } = 1;
    public int OrderIndex { get; set; }
    public bool IsOptional { get; set; }

    public ProgramPlan ProgramPlan { get; set; } = null!;
    public WorkoutTemplate? WorkoutTemplate { get; set; }
}
