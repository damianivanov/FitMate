using FitMate.Core.JsonModels.Common;
using FitMate.Core.JsonModels.Exercises;

namespace FitMate.Services.Exercises;

public interface IExerciseService
{
    Task<IReadOnlyList<ExerciseLookupModel>> GetAllAsync(ExerciseLookupRequest request);
    Task<IReadOnlyList<ExerciseLookupModel>> GetMineAsync(ExerciseLookupRequest request);
    Task<PagedResponse<ExerciseModel>> ListAsync(ExerciseQueryRequest request);
    Task<ExerciseModel> CreateAsync(CreateExerciseRequest request);
    Task<ExerciseModel> UpdateAsync(long id, CreateExerciseRequest request);
    Task<ExerciseModel> UploadImageAsync(long id, Stream content, string fileName);
    Task<bool> DeleteAsync(long id);
}
