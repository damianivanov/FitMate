using FitMate.DB.Entities.Base;

namespace FitMate.DB.Repositories.Base;

public interface IRepository<T> where T : class, IBaseEntity
{
    Task<T?> GetByIdAsync(long id);
    Task<T> AddAsync(T entity);
    Task DeleteAsync(T entity);
    Task UpdateAsync(T entity);
}
