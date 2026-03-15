using FitMate.Core.JsonModels.Common;
using FitMate.Core.JsonModels.Exercises;

namespace FitMate.Services.Exercises;

public interface IExerciseService
{
    Task<PagedResponse<ExerciseModel>> ListAsync(ExerciseQueryRequest request);
    Task<ExerciseModel?> GetByIdAsync(long id);
    Task<ExerciseModel> CreateManagedGlobalAsync(CreateExerciseRequest request, long? actorUserId);
    Task<ExerciseModel> CreateCommunityGlobalAsync(CreateExerciseRequest request, long creatorUserId);
    Task<ExerciseModel> UpdateAsync(long id, CreateExerciseRequest request, long? actorUserId);
    Task<bool> DeleteAsync(long id, long? actorUserId);
    Task<IReadOnlyList<ExerciseLookupModel>> LookupAsync(ExerciseLookupRequest request);
}
