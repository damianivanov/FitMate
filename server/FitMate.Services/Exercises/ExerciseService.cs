using System.Linq.Expressions;
using System.Threading;
using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.Common;
using FitMate.Core.JsonModels.Exercises;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.Services.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace FitMate.Services.Exercises;

public class ExerciseService : IExerciseService
{
    private const string LookupCacheKeyPrefix = "exercise_lookup";
    private static long lookupCacheVersion = 1;

    private readonly AppDbContext dbContext;
    private readonly IMemoryCache memoryCache;
    private readonly IUserService userService;

    public ExerciseService(AppDbContext dbContext, IMemoryCache memoryCache, IUserService userService)
    {
        this.dbContext = dbContext;
        this.memoryCache = memoryCache;
        this.userService = userService;
    }

    public async Task<PagedResponse<ExerciseModel>> ListAsync(ExerciseQueryRequest request)
    {
        var page = request.Page <= 0 ? 1 : request.Page;
        var pageSize = request.PageSize <= 0 ? 10 : Math.Min(request.PageSize, 100);
        var search = request.Search?.Trim();

        var query = dbContext.Exercises.AsNoTracking().AsQueryable();

        if (request.IsGlobal.HasValue)
        {
            query = request.IsGlobal.Value
                ? query.Where(x => x.UserId == null)
                : query.Where(x => x.UserId != null);
        }

        if (request.UserId.HasValue)
        {
            query = query.Where(x => x.UserId == request.UserId.Value);
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

        return new PagedResponse<ExerciseModel>
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
        };
    }

    public async Task<ExerciseModel?> GetByIdAsync(long id)
    {
        return await dbContext.Exercises
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(MapToModelExpression())
            .FirstOrDefaultAsync();
    }

    public async Task<ExerciseModel> CreateAsync(CreateExerciseRequest request)
    {
        var userId = userService.LoggedInUserId;
        if (!userId.HasValue || userId.Value <= 0)
        {
            throw new FitMateException("Unauthorized.");
        }

        return await CreateInternalAsync(request, userId);
    }

    public async Task<ExerciseModel> UpdateAsync(
        long id,
        CreateExerciseRequest request)
    {
        var exercise = await dbContext.Exercises.FirstOrDefaultAsync(x => x.Id == id);
        if (exercise == null)
        {
            throw new FitMateException("Exercise not found.");
        }

        var normalized = NormalizeRequest(request);
        var validationError = await ValidateRequestAsync(normalized, id);
        if (validationError != null)
        {
            throw new FitMateException(validationError);
        }

        exercise.Name = normalized.Name;
        exercise.Slug = normalized.Slug;
        exercise.Description = normalized.Description;
        exercise.ImageUrl = normalized.ImageUrl;
        exercise.VideoUrl = normalized.VideoUrl;
        exercise.PrimaryMuscleGroupId = normalized.PrimaryMuscleGroupId;
        exercise.SecondaryMuscleGroupId = normalized.SecondaryMuscleGroupId;

        await dbContext.SaveChangesAsync();
        InvalidateLookupCache();

        return MapToModel(exercise);
    }

    public async Task<bool> DeleteAsync(long id)
    {
        var exercise = await dbContext.Exercises.FirstOrDefaultAsync(x => x.Id == id);
        if (exercise == null)
        {
            throw new FitMateException("Exercise not found.");
        }

        dbContext.Exercises.Remove(exercise);

        try
        {
            await dbContext.SaveChangesAsync();
            InvalidateLookupCache();
        }
        catch (DbUpdateException)
        {
            throw new FitMateException("Exercise is used in other records and cannot be deleted.");
        }

        return true;
    }

