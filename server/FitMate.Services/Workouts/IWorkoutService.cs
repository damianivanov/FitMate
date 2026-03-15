using FitMate.Core.JsonModels.Workouts;

namespace FitMate.Services.Workouts;

public interface IWorkoutService
{
    Task<WorkoutCreatedModel> CreateAsync(CreateWorkoutRequest request, long userId);
    Task<PreviousExerciseSetsResponse> GetPreviousSetsAsync(long userId, IReadOnlyCollection<long> exerciseIds);
}
