using FitMate.DB.Entities.Base;
using FitMate.DB.Enums;

namespace FitMate.DB.Entities;

public class ProgramPlan : BaseEntity
{
    public long UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public TrainingGoal Goal { get; set; }
    public ProgramPlanStatus Status { get; set; }
    public ProgramScheduleType ScheduleType { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly? EndDate { get; set; }          // null = open-ended ("keeps going")
    public int TargetWorkoutsPerWeek { get; set; }
    public bool IsAIGenerated { get; set; }
    public long? SourceAIActionId { get; set; }     // plain column; FK added in Plan 06
    public DateTime? ActivatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }

    public User User { get; set; } = null!;
    public ICollection<ProgramPlanScheduleRule> ScheduleRules { get; set; } = [];
    public ICollection<ProgramPlanDay> Days { get; set; } = [];
}