    public async Task<IReadOnlyList<ExerciseLookupModel>> GetAllAsync(ExerciseLookupRequest request)
    {
        var userId = userService.LoggedInUserId ?? throw new FitMateException("Unauthorized.");

        var normalizedSearch = request.Search?.Trim();
        var muscleGroupId = request.MuscleGroupId > 0 ? request.MuscleGroupId : null;
        var skip = request.Skip < 0 ? 0 : request.Skip;
        var take = request.Take <= 0 ? 30 : Math.Min(request.Take, 100);
        var cacheVersion = GetLookupCacheVersion();
        var cacheKey = BuildLookupCacheKey(cacheVersion, userId, normalizedSearch, muscleGroupId, skip, take);

        if (memoryCache.TryGetValue<IReadOnlyList<ExerciseLookupModel>>(cacheKey, out var cachedItems) && cachedItems != null)
        {
            return cachedItems;
        }

        var query = dbContext.Exercises
            .AsNoTracking()
            .AsQueryable();

        if (muscleGroupId.HasValue)
        {
            query = query.Where(x =>
                x.PrimaryMuscleGroupId == muscleGroupId.Value || x.SecondaryMuscleGroupId == muscleGroupId.Value);
        }

        if (!string.IsNullOrWhiteSpace(normalizedSearch))
        {
            query = query.Where(x =>
                x.Name.Contains(normalizedSearch)
                || x.Slug.Contains(normalizedSearch)
                || x.PrimaryMuscleGroup.Name.Contains(normalizedSearch)
                || (x.SecondaryMuscleGroup != null && x.SecondaryMuscleGroup.Name.Contains(normalizedSearch)));
        }

        var items = (await query
            .OrderBy(x => x.UserId == userId ? 0 : 1)
            .ThenBy(x => x.Name)
            .ThenBy(x => x.Id)
            .Skip(skip)
            .Take(take)
            .Select(x => new ExerciseLookupModel
            {
                Id = x.Id,
                Name = x.Name,
                Slug = x.Slug,
                Description = x.Description,
                ImageUrl = x.ImageUrl,
                VideoUrl = x.VideoUrl,
                UserId = x.UserId,
                IsGlobal = x.UserId == null,
                PrimaryMuscleGroupId = x.PrimaryMuscleGroupId,
                PrimaryMuscleGroupName = x.PrimaryMuscleGroup.Name,
                SecondaryMuscleGroupId = x.SecondaryMuscleGroupId,
                SecondaryMuscleGroupName = x.SecondaryMuscleGroup != null ? x.SecondaryMuscleGroup.Name : null,
                CreatorUserId = x.UserId,
                CreatorDisplayName =
                    x.User == null
                        ? null
                        : x.User.FirstName != null && x.User.FirstName != ""
                            ? x.User.LastName != null && x.User.LastName != ""
                                ? x.User.FirstName + " " + x.User.LastName
                                : x.User.FirstName
                            : x.User.LastName != null && x.User.LastName != ""
                                ? x.User.LastName
                                : x.User.Email != null && x.User.Email != ""
                                    ? x.User.Email
                                    : null,
                DateCreated = x.DateCreated,
            })
            .ToListAsync())
            .AsReadOnly();

        memoryCache.Set(
            cacheKey,
            items,
            new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(150),
                SlidingExpiration = TimeSpan.FromMinutes(15),
            });

