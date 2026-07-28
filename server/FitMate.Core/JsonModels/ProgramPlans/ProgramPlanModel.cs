using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.ProgramPlans;

public class ProgramPlanModel
{
    public long Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public TrainingGoal Goal { get; set; }
    public ProgramPlanStatus Status { get; set; }
    public ProgramScheduleType ScheduleType { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public int TargetWorkoutsPerWeek { get; set; }
    public bool IsAiGenerated { get; set; }
    public DateTime? ActivatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public List<ProgramPlanScheduleRuleModel> ScheduleRules { get; set; } = [];
}
