using FitMate.Core.JsonModels.AdminAI;
using FitMate.Core.JsonModels.Common;

namespace FitMate.Services.AdminAI;

public interface IAdminUnsupportedRequestService
{
    Task<PagedResponse<UnsupportedAIRequestModel>> ListAsync(UnsupportedRequestQueryRequest request);

    Task<UnsupportedAIRequestModel?> GetByIdAsync(long id);

    Task<UnsupportedAIRequestModel> UpdateAsync(long id, UpdateUnsupportedRequestRequest request);

    Task<IReadOnlyList<string>> GetCategoriesAsync();
}
