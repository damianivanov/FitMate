using FitMate.Core.JsonModels.ProgramPlans;

namespace FitMate.Services.ProgramPlans.Days;

public interface IProgramPlanDayService
{
    /// <summary>Returns the id of the (new or already-started) Workout. Idempotent.</summary>
    Task<long> StartWorkoutAsync(long programPlanDayId, long userId);
    Task<ProgramPlanDayModel> MoveAsync(long programPlanDayId, MoveProgramDayRequest request, long userId);
    Task<ProgramPlanDayModel> SkipAsync(long programPlanDayId, long userId);
    Task<ProgramPlanDayModel> RestoreAsync(long programPlanDayId, long userId);
    Task MarkMissedDaysAsync(long userId, DateOnly referenceDate);
}
