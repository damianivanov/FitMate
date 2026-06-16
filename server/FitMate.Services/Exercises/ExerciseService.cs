using System.Linq.Expressions;
using System.Text.RegularExpressions;
using System.Threading;
using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.Common;
using FitMate.Core.JsonModels.Exercises;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.Services.Storage.Blobs;
using FitMate.Services.Storage.Imaging;
using FitMate.Services.Storage.Urls;
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
    private readonly IBlobStorageService blobStorage;
    private readonly IImageProcessor imageProcessor;
    private readonly IPhotoUrlResolver photoUrlResolver;

    public ExerciseService(
        AppDbContext dbContext,
        IMemoryCache memoryCache,
        IUserService userService,
        IBlobStorageService blobStorage,
        IImageProcessor imageProcessor,
        IPhotoUrlResolver photoUrlResolver)
    {
        this.dbContext = dbContext;
        this.memoryCache = memoryCache;
        this.userService = userService;
        this.blobStorage = blobStorage;
        this.imageProcessor = imageProcessor;
        this.photoUrlResolver = photoUrlResolver;
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
            var loweredSearch = search.ToLower();
            query = query.Where(x =>
                x.Name.ToLower().Contains(loweredSearch)
                || x.Slug.ToLower().Contains(loweredSearch));
        }

        query = query.OrderByDescending(x => x.DateCreated).ThenByDescending(x => x.Id);

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(MapToModelExpression())
            .ToListAsync();

        foreach (var item in items)
        {
            await ResolveModelUrlsAsync(item);
        }

        return new PagedResponse<ExerciseModel>
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
        };
    }

    public async Task<ExerciseModel> CreateAsync(CreateExerciseRequest request)
    {
        var userId = userService.LoggedInUserId ?? throw new FitMateException("Unauthorized.");

        return userService.LoggedInUserIsAdmin
            ? await CreateInternalAsync(request, exerciseOwnerUserId: null, isPublic: true)
            : await CreateInternalAsync(request, exerciseOwnerUserId: userId, isPublic: request.IsPublic);
    }

    public async Task<ExerciseModel> UpdateAsync(
        long id,
        CreateExerciseRequest request)
    {
        var exercise = await LoadEditableExerciseAsync(id);

        var normalized = NormalizeRequest(request);
        var validationError = await ValidateRequestAsync(normalized, id);
        if (validationError != null)
        {
            throw new FitMateException(validationError);
        }

        exercise.Name = normalized.Name;
        exercise.Slug = normalized.Slug;
        exercise.Description = normalized.Description;
        exercise.VideoUrl = normalized.VideoUrl;
        exercise.PrimaryMuscleGroupId = normalized.PrimaryMuscleGroupId;
        exercise.SecondaryMuscleGroupId = normalized.SecondaryMuscleGroupId;

        if (exercise.UserId == userService.LoggedInUserId)
        {
            exercise.IsPublic = normalized.IsPublic;
        }

        await dbContext.SaveChangesAsync();
        InvalidateLookupCache();

        return await ResolveModelUrlsAsync(MapToModel(exercise));
    }

    public async Task<ExerciseModel> UploadImageAsync(long id, Stream content, string fileName)
    {
        var exercise = await dbContext.Exercises.FirstOrDefaultAsync(x => x.Id == id);
        if (exercise == null)
        {
            throw new FitMateException("Exercise not found.");
        }

        if (!userService.LoggedInUserIsAdmin && exercise.UserId != userService.LoggedInUserId)
        {
            throw new FitMateException("You can only change images for your own exercises.");
        }

        var processed = await imageProcessor.ProcessAsync(content);
        if (processed == null)
        {
            throw new FitMateException("The uploaded file is not a valid image.");
        }

        if (BlobPathBuilder.IsOwnedBlobPath(exercise.ImageUrl))
        {
            await blobStorage.DeleteByPrefixAsync($"{StorageModule.Exercises.ToFolder()}/{id}/");
        }

        var blobPath = BlobPathBuilder.Build(StorageModule.Exercises, id, fileName, processed.Extension, DateTime.UtcNow);
        await blobStorage.UploadAsync(processed.Content, blobPath, processed.ContentType);

        // Persist only the file name; the {module}/{id}/ prefix is rebuilt on read via BlobPathBuilder.Compose.
        exercise.ImageUrl = Path.GetFileName(blobPath);
        await dbContext.SaveChangesAsync();
        InvalidateLookupCache();

        return await ResolveModelUrlsAsync(MapToModel(exercise));
    }

    public async Task<bool> DeleteAsync(long id)
    {
        var exercise = await LoadEditableExerciseAsync(id);

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

    private async Task<Exercise> LoadEditableExerciseAsync(long id)
    {
        var userId = userService.LoggedInUserId ?? throw new FitMateException("Unauthorized.");

        var exercise = await dbContext.Exercises.FirstOrDefaultAsync(x => x.Id == id);
        if (exercise == null || (!userService.LoggedInUserIsAdmin && exercise.UserId != userId))
        {
            throw new FitMateException("Exercise not found.");
        }

        return exercise;
    }

    public async Task<IReadOnlyList<ExerciseLookupModel>> GetAllAsync(ExerciseLookupRequest request)
    {
        var userId = userService.LoggedInUserId ?? throw new FitMateException("Unauthorized.");

        var normalizedSearch = request.Search?.Trim();
        var muscleGroupIds = (request.MuscleGroupIds ?? new List<long>())
            .Where(id => id > 0)
            .Distinct()
            .OrderBy(id => id)
            .ToArray();
        var skip = request.Skip < 0 ? 0 : request.Skip;
        var take = request.Take <= 0 ? 30 : Math.Min(request.Take, 100);
        var cacheVersion = GetLookupCacheVersion();
        var cacheKey = BuildLookupCacheKey(cacheVersion, userId, normalizedSearch, muscleGroupIds, skip, take);

        if (!memoryCache.TryGetValue<IReadOnlyList<ExerciseLookupModel>>(cacheKey, out var cachedItems) || cachedItems == null)
        {
            var query = dbContext.Exercises
                .AsNoTracking()
                .Where(x => x.IsPublic || x.UserId == userId);

            if (muscleGroupIds.Length > 0)
            {
                query = query.Where(x =>
                    muscleGroupIds.Contains(x.PrimaryMuscleGroupId)
                    || (x.SecondaryMuscleGroupId != null && muscleGroupIds.Contains(x.SecondaryMuscleGroupId.Value)));
            }

            if (!string.IsNullOrWhiteSpace(normalizedSearch))
            {
                var loweredSearch = normalizedSearch.ToLower();
                query = query.Where(x =>
                    x.Name.ToLower().Contains(loweredSearch)
                    || x.Slug.ToLower().Contains(loweredSearch)
                    || x.PrimaryMuscleGroup.Name.ToLower().Contains(loweredSearch)
                    || (x.SecondaryMuscleGroup != null && x.SecondaryMuscleGroup.Name.ToLower().Contains(loweredSearch)));
            }

            cachedItems = (await query
                .OrderBy(x => x.UserId == userId ? 0 : 1)
                .ThenBy(x => x.Name)
                .ThenBy(x => x.Id)
                .Skip(skip)
                .Take(take)
                .Select(MapToLookupModelExpression())
                .ToListAsync())
                .AsReadOnly();

            memoryCache.Set(
                cacheKey,
                cachedItems,
                new MemoryCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(150),
                    SlidingExpiration = TimeSpan.FromMinutes(15),
                });
        }

        return await ResolveLookupUrlsAsync(cachedItems);
    }

    public async Task<IReadOnlyList<ExerciseLookupModel>> GetMineAsync(ExerciseLookupRequest request)
    {
        var userId = userService.LoggedInUserId ?? throw new FitMateException("Unauthorized.");

        var normalizedSearch = request.Search?.Trim();
        var muscleGroupIds = (request.MuscleGroupIds ?? new List<long>())
            .Where(id => id > 0)
            .Distinct()
            .ToArray();

        var query = dbContext.Exercises
            .AsNoTracking()
            .Where(x => x.UserId == userId);

        if (muscleGroupIds.Length > 0)
        {
            query = query.Where(x =>
                muscleGroupIds.Contains(x.PrimaryMuscleGroupId)
                || (x.SecondaryMuscleGroupId != null && muscleGroupIds.Contains(x.SecondaryMuscleGroupId.Value)));
        }

        if (!string.IsNullOrWhiteSpace(normalizedSearch))
        {
            var loweredSearch = normalizedSearch.ToLower();
            query = query.Where(x =>
                x.Name.ToLower().Contains(loweredSearch)
                || x.Slug.ToLower().Contains(loweredSearch)
                || x.PrimaryMuscleGroup.Name.ToLower().Contains(loweredSearch)
                || (x.SecondaryMuscleGroup != null && x.SecondaryMuscleGroup.Name.ToLower().Contains(loweredSearch)));
        }

        var skip = request.Skip < 0 ? 0 : request.Skip;
        var take = request.Take <= 0 ? 30 : Math.Min(request.Take, 100);

        var items = await query
            .OrderByDescending(x => x.DateCreated)
            .ThenByDescending(x => x.Id)
            .Skip(skip)
            .Take(take)
            .Select(MapToLookupModelExpression())
            .ToListAsync();

        return await ResolveLookupUrlsAsync(items);
    }

    private async Task<ExerciseModel> CreateInternalAsync(
        CreateExerciseRequest request,
        long? exerciseOwnerUserId,
        bool isPublic)
    {
        var normalized = NormalizeRequest(request);

        normalized.Slug = await GenerateUniqueSlugAsync(normalized.Name);

        var validationError = await ValidateRequestAsync(normalized, null);
        if (validationError != null)
        {
            throw new FitMateException(validationError);
        }

        var exercise = new Exercise
        {
            UserId = exerciseOwnerUserId,
            IsPublic = isPublic,
            Name = normalized.Name,
            Slug = normalized.Slug,
            Description = normalized.Description,
            VideoUrl = normalized.VideoUrl,
            PrimaryMuscleGroupId = normalized.PrimaryMuscleGroupId,
            SecondaryMuscleGroupId = normalized.SecondaryMuscleGroupId,
        };

        dbContext.Exercises.Add(exercise);
        await dbContext.SaveChangesAsync();
        InvalidateLookupCache();

        return await ResolveModelUrlsAsync(MapToModel(exercise));
    }

    private async Task<string> GenerateUniqueSlugAsync(string name)
    {
        var baseSlug = Slugify(name);
        if (string.IsNullOrEmpty(baseSlug))
        {
            baseSlug = "exercise";
        }

        var slug = baseSlug;
        var suffix = 2;
        while (await dbContext.Exercises.AnyAsync(x => x.Slug == slug))
        {
            slug = $"{baseSlug}-{suffix}";
            suffix++;
        }

        return slug;
    }

    private static string Slugify(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var lower = value.Trim().ToLowerInvariant();
        return Regex.Replace(lower, "[^a-z0-9]+", "-").Trim('-');
    }

    private static string BuildLookupCacheKey(
        long version,
        long userId,
        string? search,
        IReadOnlyList<long> muscleGroupIds,
        int skip,
        int take)
    {
        var normalizedSearch = string.IsNullOrWhiteSpace(search)
            ? "_"
            : search.Trim().ToLowerInvariant();

        var normalizedMuscleGroups = muscleGroupIds.Count == 0
            ? "all"
            : string.Join(",", muscleGroupIds);
        return
            $"{LookupCacheKeyPrefix}:v{version}:user:{userId}:mg:{normalizedMuscleGroups}:skip:{skip}:take:{take}:q:{normalizedSearch}";
    }

    private static long GetLookupCacheVersion()
    {
        return Interlocked.Read(ref lookupCacheVersion);
    }

    private static void InvalidateLookupCache()
    {
        Interlocked.Increment(ref lookupCacheVersion);
    }

    private async Task<ExerciseModel> ResolveModelUrlsAsync(ExerciseModel model)
    {
        model.ImageUrl = await photoUrlResolver.ResolveAsync(
            BlobPathBuilder.Compose(StorageModule.Exercises, model.Id, model.ImageUrl));
        model.VideoUrl = await photoUrlResolver.ResolveAsync(
            BlobPathBuilder.Compose(StorageModule.Exercises, model.Id, model.VideoUrl));
        return model;
    }

    private async Task<IReadOnlyList<ExerciseLookupModel>> ResolveLookupUrlsAsync(IReadOnlyList<ExerciseLookupModel> items)
    {
        var resolved = new List<ExerciseLookupModel>(items.Count);
        foreach (var item in items)
        {
            resolved.Add(new ExerciseLookupModel
            {
                Id = item.Id,
                UserId = item.UserId,
                IsGlobal = item.IsGlobal,
                IsPublic = item.IsPublic,
                Name = item.Name,
                Slug = item.Slug,
                Description = item.Description,
                ImageUrl = await photoUrlResolver.ResolveAsync(
                    BlobPathBuilder.Compose(StorageModule.Exercises, item.Id, item.ImageUrl)),
                VideoUrl = await photoUrlResolver.ResolveAsync(
                    BlobPathBuilder.Compose(StorageModule.Exercises, item.Id, item.VideoUrl)),
                PrimaryMuscleGroupId = item.PrimaryMuscleGroupId,
                PrimaryMuscleGroupName = item.PrimaryMuscleGroupName,
                SecondaryMuscleGroupId = item.SecondaryMuscleGroupId,
                SecondaryMuscleGroupName = item.SecondaryMuscleGroupName,
                CreatorUserId = item.CreatorUserId,
                CreatorDisplayName = item.CreatorDisplayName,
                DateCreated = item.DateCreated,
            });
        }

        return resolved.AsReadOnly();
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
            IsPublic = request.IsPublic,
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
            IsPublic = entity.IsPublic,
            Name = entity.Name,
            Slug = entity.Slug,
            Description = entity.Description,
            ImageUrl = entity.ImageUrl,
            VideoUrl = entity.VideoUrl,
            PrimaryMuscleGroupId = entity.PrimaryMuscleGroupId,
            SecondaryMuscleGroupId = entity.SecondaryMuscleGroupId,
            CreatorDisplayName = ResolveCreatorName(entity.User),
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
            IsPublic = entity.IsPublic,
            Name = entity.Name,
            Slug = entity.Slug,
            Description = entity.Description,
            ImageUrl = entity.ImageUrl,
            VideoUrl = entity.VideoUrl,
            PrimaryMuscleGroupId = entity.PrimaryMuscleGroupId,
            SecondaryMuscleGroupId = entity.SecondaryMuscleGroupId,
            CreatorDisplayName =
                entity.User == null
                    ? null
                    : entity.User.FirstName != null && entity.User.FirstName != ""
                        ? entity.User.LastName != null && entity.User.LastName != ""
                            ? entity.User.FirstName + " " + entity.User.LastName
                            : entity.User.FirstName
                        : entity.User.LastName != null && entity.User.LastName != ""
                            ? entity.User.LastName
                            : entity.User.Email != null && entity.User.Email != ""
                                ? entity.User.Email
                                : null,
            DateCreated = entity.DateCreated,
            DateModified = entity.DateModified,
        };
    }

    private static string? ResolveCreatorName(User? user)
    {
        if (user == null)
        {
            return null;
        }

        if (!string.IsNullOrEmpty(user.FirstName))
        {
            return !string.IsNullOrEmpty(user.LastName)
                ? $"{user.FirstName} {user.LastName}"
                : user.FirstName;
        }

        if (!string.IsNullOrEmpty(user.LastName))
        {
            return user.LastName;
        }

        return string.IsNullOrEmpty(user.Email) ? null : user.Email;
    }

    private static Expression<Func<Exercise, ExerciseLookupModel>> MapToLookupModelExpression()
    {
        return x => new ExerciseLookupModel
        {
            Id = x.Id,
            Name = x.Name,
            Slug = x.Slug,
            Description = x.Description,
            ImageUrl = x.ImageUrl,
            VideoUrl = x.VideoUrl,
            UserId = x.UserId,
            IsGlobal = x.UserId == null,
            IsPublic = x.IsPublic,
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
        };
    }
}
