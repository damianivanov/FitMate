using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.ProgramPlans;

public class ProgramPlanScheduleRuleModel
{
    public long Id { get; set; }
    public DayOfWeek? DayOfWeek { get; set; }
    public int? RotationDayIndex { get; set; }
    public ProgramPlanDayType DayType { get; set; }
    public long? WorkoutTemplateId { get; set; }
    public string? WorkoutTemplateName { get; set; }
    public int WeekInterval { get; set; }
    public int OrderIndex { get; set; }
    public bool IsOptional { get; set; }
}
