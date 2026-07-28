namespace FitMate.Core.JsonModels.ProgramPlans;

public class ProgramTodayModel
{
    public DateOnly Date { get; set; }
    public bool HasActiveProgram { get; set; }
    public long? ProgramId { get; set; }
    public string? ProgramName { get; set; }
    public ProgramPlanDayModel? Today { get; set; }
    public ProgramPlanDayModel? MissedWorkout { get; set; }
    public ProgramPlanDayModel? NextWorkout { get; set; }
}
