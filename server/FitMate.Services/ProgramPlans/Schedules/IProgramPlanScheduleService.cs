using FitMate.DB.Entities;

namespace FitMate.Services.ProgramPlans.Schedules;

public interface IProgramPlanScheduleService
{
    /// <summary>
    /// Expands the plan's schedule rules into concrete days for [from, toInclusive].
    /// Pure: does not touch the database. Rest days are not emitted.
    /// </summary>
    IReadOnlyList<ProgramPlanDay> GenerateDays(ProgramPlan plan, DateOnly from, DateOnly toInclusive);
}