        return items;
    }

    public async Task<IReadOnlyList<ExerciseLookupModel>> GetByIdsAsync(IReadOnlyList<long> exerciseIds)
    {
        var userId = userService.LoggedInUserId ?? throw new FitMateException("Unauthorized.");
        var normalizedIds = exerciseIds
            .Where(id => id > 0)
            .Distinct()
            .Take(300)
            .ToArray();

        if (normalizedIds.Length == 0)
        {
            return Array.Empty<ExerciseLookupModel>();
        }

        var items = (await dbContext.Exercises
            .AsNoTracking()
            .Where(x => normalizedIds.Contains(x.Id))
            .Where(x => x.UserId == null || x.UserId == userId)
            .Select(x => new ExerciseLookupModel
            {
                Id = x.Id,
                Name = x.Name,
                Slug = x.Slug,
                Description = x.Description,
                ImageUrl = x.ImageUrl,
                VideoUrl = x.VideoUrl,
                UserId = x.UserId,
                IsGlobal = x.UserId == null,
                PrimaryMuscleGroupId = x.PrimaryMuscleGroupId,
                PrimaryMuscleGroupName = x.PrimaryMuscleGroup.Name,
                SecondaryMuscleGroupId = x.SecondaryMuscleGroupId,
                SecondaryMuscleGroupName = x.SecondaryMuscleGroup != null ? x.SecondaryMuscleGroup.Name : null,
                CreatorUserId = x.UserId,
                CreatorDisplayName =
                    x.User == null
                        ? null
                        : x.User.FirstName != null && x.User.FirstName != ""
                            ? x.User.LastName != null && x.User.LastName != ""
                                ? x.User.FirstName + " " + x.User.LastName
                                : x.User.FirstName
                            : x.User.LastName != null && x.User.LastName != ""
                                ? x.User.LastName
                                : x.User.Email != null && x.User.Email != ""
                                    ? x.User.Email
                                    : null,
                DateCreated = x.DateCreated,
            })
            .ToListAsync())
            .AsReadOnly();

        return items;
    }

    private async Task<ExerciseModel> CreateInternalAsync(
        CreateExerciseRequest request,
        long? exerciseOwnerUserId)
    {
        var normalized = NormalizeRequest(request);
        var validationError = await ValidateRequestAsync(normalized, null);
        if (validationError != null)
        {
            throw new FitMateException(validationError);
        }

        var exercise = new Exercise
        {
            UserId = exerciseOwnerUserId,
            Name = normalized.Name,
            Slug = normalized.Slug,
            Description = normalized.Description,
            ImageUrl = normalized.ImageUrl,
            VideoUrl = normalized.VideoUrl,
            PrimaryMuscleGroupId = normalized.PrimaryMuscleGroupId,
            SecondaryMuscleGroupId = normalized.SecondaryMuscleGroupId,
        };

        dbContext.Exercises.Add(exercise);
        await dbContext.SaveChangesAsync();
        InvalidateLookupCache();

        return MapToModel(exercise);
    }

    private static string BuildLookupCacheKey(
        long version,
        long userId,
        string? search,
        long? muscleGroupId,
        int skip,
        int take)
    {
        var normalizedSearch = string.IsNullOrWhiteSpace(search)
            ? "_"
            : search.Trim().ToLowerInvariant();

        var normalizedMuscleGroup = muscleGroupId?.ToString() ?? "all";
        return
            $"{LookupCacheKeyPrefix}:v{version}:user:{userId}:mg:{normalizedMuscleGroup}:skip:{skip}:take:{take}:q:{normalizedSearch}";
    }

    private static long GetLookupCacheVersion()
    {
        return Interlocked.Read(ref lookupCacheVersion);
    }

    private static void InvalidateLookupCache()
    {
        Interlocked.Increment(ref lookupCacheVersion);
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

    private async Task<string?> ValidateRequestAsync(
        CreateExerciseRequest request,
        long? existingExerciseId = null)
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

        var slugAlreadyExists = await dbContext.Exercises
            .AnyAsync(x =>
                x.Slug == request.Slug
                && (!existingExerciseId.HasValue || x.Id != existingExerciseId.Value));

        if (slugAlreadyExists)
        {
            return "Exercise slug already exists.";
        }

        var primaryExists = await dbContext.MuscleGroups
            .AnyAsync(x => x.Id == request.PrimaryMuscleGroupId);

        if (!primaryExists)
        {
            return "Primary muscle group does not exist.";
        }

        if (request.SecondaryMuscleGroupId.HasValue)
        {
            var secondaryExists = await dbContext.MuscleGroups
                .AnyAsync(x => x.Id == request.SecondaryMuscleGroupId.Value);

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

    private static Expression<Func<Exercise, ExerciseModel>> MapToModelExpression()
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
