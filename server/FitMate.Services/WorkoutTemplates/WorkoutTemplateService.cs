using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.WorkoutTemplates;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.Storage.Urls;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.WorkoutTemplates;

public class WorkoutTemplateService : IWorkoutTemplateService
{
    private readonly AppDbContext dbContext;
    private readonly IPhotoUrlResolver photoUrlResolver;

    public WorkoutTemplateService(
        AppDbContext dbContext,
        IPhotoUrlResolver photoUrlResolver)
    {
        this.dbContext = dbContext;
        this.photoUrlResolver = photoUrlResolver;
    }

    public async Task<IReadOnlyList<WorkoutTemplateModel>> ListAsync(long userId)
    {
        if (userId <= 0)
        {
            throw new FitMateException("Unauthorized.");
        }

        var templates = await BuildTemplateDetailsQuery(asNoTracking: true)
            .Where(x => x.UserId == userId || x.IsPublic)
            .OrderByDescending(x => x.DateCreated)
            .ThenByDescending(x => x.Id)
            .ToListAsync();
        
        var resolvedImageUrls = new Dictionary<string, string?>();
        var result = new List<WorkoutTemplateModel>(templates.Count);
        foreach (var template in templates)
        {
            result.Add(await ResolveImageUrlsAsync(MapTemplate(template), resolvedImageUrls));
        }

        return result;
    }

    public async Task<WorkoutTemplateModel?> GetByIdAsync(long templateId, long userId)
    {
        if (userId <= 0)
        {
            throw new FitMateException("Unauthorized.");
        }

        var template = await BuildTemplateDetailsQuery(asNoTracking: true)
            .FirstOrDefaultAsync(x => x.Id == templateId && (x.UserId == userId || x.IsPublic));

        return template == null
            ? null
            : await ResolveImageUrlsAsync(MapTemplate(template), new Dictionary<string, string?>());
    }

    public async Task<WorkoutTemplateModel> CreateAsync(
        CreateWorkoutTemplateRequest request,
        long userId)
    {
        if (userId <= 0)
        {
            throw new FitMateException("Unauthorized.");
        }

        var preparedTemplate = await PrepareTemplateAsync(request);
        var workoutTemplate = new WorkoutTemplate
        {
            UserId = userId,
        };
        ApplyTemplateDetails(workoutTemplate, preparedTemplate);

        await using var transaction = await dbContext.Database.BeginTransactionAsync();

        try
        {
            dbContext.WorkoutTemplates.Add(workoutTemplate);
            await dbContext.SaveChangesAsync(userId);
            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }

        return await ResolveImageUrlsAsync(
            MapTemplate(
                workoutTemplate,
                preparedTemplate.ExerciseNamesById,
                preparedTemplate.ExerciseImageUrlsById),
            new Dictionary<string, string?>());
    }

    public async Task<WorkoutTemplateModel> CreateFromWorkoutAsync(
        long workoutId,
        CreateTemplateFromWorkoutRequest request,
        long userId)
    {
        if (userId <= 0)
        {
            throw new FitMateException("Unauthorized.");
        }

        if (workoutId <= 0)
        {
            throw new FitMateException("Workout id is invalid.");
        }

        var workout = await dbContext.Workouts
            .AsNoTracking()
            .Include(x => x.ExerciseGroups)
                .ThenInclude(x => x.Exercises)
                    .ThenInclude(x => x.Sets)
            .AsSplitQuery()
            .FirstOrDefaultAsync(x => x.Id == workoutId && x.UserId == userId);

        if (workout == null)
        {
            throw new FitMateException("Workout not found.");
        }

        var name = NormalizeNullable(request.Name) ?? NormalizeNullable(workout.Title) ?? "New template";
        var templateRequest = new CreateWorkoutTemplateRequest
        {
            Name = name,
            Description = NormalizeNullable(request.Description),
            EstimatedDurationMinutes = request.EstimatedDurationMinutes,
            IsPublic = request.IsPublic,
            Exercises = BuildTemplateExercisesFromWorkout(workout),
        };

        if (templateRequest.Exercises.Count == 0)
        {
            throw new FitMateException("This workout has no sets with logged values to build a template from.");
        }

        return await CreateAsync(templateRequest, userId);
    }

