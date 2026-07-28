using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.ProgramPlans;

public class ProgramScheduleRuleRequest
{
    public DayOfWeek? DayOfWeek { get; set; }
    public int? RotationDayIndex { get; set; }
    public ProgramPlanDayType DayType { get; set; }
    public long? WorkoutTemplateId { get; set; }
    public int WeekInterval { get; set; } = 1;
    public int OrderIndex { get; set; }
    public bool IsOptional { get; set; }
}
