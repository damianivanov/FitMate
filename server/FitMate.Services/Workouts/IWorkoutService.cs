using FitMate.Core.JsonModels.Workouts;

namespace FitMate.Services.Workouts;

public interface IWorkoutService
{
    Task<IReadOnlyList<WorkoutModel>> ListAsync(long userId);
    Task<WorkoutModel?> GetByIdAsync(long workoutId, long userId);
    Task<long> StartFromTemplateAsync(long templateId, long userId);
    Task<WorkoutCreatedModel> UpsertDraftAsync(SaveWorkoutRequest request, long userId);
    Task<WorkoutCreatedModel> CreateAsync(SaveWorkoutRequest request, long userId);
    Task<bool> DeleteAsync(long workoutId, long userId);
    Task<PreviousExerciseSetsResponse> GetPreviousSetsAsync(long userId, IReadOnlyCollection<long> exerciseIds);
}
