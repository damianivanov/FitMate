using System.Linq.Expressions;
using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.Common;
using FitMate.Core.JsonModels.MuscleGroups;
using FitMate.DB;
using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.MuscleGroups;

public class MuscleGroupService : IMuscleGroupService
{
    private readonly AppDbContext dbContext;

    public MuscleGroupService(AppDbContext dbContext)
    {
        this.dbContext = dbContext;
    }

    public async Task<PagedResponse<MuscleGroupModel>> ListAsync(
        MuscleGroupQueryRequest request)
    {
        var page = request.Page <= 0 ? 1 : request.Page;
        var pageSize = request.PageSize <= 0 ? 10 : Math.Min(request.PageSize, 100);
        var search = request.Search?.Trim();

        var query = dbContext.MuscleGroups.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(x => x.Name.Contains(search));
        }

        query = query.OrderBy(x => x.Name).ThenBy(x => x.Id);

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(MapToModelExpression())
            .ToListAsync();

        return new PagedResponse<MuscleGroupModel>
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
        };
    }

    public async Task<MuscleGroupModel?> GetByIdAsync(long id)
    {
        return await dbContext.MuscleGroups
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(MapToModelExpression())
            .FirstOrDefaultAsync();
    }

    public async Task<MuscleGroupModel> CreateAsync(
        CreateMuscleGroupRequest request,
        long? actorUserId)
    {
        var normalized = NormalizeRequest(request);
        var validationError = await ValidateRequestAsync(normalized, null);
        if (validationError != null)
        {
            throw new FitMateException(validationError);
        }

        var muscleGroup = new MuscleGroup
        {
            Name = normalized.Name,
            ImageUrl = normalized.ImageUrl,
        };

        dbContext.MuscleGroups.Add(muscleGroup);
        await dbContext.SaveChangesAsync(actorUserId);

        return MapToModel(muscleGroup);
    }

    public async Task<MuscleGroupModel> UpdateAsync(
        long id,
        CreateMuscleGroupRequest request,
        long? actorUserId)
    {
        var muscleGroup = await dbContext.MuscleGroups.FirstOrDefaultAsync(x => x.Id == id);
        if (muscleGroup == null)
        {
            throw new FitMateException("Muscle group not found.");
        }

        var normalized = NormalizeRequest(request);
        var validationError = await ValidateRequestAsync(normalized, id);
        if (validationError != null)
        {
            throw new FitMateException(validationError);
        }

        muscleGroup.Name = normalized.Name;
        muscleGroup.ImageUrl = normalized.ImageUrl;

        await dbContext.SaveChangesAsync(actorUserId);
        return MapToModel(muscleGroup);
    }

    public async Task<bool> DeleteAsync(long id, long? actorUserId)
    {
        var muscleGroup = await dbContext.MuscleGroups.FirstOrDefaultAsync(x => x.Id == id);
        if (muscleGroup == null)
        {
            throw new FitMateException("Muscle group not found.");
        }

        dbContext.MuscleGroups.Remove(muscleGroup);

        try
        {
            await dbContext.SaveChangesAsync(actorUserId);
        }
        catch (DbUpdateException)
        {
            throw new FitMateException("Muscle group is used in exercises and cannot be deleted.");
        }

        return true;
    }

    public async Task<IReadOnlyList<MuscleGroupModel>> LookupAsync()
    {
        return await dbContext.MuscleGroups
            .AsNoTracking()
            .OrderBy(x => x.Name)
            .Select(MapToModelExpression())
            .ToListAsync();
    }

    private static CreateMuscleGroupRequest NormalizeRequest(CreateMuscleGroupRequest request)
    {
        return new CreateMuscleGroupRequest
        {
            Name = (request.Name ?? string.Empty).Trim(),
            ImageUrl = string.IsNullOrWhiteSpace(request.ImageUrl) ? null : request.ImageUrl.Trim(),
        };
    }

    private async Task<string?> ValidateRequestAsync(
        CreateMuscleGroupRequest request,
        long? existingMuscleGroupId = null)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return "Name is required.";
        }

        var nameExists = await dbContext.MuscleGroups.AnyAsync(
            x => x.Name == request.Name && (!existingMuscleGroupId.HasValue || x.Id != existingMuscleGroupId.Value));

        if (nameExists)
        {
            return "Muscle group name already exists.";
        }

        return null;
    }

    private static MuscleGroupModel MapToModel(MuscleGroup entity)
    {
        return new MuscleGroupModel
        {
            Id = entity.Id,
            Name = entity.Name,
            ImageUrl = entity.ImageUrl,
        };
    }

    private static Expression<Func<MuscleGroup, MuscleGroupModel>> MapToModelExpression()
    {
        return entity => new MuscleGroupModel
        {
            Id = entity.Id,
            Name = entity.Name,
            ImageUrl = entity.ImageUrl,
        };
    }
}
