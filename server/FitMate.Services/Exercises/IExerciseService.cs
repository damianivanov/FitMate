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
    Task<ImageUploadTicketModel> CreateImageUploadTicketAsync(long id, ImageUploadTicketRequest request);
    Task<ExerciseModel> ConfirmImageUploadAsync(long id, ConfirmImageUploadRequest request);
    Task<bool> DeleteAsync(long id);
}
