using System.Linq.Expressions;
using FitMate.Core.JsonModels.Common;
using FitMate.Core.JsonModels.MuscleGroups;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.Services.Users;
using FitMate.Web.Controllers.Base;
using FitMate.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Web.Controllers;

[Route("api/admin/musclegroups")]
[Authorize(Policy = "Admin")]
public class MuscleGroupController : BaseApiController
{
    public MuscleGroupController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService)
        : base(logger, dbContext, userService)
    {
    }

    [HttpGet]
    public async Task<ActionResult> List([FromQuery] MuscleGroupQueryRequest request)
    {
        var page = request.Page <= 0 ? 1 : request.Page;
        var pageSize = request.PageSize <= 0 ? 10 : Math.Min(request.PageSize, 100);
        var search = request.Search?.Trim();

        var query = DbContext.MuscleGroups.AsNoTracking().AsQueryable();
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

        return this.ReturnJson(new PagedResponse<MuscleGroupModel>
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
        });
    }

    [HttpGet("{id:long}")]
    public async Task<ActionResult> GetById(long id)
    {
        var item = await DbContext.MuscleGroups
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(MapToModelExpression())
            .FirstOrDefaultAsync();

        if (item == null)
        {
            return this.ReturnJsonError("Muscle group not found.");
        }

        return this.ReturnJson(item);
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CreateMuscleGroupRequest request)
    {
        var normalized = NormalizeRequest(request);
        var validationError = await ValidateRequestAsync(normalized);
        if (validationError != null)
        {
            return this.ReturnJsonError(validationError);
        }

        var muscleGroup = new MuscleGroup
        {
            Name = normalized.Name,
            ImageUrl = normalized.ImageUrl,
        };

        DbContext.MuscleGroups.Add(muscleGroup);
        await DbContext.SaveChangesAsync(UserService.LoggedInUserId);

        return this.ReturnJson(MapToModel(muscleGroup));
    }

    [HttpPut("{id:long}")]
    public async Task<ActionResult> Update(long id, [FromBody] CreateMuscleGroupRequest request)
    {
        var muscleGroup = await DbContext.MuscleGroups.FirstOrDefaultAsync(x => x.Id == id);
        if (muscleGroup == null)
        {
            return this.ReturnJsonError("Muscle group not found.");
        }

        var normalized = NormalizeRequest(request);
        var validationError = await ValidateRequestAsync(normalized, id);
        if (validationError != null)
        {
            return this.ReturnJsonError(validationError);
        }

        muscleGroup.Name = normalized.Name;
        muscleGroup.ImageUrl = normalized.ImageUrl;

        await DbContext.SaveChangesAsync(UserService.LoggedInUserId);
        return this.ReturnJson(MapToModel(muscleGroup));
    }

    [HttpDelete("{id:long}")]
    public async Task<ActionResult> Delete(long id)
    {
        var muscleGroup = await DbContext.MuscleGroups.FirstOrDefaultAsync(x => x.Id == id);
        if (muscleGroup == null)
        {
            return this.ReturnJsonError("Muscle group not found.");
        }

        DbContext.MuscleGroups.Remove(muscleGroup);

        try
        {
            await DbContext.SaveChangesAsync(UserService.LoggedInUserId);
        }
        catch (DbUpdateException)
        {
            return this.ReturnJsonError("Muscle group is used in exercises and cannot be deleted.");
        }

        return this.ReturnJson("Muscle group deleted.");
    }

    [AllowAnonymous]
    [HttpGet("/api/musclegroups/lookup")]
    public async Task<ActionResult> GetLookup()
    {
        var items = await DbContext.MuscleGroups
            .AsNoTracking()
            .OrderBy(x => x.Name)
            .Select(MapToModelExpression())
            .ToListAsync();

        return this.ReturnJson(items);
    }

    private static CreateMuscleGroupRequest NormalizeRequest(CreateMuscleGroupRequest request)
    {
        return new CreateMuscleGroupRequest
        {
            Name = (request.Name ?? string.Empty).Trim(),
            ImageUrl = string.IsNullOrWhiteSpace(request.ImageUrl) ? null : request.ImageUrl.Trim(),
        };
    }

    private async Task<string?> ValidateRequestAsync(CreateMuscleGroupRequest request, long? existingMuscleGroupId = null)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return "Name is required.";
        }

        var nameExists = await DbContext.MuscleGroups.AnyAsync(x =>
            x.Name == request.Name && (!existingMuscleGroupId.HasValue || x.Id != existingMuscleGroupId.Value));

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
