using FitMate.Core.JsonModels.Common;
using FitMate.Core.JsonModels.Errors;

namespace FitMate.Services.Errors;

public interface IAdminErrorService
{
    Task<PagedResponse<ErrorModel>> ListAsync(ErrorQueryRequest request);
    Task<bool> DeleteAsync(long id);
    Task<int> ClearAllAsync();
}
