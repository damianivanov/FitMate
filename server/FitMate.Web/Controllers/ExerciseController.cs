using FitMate.Core.JsonModels.Common;
using FitMate.Core.JsonModels.Exercises;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.Services.Users;
using FitMate.Web.Controllers.Base;
using FitMate.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Web.Controllers;

[Authorize(Policy = "Admin")]
[Route("api/admin/exercises")]
public class ExerciseController : BaseApiController
{
    public ExerciseController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService)
        : base(logger, dbContext, userService)
    {
    }

    [HttpGet]
    public async Task<ActionResult> List([FromQuery] ExerciseQueryRequest request)
    {
        var page = request.Page <= 0 ? 1 : request.Page;
        var pageSize = request.PageSize <= 0 ? 10 : Math.Min(request.PageSize, 100);
        var search = request.Search?.Trim();

        var query = DbContext.Exercises.AsNoTracking().AsQueryable();

        if (request.IsGlobal.HasValue)
        {
            query = request.IsGlobal.Value
                ? query.Where(x => x.UserId == null)
                : query.Where(x => x.UserId != null);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(x => x.Name.Contains(search) || x.Slug.Contains(search));
        }

        query = query.OrderByDescending(x => x.DateCreated).ThenByDescending(x => x.Id);

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(MapToModelExpression())
            .ToListAsync();

        return this.ReturnJson(new PagedResponse<ExerciseModel>
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
        var item = await DbContext.Exercises
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(MapToModelExpression())
            .FirstOrDefaultAsync();

        if (item == null)
        {
            return this.ReturnJsonError("Exercise not found.");
        }

        return this.ReturnJson(item);
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CreateExerciseRequest request)
    {
        var normalized = NormalizeRequest(request);
        var validationError = await ValidateRequestAsync(normalized);
        if (validationError != null)
        {
            return this.ReturnJsonError(validationError);
        }

        var exercise = new Exercise
        {
            UserId = null,
            Name = normalized.Name,
            Slug = normalized.Slug,
            Description = normalized.Description,
            ImageUrl = normalized.ImageUrl,
            VideoUrl = normalized.VideoUrl,
            PrimaryMuscleGroupId = normalized.PrimaryMuscleGroupId,
            SecondaryMuscleGroupId = normalized.SecondaryMuscleGroupId,
        };

        DbContext.Exercises.Add(exercise);
        await DbContext.SaveChangesAsync(UserService.LoggedInUserId);

        return this.ReturnJson(MapToModel(exercise));
    }

    [HttpPut("{id:long}")]
    public async Task<ActionResult> Update(long id, [FromBody] CreateExerciseRequest request)
    {
        var exercise = await DbContext.Exercises.FirstOrDefaultAsync(x => x.Id == id);
        if (exercise == null)
        {
            return this.ReturnJsonError("Exercise not found.");
        }

        var normalized = NormalizeRequest(request);
        var validationError = await ValidateRequestAsync(normalized, id);
        if (validationError != null)
        {
            return this.ReturnJsonError(validationError);
        }

        exercise.Name = normalized.Name;
        exercise.Slug = normalized.Slug;
        exercise.Description = normalized.Description;
        exercise.ImageUrl = normalized.ImageUrl;
        exercise.VideoUrl = normalized.VideoUrl;
        exercise.PrimaryMuscleGroupId = normalized.PrimaryMuscleGroupId;
        exercise.SecondaryMuscleGroupId = normalized.SecondaryMuscleGroupId;

        await DbContext.SaveChangesAsync(UserService.LoggedInUserId);

        return this.ReturnJson(MapToModel(exercise));
    }

    [HttpDelete("{id:long}")]
    public async Task<ActionResult> Delete(long id)
    {
        var exercise = await DbContext.Exercises.FirstOrDefaultAsync(x => x.Id == id);
        if (exercise == null)
        {
            return this.ReturnJsonError("Exercise not found.");
        }

        DbContext.Exercises.Remove(exercise);

        try
        {
            await DbContext.SaveChangesAsync(UserService.LoggedInUserId);
        }
        catch (DbUpdateException)
        {
            return this.ReturnJsonError("Exercise is used in other records and cannot be deleted.");
        }

        return this.ReturnJson("Exercise deleted.");
    }

    private static CreateExerciseRequest NormalizeRequest(CreateExerciseRequest request)
    {
        return new CreateExerciseRequest
        {
            Name = (request.Name ?? string.Empty).Trim(),
            Slug = (request.Slug ?? string.Empty).Trim().ToLowerInvariant(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            ImageUrl = string.IsNullOrWhiteSpace(request.ImageUrl) ? null : request.ImageUrl.Trim(),
            VideoUrl = string.IsNullOrWhiteSpace(request.VideoUrl) ? null : request.VideoUrl.Trim(),
            PrimaryMuscleGroupId = request.PrimaryMuscleGroupId,
            SecondaryMuscleGroupId = request.SecondaryMuscleGroupId,
        };
    }

    private async Task<string?> ValidateRequestAsync(CreateExerciseRequest request, long? existingExerciseId = null)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return "Name is required.";
        }

        if (string.IsNullOrWhiteSpace(request.Slug))
        {
            return "Slug is required.";
        }

        if (request.PrimaryMuscleGroupId <= 0)
        {
            return "Primary muscle group id is required.";
        }

        if (request.SecondaryMuscleGroupId.HasValue && request.SecondaryMuscleGroupId <= 0)
        {
            return "Secondary muscle group id is invalid.";
        }

        if (request.SecondaryMuscleGroupId == request.PrimaryMuscleGroupId)
        {
            return "Primary and secondary muscle groups must be different.";
        }

        var slugAlreadyExists = await DbContext.Exercises
            .AnyAsync(x => x.Slug == request.Slug && (!existingExerciseId.HasValue || x.Id != existingExerciseId.Value));

        if (slugAlreadyExists)
        {
            return "Exercise slug already exists.";
        }

        var primaryExists = await DbContext.MuscleGroups.AnyAsync(x => x.Id == request.PrimaryMuscleGroupId);
        if (!primaryExists)
        {
            return "Primary muscle group does not exist.";
        }

        if (request.SecondaryMuscleGroupId.HasValue)
        {
            var secondaryExists = await DbContext.MuscleGroups.AnyAsync(x => x.Id == request.SecondaryMuscleGroupId.Value);
            if (!secondaryExists)
            {
                return "Secondary muscle group does not exist.";
            }
        }

        return null;
    }

    private static ExerciseModel MapToModel(Exercise entity)
    {
        return new ExerciseModel
        {
            Id = entity.Id,
            UserId = entity.UserId,
            Name = entity.Name,
            Slug = entity.Slug,
            Description = entity.Description,
            ImageUrl = entity.ImageUrl,
            VideoUrl = entity.VideoUrl,
            PrimaryMuscleGroupId = entity.PrimaryMuscleGroupId,
            SecondaryMuscleGroupId = entity.SecondaryMuscleGroupId,
            DateCreated = entity.DateCreated,
            DateModified = entity.DateModified,
        };
    }

    private static System.Linq.Expressions.Expression<Func<Exercise, ExerciseModel>> MapToModelExpression()
    {
        return entity => new ExerciseModel
        {
            Id = entity.Id,
            UserId = entity.UserId,
            Name = entity.Name,
            Slug = entity.Slug,
            Description = entity.Description,
            ImageUrl = entity.ImageUrl,
            VideoUrl = entity.VideoUrl,
            PrimaryMuscleGroupId = entity.PrimaryMuscleGroupId,
            SecondaryMuscleGroupId = entity.SecondaryMuscleGroupId,
            DateCreated = entity.DateCreated,
            DateModified = entity.DateModified,
        };
    }
}
