using FitMate.Core.JsonModels.Workouts;

namespace FitMate.Services.Workouts;

public interface IWorkoutService
{
    Task<IReadOnlyList<WorkoutModel>> ListAsync(long userId);
    Task<IReadOnlyList<WorkoutCalendarDayModel>> GetCalendarMonthAsync(long userId, int year, int month);
    Task<WorkoutModel?> GetByIdAsync(long workoutId, long userId);

    /// <summary>The session currently running, or null when the user is not mid-workout.</summary>
    Task<ActiveWorkoutModel?> GetActiveAsync(long userId, CancellationToken cancellationToken = default);
    Task<long> StartFromTemplateAsync(long templateId, long userId, long? programPlanDayId = null);
    Task<long> DuplicateAsync(long workoutId, long userId);
    Task<WorkoutCreatedModel> CreateAsync(SaveWorkoutRequest request, long userId);
    Task<WorkoutCreatedModel> UpdateAsync(long workoutId, SaveWorkoutRequest request, long userId);
    Task<WorkoutCreatedModel> FinishAsync(long workoutId, SaveWorkoutRequest request, long userId);
    Task<bool> DeleteAsync(long workoutId, long userId);
    Task<PreviousExerciseSetsResponse> GetPreviousSetsAsync(long userId, IReadOnlyCollection<long> exerciseIds);

    Task<ExerciseHistoryResponse> GetExerciseHistoryAsync(long userId, IReadOnlyCollection<long> exerciseIds, int take);
}
