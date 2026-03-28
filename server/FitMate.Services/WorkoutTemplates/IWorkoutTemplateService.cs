using FitMate.Core.JsonModels.WorkoutTemplates;

namespace FitMate.Services.WorkoutTemplates;

public interface IWorkoutTemplateService
{
    Task<IReadOnlyList<WorkoutTemplateModel>> ListAsync(long userId);
    Task<WorkoutTemplateModel> CreateAsync(CreateWorkoutTemplateRequest request, long userId);
}
