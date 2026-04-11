using FitMate.Core.JsonModels.Common;
using FitMate.Core.JsonModels.MuscleGroups;

namespace FitMate.Services.MuscleGroups;

public interface IMuscleGroupService
{
    Task<PagedResponse<MuscleGroupModel>> ListAsync(MuscleGroupQueryRequest request);
    Task<MuscleGroupModel?> GetByIdAsync(long id);
    Task<MuscleGroupModel> CreateAsync(CreateMuscleGroupRequest request);
    Task<MuscleGroupModel> UpdateAsync(long id, CreateMuscleGroupRequest request);
    Task<bool> DeleteAsync(long id);
    Task<IReadOnlyList<MuscleGroupModel>> GetAllForLookupAsync();
}