    public async Task<WorkoutTemplateModel> UpdateAsync(
        long templateId,
        CreateWorkoutTemplateRequest request,
        long userId)
    {
        if (userId <= 0)
        {
            throw new FitMateException("Unauthorized.");
        }

        var workoutTemplate = await BuildTemplateDetailsQuery(asNoTracking: false)
            .FirstOrDefaultAsync(x => x.Id == templateId && x.UserId == userId);

        if (workoutTemplate == null)
        {
            throw new FitMateException("Template not found.");
        }

        var preparedTemplate = await PrepareTemplateAsync(request);

        await using var transaction = await dbContext.Database.BeginTransactionAsync();

        try
        {
            dbContext.TemplateExerciseGroups.RemoveRange(workoutTemplate.ExerciseGroups);
            workoutTemplate.ExerciseGroups.Clear();
            await dbContext.SaveChangesAsync(userId);

            ApplyTemplateDetails(workoutTemplate, preparedTemplate);
            await dbContext.SaveChangesAsync(userId);
            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }

        return await ResolveImageUrlsAsync(
            MapTemplate(
                workoutTemplate,
                preparedTemplate.ExerciseNamesById,
                preparedTemplate.ExerciseImageUrlsById),
            new Dictionary<string, string?>());
    }

    public async Task<bool> DeleteAsync(long templateId, long userId)
    {
        if (userId <= 0)
        {
            throw new FitMateException("Unauthorized.");
        }

        if (templateId <= 0)
        {
            throw new FitMateException("Template id is invalid.");
        }

        var template = await dbContext.WorkoutTemplates
            .FirstOrDefaultAsync(x => x.Id == templateId && x.UserId == userId);

        if (template == null)
        {
            throw new FitMateException("Template not found.");
        }

        dbContext.WorkoutTemplates.Remove(template);

        try
        {
            await dbContext.SaveChangesAsync(userId);
        }
        catch (DbUpdateException)
        {
            throw new FitMateException("Unable to delete template.");
        }

        return true;
    }

    private IQueryable<WorkoutTemplate> BuildTemplateDetailsQuery(bool asNoTracking)
    {
        var query = dbContext.WorkoutTemplates.AsQueryable();

        if (asNoTracking)
        {
            query = query.AsNoTracking();
        }

        return query
            .Include(x => x.ExerciseGroups)
                .ThenInclude(x => x.Exercises)
                    .ThenInclude(x => x.Exercise)
            .Include(x => x.ExerciseGroups)
                .ThenInclude(x => x.Exercises)
                    .ThenInclude(x => x.Sets)
            .AsSplitQuery();
    }

