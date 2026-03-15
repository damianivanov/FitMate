using FitMate.Core.JsonModels.Common;
using FitMate.Core.JsonModels.MuscleGroups;

namespace FitMate.Services.MuscleGroups;

public interface IMuscleGroupService
{
    Task<PagedResponse<MuscleGroupModel>> ListAsync(MuscleGroupQueryRequest request);
    Task<MuscleGroupModel?> GetByIdAsync(long id);
    Task<MuscleGroupModel> CreateAsync(CreateMuscleGroupRequest request, long? actorUserId);
    Task<MuscleGroupModel> UpdateAsync(long id, CreateMuscleGroupRequest request, long? actorUserId);
    Task<bool> DeleteAsync(long id, long? actorUserId);
    Task<IReadOnlyList<MuscleGroupModel>> LookupAsync();
}
