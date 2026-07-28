using System.ComponentModel.DataAnnotations;
using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.ProgramPlans;

public class SaveProgramPlanRequest
{
    [Required]
    [StringLength(200)]
    public string Name { get; set; } = string.Empty;

    [StringLength(2000)]
    public string? Description { get; set; }
    public TrainingGoal Goal { get; set; }
    public ProgramScheduleType ScheduleType { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly? EndDate { get; set; }

    [Range(1, 7)]
    public int TargetWorkoutsPerWeek { get; set; }
    public List<ProgramScheduleRuleRequest> ScheduleRules { get; set; } = [];
    public List<CustomProgramDayRequest> CustomDays { get; set; } = [];
}