    private async Task<PreparedWorkoutTemplate> PrepareTemplateAsync(CreateWorkoutTemplateRequest request)
    {
        var name = (request.Name ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new FitMateException("Template name is required.");
        }

        if (request.EstimatedDurationMinutes.HasValue && request.EstimatedDurationMinutes.Value <= 0)
        {
            throw new FitMateException("Estimated duration must be greater than zero.");
        }

        if (request.EstimatedDurationMinutes.HasValue && request.EstimatedDurationMinutes.Value > 600)
        {
            throw new FitMateException("Estimated duration cannot exceed 600 minutes.");
        }

        var exercises = request.Exercises ?? [];
        if (exercises.Count == 0)
        {
            throw new FitMateException("At least one template exercise is required.");
        }

        var groupTypeByClientGroupId = new Dictionary<int, ExerciseGroupType>();
        var closedClientGroupIds = new HashSet<int>();
        int? activeClientGroupId = null;
        var validationExerciseIndex = 0;
        foreach (var exerciseRequest in exercises)
        {
            if (!Enum.IsDefined(exerciseRequest.GroupType))
            {
                throw new FitMateException($"Exercise #{validationExerciseIndex + 1} has an invalid group type.");
            }

            if (exerciseRequest.ExerciseId <= 0)
            {
                throw new FitMateException($"Exercise #{validationExerciseIndex + 1} has an invalid exercise id.");
            }

            if (exerciseRequest.GroupType == ExerciseGroupType.Straight)
            {
                if (activeClientGroupId.HasValue)
                {
                    closedClientGroupIds.Add(activeClientGroupId.Value);
                    activeClientGroupId = null;
                }
            }
            else
            {
                if (!exerciseRequest.ClientGroupId.HasValue || exerciseRequest.ClientGroupId.Value == 0)
                {
                    throw new FitMateException($"Exercise #{validationExerciseIndex + 1} must include a client group id.");
                }

                var clientGroupId = exerciseRequest.ClientGroupId.Value;
                if (
                    groupTypeByClientGroupId.TryGetValue(clientGroupId, out var existingGroupType)
                    && existingGroupType != exerciseRequest.GroupType)
                {
                    throw new FitMateException($"Client group id {clientGroupId} cannot mix group types.");
                }

                groupTypeByClientGroupId.TryAdd(clientGroupId, exerciseRequest.GroupType);

                if (activeClientGroupId != clientGroupId)
                {
                    if (activeClientGroupId.HasValue)
                    {
                        closedClientGroupIds.Add(activeClientGroupId.Value);
                    }

                    if (closedClientGroupIds.Contains(clientGroupId))
                    {
                        throw new FitMateException($"Client group id {clientGroupId} must be contiguous.");
                    }

                    activeClientGroupId = clientGroupId;
                }
            }

            var sets = exerciseRequest.Sets ?? [];
            if (sets.Count == 0)
            {
                throw new FitMateException($"Exercise #{validationExerciseIndex + 1} must include at least one set.");
            }

            var setIndex = 0;
            foreach (var setRequest in sets)
            {
                var validationError = ValidateSet(setRequest);
                if (validationError != null)
                {
                    throw new FitMateException($"Exercise #{validationExerciseIndex + 1}, set #{setIndex + 1}: {validationError}");
                }

                setIndex++;
            }

            validationExerciseIndex++;
        }

        var existingExerciseIds = exercises
            .Select(x => x.ExerciseId)
            .ToList();

        if (existingExerciseIds.Distinct().Count() != existingExerciseIds.Count)
        {
            throw new FitMateException("Duplicate exercises are not supported in one template.");
        }

        var existingExercises = await dbContext.Exercises
            .AsNoTracking()
            .Where(x => existingExerciseIds.Contains(x.Id))
            .Select(x => new
            {
                x.Id,
                x.Name,
                x.ImageUrl,
            })
            .ToListAsync();

        if (existingExercises.Count != existingExerciseIds.Count)
        {
            throw new FitMateException("One or more selected exercises do not exist.");
        }

        var exerciseNamesById = existingExercises
            .ToDictionary(x => x.Id, x => x.Name);
        var exerciseImageUrlsById = existingExercises
            .Where(x => !string.IsNullOrWhiteSpace(x.ImageUrl))
            .ToDictionary(x => x.Id, x => x.ImageUrl!);

        return new PreparedWorkoutTemplate
        {
            Name = name,
            Description = NormalizeNullable(request.Description),
            EstimatedDurationMinutes = request.EstimatedDurationMinutes,
            IsPublic = request.IsPublic,
            Exercises = exercises,
            ExerciseNamesById = exerciseNamesById,
            ExerciseImageUrlsById = exerciseImageUrlsById,
        };
    }

