using FitMate.Core.JsonModels.Common;
using FitMate.Core.JsonModels.MuscleGroups;

namespace FitMate.Services.MuscleGroups;

public interface IMuscleGroupService
{
    Task<IReadOnlyList<GridColumnOptionsModel>> GetGridOptionsAsync();

    Task<PagedResponse<MuscleGroupModel>> ListAsync(MuscleGroupQueryRequest request);
    Task<MuscleGroupModel> UpdateAsync(long id, CreateMuscleGroupRequest request);
    Task<bool> DeleteAsync(long id);
    Task<IReadOnlyList<MuscleGroupModel>> GetAllForLookupAsync();
}
