using FitMate.Core.JsonModels.Common;
using FitMate.Core.JsonModels.Users;

namespace FitMate.Services.Users;

public interface IAdminUserService
{
    Task<PagedResponse<AdminUserModel>> ListAsync(UserQueryRequest request);
    Task<AdminUserModel> UpdateAsync(long id, UpdateUserRequest request);
    Task<bool> DeleteAsync(long id);
}
