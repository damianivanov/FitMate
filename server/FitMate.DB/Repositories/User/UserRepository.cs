using FitMate.DB.Repositories.Base;
using Microsoft.EntityFrameworkCore;

namespace FitMate.DB.Repositories.User;

public class UserRepository : Repository<Entities.User>, IUserRepository
{
    public UserRepository(AppDbContext dbContext)
        : base(dbContext)
    {
    }

    public async Task<Entities.User?> GetByEmailAsync(string email)
    {
        return await DbContext.Users.FirstOrDefaultAsync(x => x.Email == email);
    }

    public async Task<Entities.User?> GetByIdNoTrackingAsync(long id)
    {
        return await DbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id);
    }

    public Entities.User? GetByIdNoTracking(long id)
    {
        return DbContext.Users
            .AsNoTracking()
            .FirstOrDefault(x => x.Id == id);
    }

    public async Task<Entities.User?> GetByIdWithRolesAsync(long id)
    {
        return await DbContext.Users
            .Include(x => x.UserRoles)
                .ThenInclude(x => x.Role)
            .FirstOrDefaultAsync(x => x.Id == id);
    }

    public async Task<bool> ExistsByEmailAsync(string email)
    {
        return await DbContext.Users.AnyAsync(x => x.Email == email);
    }
}