    private static void ApplyTemplateDetails(
        WorkoutTemplate workoutTemplate,
        PreparedWorkoutTemplate preparedTemplate)
    {
        workoutTemplate.Name = preparedTemplate.Name;
        workoutTemplate.Description = preparedTemplate.Description;
        workoutTemplate.EstimatedDurationMinutes = preparedTemplate.EstimatedDurationMinutes;
        workoutTemplate.IsPublic = preparedTemplate.IsPublic;

        var groupsByClientGroupId = new Dictionary<int, TemplateExerciseGroup>();
        var nextGroupSortOrder = 0;

        TemplateExerciseGroup CreateGroup(ExerciseGroupType groupType)
        {
            var group = new TemplateExerciseGroup
            {
                SortOrder = ++nextGroupSortOrder,
                GroupType = groupType,
                Rounds = 1,
            };

            workoutTemplate.ExerciseGroups.Add(group);
            return group;
        }

        TemplateExerciseGroup ResolveGroup(CreateWorkoutTemplateExerciseRequest exerciseRequest)
        {
            if (exerciseRequest.GroupType == ExerciseGroupType.Straight)
            {
                return CreateGroup(ExerciseGroupType.Straight);
            }

            var clientGroupId = exerciseRequest.ClientGroupId!.Value;
            if (!groupsByClientGroupId.TryGetValue(clientGroupId, out var group))
            {
                group = CreateGroup(exerciseRequest.GroupType);
                groupsByClientGroupId.Add(clientGroupId, group);
            }

            return group;
        }

        for (var exerciseIndex = 0; exerciseIndex < preparedTemplate.Exercises.Count; exerciseIndex++)
        {
            var exerciseRequest = preparedTemplate.Exercises[exerciseIndex];
            var sets = exerciseRequest.Sets ?? [];
            var firstSet = sets[0];
            var group = ResolveGroup(exerciseRequest);
            var exerciseOrderIndex = exerciseIndex + 1;

            var templateExercise = new TemplateExercise
            {
                ExerciseId = exerciseRequest.ExerciseId,
                OrderIndex = exerciseOrderIndex,
                TargetSets = sets.Count,
                TargetReps = firstSet.Reps?.ToString(),
                TargetWeightKg = NormalizeWeight(firstSet.WeightKg),
                TargetRestSeconds = firstSet.RestSeconds,
                Notes = NormalizeNullable(exerciseRequest.Notes),
            };

            for (var setIndex = 0; setIndex < sets.Count; setIndex++)
            {
                var setRequest = sets[setIndex];
                templateExercise.Sets.Add(new TemplateExerciseSet
                {
                    OrderIndex = setIndex + 1,
                    SetType = setRequest.SetType,
                    WeightKg = NormalizeWeight(setRequest.WeightKg),
                    Reps = setRequest.Reps,
                    DurationSeconds = setRequest.DurationSeconds,
                    DistanceMeters = NormalizeDistance(setRequest.DistanceMeters),
                    Rpe = NormalizeRpe(setRequest.Rpe),
                    RestSeconds = setRequest.RestSeconds,
                    Notes = NormalizeNullable(setRequest.Notes),
                });
            }

            group.Exercises.Add(templateExercise);
        }
    }

    private static List<CreateWorkoutTemplateExerciseRequest> BuildTemplateExercisesFromWorkout(Workout workout)
    {
        var exercises = new List<CreateWorkoutTemplateExerciseRequest>();
        var nextClientGroupId = 0;

        foreach (var group in workout.ExerciseGroups.OrderBy(x => x.SortOrder))
        {
            var isGrouped =
                group.GroupType == ExerciseGroupType.Superset
                || group.GroupType == ExerciseGroupType.Circuit;
            int? clientGroupId = isGrouped ? ++nextClientGroupId : null;

            foreach (var exercise in group.Exercises.OrderBy(x => x.OrderIndex))
            {
                var sets = exercise.Sets
                    .OrderBy(x => x.OrderIndex)
                    .Where(HasMainMetric)
                    .Select(set => new CreateWorkoutTemplateExerciseSetRequest
                    {
                        SetType = set.SetType,
                        WeightKg = set.WeightKg,
                        Reps = set.Reps,
                        DurationSeconds = set.DurationSeconds,
                        DistanceMeters = set.DistanceMeters,
                        Rpe = set.Rpe,
                        RestSeconds = null,
                        Notes = NormalizeNullable(set.Notes),
                    })
                    .ToList();

                if (sets.Count == 0)
                {
                    continue;
                }

                exercises.Add(new CreateWorkoutTemplateExerciseRequest
                {
                    GroupType = group.GroupType,
                    ClientGroupId = clientGroupId,
                    ExerciseId = exercise.ExerciseId,
                    Notes = NormalizeNullable(exercise.Notes),
                    Sets = sets,
                });
            }
        }

        return exercises;
    }

