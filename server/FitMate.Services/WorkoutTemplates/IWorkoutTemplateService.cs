using FitMate.Core.JsonModels.WorkoutTemplates;

namespace FitMate.Services.WorkoutTemplates;

public interface IWorkoutTemplateService
{
    Task<IReadOnlyList<WorkoutTemplateModel>> ListAsync(long userId);
    Task<WorkoutTemplateModel?> GetByIdAsync(long templateId, long userId);
    Task<WorkoutTemplateModel> CreateAsync(CreateWorkoutTemplateRequest request, long userId);
    Task<WorkoutTemplateModel> CreateFromWorkoutAsync(long workoutId, CreateTemplateFromWorkoutRequest request, long userId);
    Task<WorkoutTemplateModel> UpdateAsync(long templateId, CreateWorkoutTemplateRequest request, long userId);
    Task<bool> DeleteAsync(long templateId, long userId);
}
