using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.Common;
using FitMate.Core.JsonModels.Errors;
using FitMate.DB;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.Errors;

public class AdminErrorService : IAdminErrorService
{
    private readonly AppDbContext dbContext;

    public AdminErrorService(AppDbContext dbContext)
    {
        this.dbContext = dbContext;
    }

    public async Task<PagedResponse<ErrorModel>> ListAsync(ErrorQueryRequest request)
    {
        var page = request.Page <= 0 ? 1 : request.Page;
        var pageSize = request.PageSize <= 0 ? 20 : Math.Min(request.PageSize, 100);
        var search = request.Search?.Trim();

        var query = dbContext.Errors.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(x =>
                x.Message.Contains(search)
                || x.RequestUrl.Contains(search)
                || (x.Source != null && x.Source.Contains(search))
                || (x.Action != null && x.Action.Contains(search)));
        }

        query = query.OrderByDescending(x => x.DateCreated).ThenByDescending(x => x.Id);

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new ErrorModel
            {
                Id = x.Id,
                Source = x.Source,
                Action = x.Action,
                RequestUrl = x.RequestUrl,
                UserAgent = x.UserAgent,
                Message = x.Message,
                Exception = x.Exception,
                DateCreated = x.DateCreated,
                CreatedById = x.CreatedById,
                CreatedByEmail = x.CreatedBy != null ? x.CreatedBy.Email : null,
            })
            .ToListAsync();

        return new PagedResponse<ErrorModel>
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
        };
    }

    public async Task<bool> DeleteAsync(long id)
    {
        var deleted = await dbContext.Errors.Where(x => x.Id == id).ExecuteDeleteAsync();
        if (deleted == 0)
        {
            throw new FitMateException("Error not found.");
        }

        return true;
    }

    public async Task<int> ClearAllAsync()
    {
        return await dbContext.Errors.ExecuteDeleteAsync();
    }
}