    private static bool HasMainMetric(ExerciseSet set)
    {
        return set.WeightKg.HasValue
            || set.Reps.HasValue
            || set.DurationSeconds.HasValue
            || set.DistanceMeters.HasValue;
    }

    private static WorkoutTemplateModel MapTemplate(
        WorkoutTemplate template,
        IReadOnlyDictionary<long, string>? exerciseNamesById = null,
        IReadOnlyDictionary<long, string>? exerciseImageUrlsById = null)
    {
        var groups = template.ExerciseGroups
            .OrderBy(x => x.SortOrder)
            .Select(group => new WorkoutTemplateExerciseGroupModel
            {
                Id = group.Id,
                SortOrder = group.SortOrder,
                GroupType = group.GroupType,
                RestBetweenExercisesSeconds = group.RestBetweenExercisesSeconds,
                RestAfterGroupSeconds = group.RestAfterGroupSeconds,
                Rounds = group.Rounds,
                Exercises = group.Exercises
                    .OrderBy(x => x.OrderIndex)
                    .Select(exercise =>
                    {
                        var exerciseName = exercise.Exercise?.Name ?? string.Empty;
                        if (string.IsNullOrWhiteSpace(exerciseName)
                            && exerciseNamesById != null
                            && exerciseNamesById.TryGetValue(exercise.ExerciseId, out var mappedExerciseName))
                        {
                            exerciseName = mappedExerciseName;
                        }

                        var exerciseImageUrl = exercise.Exercise?.ImageUrl;
                        if (string.IsNullOrWhiteSpace(exerciseImageUrl)
                            && exerciseImageUrlsById != null
                            && exerciseImageUrlsById.TryGetValue(exercise.ExerciseId, out var mappedExerciseImageUrl))
                        {
                            exerciseImageUrl = mappedExerciseImageUrl;
                        }

                        return new WorkoutTemplateExerciseModel
                        {
                            Id = exercise.Id,
                            ExerciseId = exercise.ExerciseId,
                            ExerciseName = exerciseName,
                            ExerciseImageUrl = exerciseImageUrl,
                            OrderIndex = exercise.OrderIndex,
                            TargetSets = exercise.TargetSets,
                            TargetReps = exercise.TargetReps,
                            TargetWeightKg = exercise.TargetWeightKg,
                            TargetRestSeconds = exercise.TargetRestSeconds,
                            Tempo = exercise.Tempo,
                            Notes = exercise.Notes,
                            Sets = exercise.Sets
                                .OrderBy(x => x.OrderIndex)
                                .Select(set => new WorkoutTemplateExerciseSetModel
                                {
                                    Id = set.Id,
                                    OrderIndex = set.OrderIndex,
                                    SetType = set.SetType,
                                    WeightKg = set.WeightKg,
                                    Reps = set.Reps,
                                    DurationSeconds = set.DurationSeconds,
                                    DistanceMeters = set.DistanceMeters,
                                    Rpe = set.Rpe,
                                    RestSeconds = set.RestSeconds,
                                    Notes = set.Notes,
                                })
                                .ToList(),
                        };
                    })
                    .ToList(),
            })
            .ToList();

        return new WorkoutTemplateModel
        {
            Id = template.Id,
            UserId = template.UserId,
            Name = template.Name,
            Description = template.Description,
            EstimatedDurationMinutes = template.EstimatedDurationMinutes,
            IsPublic = template.IsPublic,
            ExerciseCount = groups.Sum(x => x.Exercises.Count),
            SetCount = groups.Sum(x => x.Exercises.Sum(e => e.Sets.Count)),
            DateCreated = template.DateCreated,
            Groups = groups,
        };
    }

