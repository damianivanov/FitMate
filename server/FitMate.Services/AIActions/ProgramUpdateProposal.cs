using FitMate.Core.JsonModels.AIActions;
using FitMate.DB.Entities;

namespace FitMate.Services.AIActions;

/// <summary>
/// Projects a program update onto the full-program shape so both flows share one validator and one
/// preview renderer. The plan's own dates, goal and schedule type are carried over untouched.
/// </summary>
public static class ProgramUpdateProposal
{
    public static ProposeProgramPlanPayload ToProposal(ProgramPlan plan, ProposeProgramUpdatePayload payload) => new()
    {
        Name = plan.Name,
        Description = plan.Description,
        Goal = plan.Goal,
        ScheduleType = plan.ScheduleType,
        StartDate = plan.StartDate,
        EndDate = plan.EndDate,
        WorkoutsPerWeek = payload.WorkoutsPerWeek,
        Schedule = payload.Schedule,
        NewTemplates = payload.NewTemplates,
    };
}
