using FitMate.Core.JsonModels.ProgramPlans;

namespace FitMate.Services.ProgramPlans.Plans;

public interface IProgramPlanService
{
    Task<IReadOnlyList<ProgramPlanModel>> ListAsync(long userId);
    Task<ProgramPlanModel?> GetByIdAsync(long planId, long userId);
    Task<ProgramPlanModel> CreateDraftAsync(SaveProgramPlanRequest request, long userId);
    Task<ProgramPlanModel> UpdateDraftAsync(long planId, SaveProgramPlanRequest request, long userId);
    /// <summary>
    /// Replaces the schedule rules of an active plan and regenerates only the days from
    /// <paramref name="effectiveFrom"/> onwards that are still merely Scheduled. Completed, started,
    /// missed, skipped and rescheduled days survive, so reshaping a program never rewrites history.
    /// </summary>
    Task<ProgramPlanModel> UpdateActiveScheduleAsync(
        long planId,
        SaveProgramPlanRequest request,
        DateOnly effectiveFrom,
        long userId);

    Task<ProgramPlanModel> ActivateAsync(long planId, long userId);
    Task PauseAsync(long planId, long userId);
    Task CompleteAsync(long planId, long userId);
    Task CancelAsync(long planId, long userId);
    Task<bool> DeleteDraftAsync(long planId, long userId);
    Task<ProgramPlanModel?> GetActiveAsync(long userId);
    Task<ProgramTodayModel> GetTodayAsync(long userId, DateOnly date);
    Task<IReadOnlyList<ProgramPlanDayModel>> GetCalendarAsync(long planId, long userId, int year, int month);
    Task<ProgramProgressModel> GetProgressAsync(long planId, long userId, DateOnly today);
}