    private async Task<WorkoutTemplateModel> ResolveImageUrlsAsync(
        WorkoutTemplateModel model,
        Dictionary<string, string?> resolvedCache)
    {
        foreach (var group in model.Groups)
        {
            foreach (var exercise in group.Exercises)
            {
                exercise.ExerciseImageUrl = await ResolveImageUrlAsync(exercise.ExerciseImageUrl, resolvedCache);
            }
        }

        return model;
    }

    private async Task<string?> ResolveImageUrlAsync(
        string? value,
        Dictionary<string, string?> resolvedCache)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return value;
        }

        if (resolvedCache.TryGetValue(value, out var cached))
        {
            return cached;
        }

        var resolved = await photoUrlResolver.ResolveAsync(value);
        resolvedCache[value] = resolved;
        return resolved;
    }

    private static string? ValidateSet(CreateWorkoutTemplateExerciseSetRequest request)
    {
        if (request.WeightKg.HasValue && request.WeightKg.Value < 0)
        {
            return "Weight cannot be negative.";
        }

        if (request.Reps.HasValue && request.Reps.Value <= 0)
        {
            return "Reps must be greater than zero.";
        }

        if (request.DurationSeconds.HasValue && request.DurationSeconds.Value <= 0)
        {
            return "Duration seconds must be greater than zero.";
        }

        if (request.DistanceMeters.HasValue && request.DistanceMeters.Value <= 0)
        {
            return "Distance meters must be greater than zero.";
        }

        if (request.Rpe.HasValue && (request.Rpe.Value < 0 || request.Rpe.Value > 10))
        {
            return "RPE must be between 0 and 10.";
        }

        if (request.RestSeconds.HasValue && request.RestSeconds.Value < 0)
        {
            return "Rest seconds cannot be negative.";
        }

        var hasMainMetric =
            request.WeightKg.HasValue
            || request.Reps.HasValue
            || request.DurationSeconds.HasValue
            || request.DistanceMeters.HasValue;

        if (!hasMainMetric)
        {
            return "Set must include at least one metric (weight/reps/duration/distance).";
        }

        return null;
    }

    private static decimal? NormalizeWeight(decimal? value)
    {
        return value.HasValue
            ? Math.Round(value.Value, 2, MidpointRounding.AwayFromZero)
            : null;
    }

    private static decimal? NormalizeDistance(decimal? value)
    {
        return value.HasValue
            ? Math.Round(value.Value, 2, MidpointRounding.AwayFromZero)
            : null;
    }

    private static decimal? NormalizeRpe(decimal? value)
    {
        return value.HasValue
            ? Math.Round(value.Value, 1, MidpointRounding.AwayFromZero)
            : null;
    }

    private static string? NormalizeNullable(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private sealed class PreparedWorkoutTemplate
    {
        public string Name { get; init; } = string.Empty;
        public string? Description { get; init; }
        public int? EstimatedDurationMinutes { get; init; }
        public bool IsPublic { get; init; }
        public IReadOnlyList<CreateWorkoutTemplateExerciseRequest> Exercises { get; init; } = [];
        public IReadOnlyDictionary<long, string> ExerciseNamesById { get; init; } = new Dictionary<long, string>();
        public IReadOnlyDictionary<long, string> ExerciseImageUrlsById { get; init; } = new Dictionary<long, string>();
    }

}
