using FitMate.DB.Repositories.Base;

namespace FitMate.DB.Repositories.User;

public interface IUserRepository : IRepository<Entities.User>
{
    Task<Entities.User?> GetByEmailAsync(string email);
    Entities.User? GetByIdNoTracking(long id);
    Task<Entities.User?> GetByIdNoTrackingAsync(long id);
    Task<Entities.User?> GetByIdWithRolesAsync(long id);
    Task<bool> ExistsByEmailAsync(string email);
}
