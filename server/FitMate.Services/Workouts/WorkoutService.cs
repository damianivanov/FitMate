using FitMate.Core.JsonModels.Workouts;
using FitMate.Core.Exceptions;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.Storage.Urls;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.Workouts;

public class WorkoutService : IWorkoutService
{
    private readonly AppDbContext dbContext;
    private readonly IPhotoUrlResolver photoUrlResolver;

    public WorkoutService(AppDbContext dbContext, IPhotoUrlResolver photoUrlResolver)
    {
        this.dbContext = dbContext;
        this.photoUrlResolver = photoUrlResolver;
    }

    public async Task<IReadOnlyList<WorkoutModel>> ListAsync(long userId)
    {
        if (userId <= 0)
        {
            throw new FitMateException("Unauthorized.");
        }

        var workouts = await BuildWorkoutDetailsQuery(asNoTracking: true)
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.StartedAt)
            .ThenByDescending(x => x.Id)
            .ToListAsync();

        return workouts.Select(MapWorkout).ToList();
    }

    public async Task<IReadOnlyList<WorkoutCalendarDayModel>> GetCalendarMonthAsync(long userId, int year, int month)
    {
        if (userId <= 0)
        {
            throw new FitMateException("Unauthorized.");
        }

        if (month < 1 || month > 12 || year < 1)
        {
            throw new FitMateException("Invalid month.");
        }

        var from = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
        var to = from.AddMonths(1);

        return await dbContext.Workouts
            .AsNoTracking()
            .Where(x => x.UserId == userId
                && x.FinishedAt != null
                && x.FinishedAt >= from
                && x.FinishedAt < to)
            .OrderBy(x => x.FinishedAt)
            .Select(x => new WorkoutCalendarDayModel
            {
                WorkoutId = x.Id,
                Title = x.Title,
                Date = x.FinishedAt!.Value,
                DurationSeconds = x.DurationSeconds,
                TotalVolumeKg = x.TotalVolumeKg,
                ExerciseCount = x.ExerciseGroups.SelectMany(g => g.Exercises).Count(),
                SetCount = x.ExerciseGroups.SelectMany(g => g.Exercises).SelectMany(e => e.Sets).Count(),
            })
            .ToListAsync();
    }

    public async Task<WorkoutModel?> GetByIdAsync(long workoutId, long userId)
    {
        if (userId <= 0)
        {
            throw new FitMateException("Unauthorized.");
        }

        if (workoutId <= 0)
        {
            throw new FitMateException("Workout id is invalid.");
        }

        var workout = await BuildWorkoutDetailsQuery(asNoTracking: true)
            .FirstOrDefaultAsync(x => x.Id == workoutId && x.UserId == userId);

        return workout == null ? null : await ResolveImageUrlsAsync(MapWorkout(workout));
    }

    public async Task<long> StartFromTemplateAsync(long templateId, long userId)
    {
        if (userId <= 0)
        {
            throw new FitMateException("Unauthorized.");
        }

        var template = await LoadWorkoutTemplateForStartAsync(templateId, userId);
        var workout = BuildWorkoutFromTemplate(template, userId, DateTime.UtcNow);

        dbContext.Workouts.Add(workout);
        await dbContext.SaveChangesAsync(userId);

        return workout.Id;
    }

    public async Task<long> DuplicateAsync(long workoutId, long userId)
    {
        if (userId <= 0)
        {
            throw new FitMateException("Unauthorized.");
        }

        if (workoutId <= 0)
        {
            throw new FitMateException("Workout id is invalid.");
        }

        var source = await dbContext.Workouts
            .AsNoTracking()
            .Include(x => x.ExerciseGroups)
                .ThenInclude(x => x.Exercises)
                    .ThenInclude(x => x.Sets)
            .AsSplitQuery()
            .FirstOrDefaultAsync(x => x.Id == workoutId && x.UserId == userId);

        if (source == null)
        {
            throw new FitMateException("Workout not found.");
        }

        var workout = BuildWorkoutCopy(source, userId, DateTime.UtcNow);

        dbContext.Workouts.Add(workout);
        await dbContext.SaveChangesAsync(userId);

        return workout.Id;
    }

    public async Task<WorkoutCreatedModel> CreateAsync(
        SaveWorkoutRequest request,
        long userId)
    {
        return await SaveWorkoutAsync(request, userId, isDraft: false);
    }

    public async Task<WorkoutCreatedModel> UpsertDraftAsync(
        SaveWorkoutRequest request,
        long userId)
    {
        return await SaveWorkoutAsync(request, userId, isDraft: true);
    }

    public async Task<bool> DeleteAsync(long workoutId, long userId)
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
            .FirstOrDefaultAsync(x => x.Id == workoutId && x.UserId == userId);

        if (workout == null)
        {
            throw new FitMateException("Workout not found.");
        }

        dbContext.Workouts.Remove(workout);

        try
        {
            await dbContext.SaveChangesAsync(userId);
        }
        catch (DbUpdateException)
        {
            throw new FitMateException("Unable to delete workout.");
        }

        return true;
    }

    private async Task<WorkoutCreatedModel> SaveWorkoutAsync(
        SaveWorkoutRequest request,
        long userId,
        bool isDraft)
    {
        if (userId <= 0)
        {
            throw new FitMateException("Unauthorized.");
        }

        var title = (request.Title ?? string.Empty).Trim();
        if (!isDraft && string.IsNullOrWhiteSpace(title))
        {
            throw new FitMateException("Workout title is required.");
        }

        var exercises = request.Exercises ?? [];
        if (!isDraft && exercises.Count == 0)
        {
            throw new FitMateException("At least one exercise is required.");
        }

        if (exercises.Any(x => x.ExerciseId <= 0))
        {
            throw new FitMateException("Each workout exercise must reference a valid exercise.");
        }

        var distinctExerciseIds = exercises
            .Select(x => x.ExerciseId)
            .Distinct()
            .ToList();

        if (distinctExerciseIds.Count != exercises.Count)
        {
            throw new FitMateException("Duplicate exercises are not supported in one workout.");
        }

        var workoutTemplate = await LoadWorkoutTemplateAsync(request.WorkoutTemplateId, userId);

        var existingExerciseIds = await dbContext.Exercises
            .AsNoTracking()
            .Where(x => distinctExerciseIds.Contains(x.Id))
            .Select(x => x.Id)
            .ToListAsync();

        if (existingExerciseIds.Count != distinctExerciseIds.Count)
        {
            throw new FitMateException("One or more selected exercises do not exist.");
        }

        var startedAt = request.StartedAt.HasValue
            ? NormalizeUtc(request.StartedAt.Value)
            : DateTime.UtcNow;
        DateTime? finishedAt = isDraft
            ? null
            : request.FinishedAt.HasValue
                ? NormalizeUtc(request.FinishedAt.Value)
                : DateTime.UtcNow;

        if (finishedAt.HasValue && finishedAt.Value < startedAt)
        {
            throw new FitMateException("Workout finish time cannot be before start time.");
        }

        var workout = await LoadWorkoutForUpdateAsync(request.WorkoutId, userId);
        var isNewWorkout = workout == null;
        if (workout != null && workout.FinishedAt.HasValue)
        {
            throw new FitMateException("Workout has already been finished.");
        }

        workout ??= new Workout { UserId = userId };

        workout.Title = title;
        workout.StartedAt = startedAt;
        workout.FinishedAt = finishedAt;
        workout.DurationSeconds = BuildDurationSeconds(startedAt, finishedAt);
        workout.Notes = NormalizeNullable(request.Notes);
        workout.WorkoutTemplateId = workoutTemplate?.Id;

        var accumulator = new WorkoutCreateAccumulator();

        await using var transaction = await dbContext.Database.BeginTransactionAsync();

        if (!isNewWorkout)
        {
            dbContext.WorkoutExerciseGroups.RemoveRange(workout.ExerciseGroups);
            await dbContext.SaveChangesAsync(userId);
            workout.ExerciseGroups.Clear();
        }

        AddWorkoutExerciseGroups(
            workout,
            exercises,
            accumulator,
            requireSets: !isDraft,
            requireCompletedSets: !isDraft);

        workout.TotalVolumeKg = accumulator.HasTotalVolume
            ? Math.Round(accumulator.TotalVolumeKg, 2, MidpointRounding.AwayFromZero)
            : null;

        if (isNewWorkout)
        {
            dbContext.Workouts.Add(workout);
        }

        await dbContext.SaveChangesAsync(userId);
        await transaction.CommitAsync();

        return new WorkoutCreatedModel
        {
            WorkoutId = workout.Id,
            Title = workout.Title,
            StartedAt = EnsureUtcKind(workout.StartedAt),
            FinishedAt = EnsureUtcKind(workout.FinishedAt),
            ExerciseCount = exercises.Count,
            SetCount = accumulator.TotalSetCount,
            TotalVolumeKg = workout.TotalVolumeKg,
        };
    }

    public async Task<PreviousExerciseSetsResponse> GetPreviousSetsAsync(
        long userId,
        IReadOnlyCollection<long> exerciseIds)
    {
        var response = new PreviousExerciseSetsResponse();
        if (userId <= 0 || exerciseIds.Count == 0)
        {
            return response;
        }

        var normalizedExerciseIds = exerciseIds
            .Where(x => x > 0)
            .Distinct()
            .ToList();

        if (normalizedExerciseIds.Count == 0)
        {
            return response;
        }

        var candidates = await dbContext.WorkoutExercises
            .AsNoTracking()
            .Where(x =>
                normalizedExerciseIds.Contains(x.ExerciseId)
                && x.WorkoutExerciseGroup.Workout.UserId == userId
                && x.WorkoutExerciseGroup.Workout.FinishedAt.HasValue)
            .Select(x => new PreviousWorkoutExerciseCandidate
            {
                WorkoutExerciseId = x.Id,
                ExerciseId = x.ExerciseId,
                ExerciseName = x.Exercise.Name,
                WorkoutId = x.WorkoutExerciseGroup.WorkoutId,
                WorkoutTitle = x.WorkoutExerciseGroup.Workout.Title,
                WorkoutStartedAt = x.WorkoutExerciseGroup.Workout.StartedAt,
            })
            .OrderByDescending(x => x.WorkoutStartedAt)
            .ThenByDescending(x => x.WorkoutId)
            .ThenByDescending(x => x.WorkoutExerciseId)
            .ToListAsync();

        if (candidates.Count == 0)
        {
            return response;
        }

        var latestByExercise = candidates
            .GroupBy(x => x.ExerciseId)
            .ToDictionary(group => group.Key, group => group.First());

        var workoutExerciseIds = latestByExercise.Values
            .Select(x => x.WorkoutExerciseId)
            .Distinct()
            .ToList();

        var previousSets = await dbContext.ExerciseSets
            .AsNoTracking()
            .Where(x => workoutExerciseIds.Contains(x.WorkoutExerciseId) && x.IsCompleted)
            .OrderBy(x => x.OrderIndex)
            .Select(x => new PreviousSetProjection
            {
                WorkoutExerciseId = x.WorkoutExerciseId,
                SetNumber = x.OrderIndex,
                SetType = x.SetType,
                WeightKg = x.WeightKg,
                Reps = x.Reps,
                DurationSeconds = x.DurationSeconds,
                DistanceMeters = x.DistanceMeters,
                Rpe = x.Rpe,
                Notes = x.Notes,
            })
            .ToListAsync();

        var setsByWorkoutExerciseId = previousSets
            .GroupBy(x => x.WorkoutExerciseId)
            .ToDictionary(
                group => group.Key,
                group => group
                    .OrderBy(x => x.SetNumber)
                    .Select(x => new PreviousExerciseSetModel
                    {
                        SetNumber = x.SetNumber,
                        SetType = x.SetType,
                        WeightKg = x.WeightKg,
                        Reps = x.Reps,
                        DurationSeconds = x.DurationSeconds,
                        DistanceMeters = x.DistanceMeters,
                        Rpe = x.Rpe,
                        Notes = x.Notes,
                    })
                    .ToList());

        response.Items = normalizedExerciseIds
            .Where(latestByExercise.ContainsKey)
            .Select(exerciseId =>
            {
                var latest = latestByExercise[exerciseId];
                setsByWorkoutExerciseId.TryGetValue(latest.WorkoutExerciseId, out var sets);

                return new PreviousExerciseSetsModel
                {
                    ExerciseId = latest.ExerciseId,
                    ExerciseName = latest.ExerciseName,
                    WorkoutId = latest.WorkoutId,
                    WorkoutTitle = latest.WorkoutTitle,
                    WorkoutStartedAt = EnsureUtcKind(latest.WorkoutStartedAt),
                    Sets = sets ?? [],
                };
            })
            .ToList();

        return response;
    }

    private IQueryable<Workout> BuildWorkoutDetailsQuery(bool asNoTracking)
    {
        var query = dbContext.Workouts.AsQueryable();
        if (asNoTracking)
        {
            query = query.AsNoTracking();
        }

        return query
            .Include(x => x.WorkoutTemplate)
            .Include(x => x.ExerciseGroups)
                .ThenInclude(x => x.Exercises)
                    .ThenInclude(x => x.Exercise)
            .Include(x => x.ExerciseGroups)
                .ThenInclude(x => x.Exercises)
                    .ThenInclude(x => x.Sets)
            .AsSplitQuery();
    }

    private async Task<WorkoutTemplate?> LoadWorkoutTemplateAsync(long? workoutTemplateId, long userId)
    {
        if (!workoutTemplateId.HasValue)
        {
            return null;
        }

        if (workoutTemplateId.Value <= 0)
        {
            throw new FitMateException("Workout template id is invalid.");
        }

        var template = await dbContext.WorkoutTemplates
            .AsNoTracking()
            .Include(x => x.ExerciseGroups)
                .ThenInclude(x => x.Exercises)
            .AsSplitQuery()
            .FirstOrDefaultAsync(x =>
                x.Id == workoutTemplateId.Value
                && (x.UserId == userId || x.IsPublic));

        if (template == null)
        {
            throw new FitMateException("Template not found.");
        }

        return template;
    }

    private async Task<WorkoutTemplate> LoadWorkoutTemplateForStartAsync(long templateId, long userId)
    {
        if (templateId <= 0)
        {
            throw new FitMateException("Workout template id is invalid.");
        }

        var template = await dbContext.WorkoutTemplates
            .AsNoTracking()
            .Include(x => x.ExerciseGroups)
                .ThenInclude(x => x.Exercises)
                    .ThenInclude(x => x.Sets)
            .AsSplitQuery()
            .FirstOrDefaultAsync(x => x.Id == templateId && (x.UserId == userId || x.IsPublic));

        if (template == null)
        {
            throw new FitMateException("Template not found.");
        }

        return template;
    }

    private async Task<Workout?> LoadWorkoutForUpdateAsync(long? workoutId, long userId)
    {
        if (!workoutId.HasValue)
        {
            return null;
        }

        if (workoutId.Value <= 0)
        {
            throw new FitMateException("Workout id is invalid.");
        }

        var workout = await dbContext.Workouts
            .Include(x => x.ExerciseGroups)
                .ThenInclude(x => x.Exercises)
                    .ThenInclude(x => x.Sets)
            .AsSplitQuery()
            .FirstOrDefaultAsync(x => x.Id == workoutId.Value && x.UserId == userId);

        if (workout == null)
        {
            throw new FitMateException("Workout not found.");
        }

        return workout;
    }

    private static Workout BuildWorkoutFromTemplate(
        WorkoutTemplate template,
        long userId,
        DateTime startedAt)
    {
        var workout = new Workout
        {
            UserId = userId,
            WorkoutTemplateId = template.Id,
            Title = template.Name,
            StartedAt = startedAt,
        };

        foreach (var templateGroup in template.ExerciseGroups.OrderBy(x => x.SortOrder))
        {
            var workoutGroup = new WorkoutExerciseGroup
            {
                SortOrder = templateGroup.SortOrder,
                GroupType = templateGroup.GroupType,
            };

            foreach (var templateExercise in templateGroup.Exercises.OrderBy(x => x.OrderIndex))
            {
                var workoutExercise = new WorkoutExercise
                {
                    ExerciseId = templateExercise.ExerciseId,
                    OrderIndex = templateExercise.OrderIndex,
                    Notes = NormalizeNullable(templateExercise.Notes),
                };

                foreach (var templateSet in templateExercise.Sets.OrderBy(x => x.OrderIndex))
                {
                    workoutExercise.Sets.Add(new ExerciseSet
                    {
                        OrderIndex = templateSet.OrderIndex,
                        SetType = templateSet.SetType,
                        WeightKg = NormalizeWeight(templateSet.WeightKg),
                        Reps = templateSet.Reps,
                        DurationSeconds = templateSet.DurationSeconds,
                        DistanceMeters = NormalizeDistance(templateSet.DistanceMeters),
                        Rpe = NormalizeRpe(templateSet.Rpe),
                        IsCompleted = false,
                        IsPersonalRecord = false,
                        Notes = NormalizeNullable(templateSet.Notes),
                    });
                }

                workoutGroup.Exercises.Add(workoutExercise);
            }

            if (workoutGroup.Exercises.Count > 0)
            {
                workout.ExerciseGroups.Add(workoutGroup);
            }
        }

        return workout;
    }

    private static Workout BuildWorkoutCopy(
        Workout source,
        long userId,
        DateTime startedAt)
    {
        var workout = new Workout
        {
            UserId = userId,
            Title = source.Title,
            StartedAt = startedAt,
            Notes = source.Notes,
        };

        foreach (var sourceGroup in source.ExerciseGroups.OrderBy(x => x.SortOrder))
        {
            var workoutGroup = new WorkoutExerciseGroup
            {
                SortOrder = sourceGroup.SortOrder,
                GroupType = sourceGroup.GroupType,
            };

            foreach (var sourceExercise in sourceGroup.Exercises.OrderBy(x => x.OrderIndex))
            {
                var workoutExercise = new WorkoutExercise
                {
                    ExerciseId = sourceExercise.ExerciseId,
                    OrderIndex = sourceExercise.OrderIndex,
                    Notes = sourceExercise.Notes,
                };

                foreach (var sourceSet in sourceExercise.Sets.OrderBy(x => x.OrderIndex))
                {
                    workoutExercise.Sets.Add(new ExerciseSet
                    {
                        OrderIndex = sourceSet.OrderIndex,
                        SetType = sourceSet.SetType,
                        WeightKg = sourceSet.WeightKg,
                        Reps = sourceSet.Reps,
                        DurationSeconds = sourceSet.DurationSeconds,
                        DistanceMeters = sourceSet.DistanceMeters,
                        Rpe = sourceSet.Rpe,
                        IsCompleted = false,
                        IsPersonalRecord = false,
                        Notes = sourceSet.Notes,
                    });
                }

                workoutGroup.Exercises.Add(workoutExercise);
            }

            if (workoutGroup.Exercises.Count > 0)
            {
                workout.ExerciseGroups.Add(workoutGroup);
            }
        }

        return workout;
    }

    private static void AddWorkoutExerciseGroups(
        Workout workout,
        IReadOnlyList<CreateWorkoutExerciseRequest> exercises,
        WorkoutCreateAccumulator accumulator,
        bool requireSets,
        bool requireCompletedSets)
    {
        var groupSortOrder = 0;
        var exerciseDisplayIndex = 0;

        foreach (var exerciseGroup in BuildWorkoutExerciseRequestGroups(exercises))
        {
            var workoutGroup = new WorkoutExerciseGroup
            {
                SortOrder = ++groupSortOrder,
                GroupType = exerciseGroup.GroupType,
            };

            var exerciseOrderIndex = 0;
            foreach (var exerciseRequest in exerciseGroup.Exercises)
            {
                exerciseDisplayIndex++;
                workoutGroup.Exercises.Add(
                    BuildWorkoutExercise(
                        exerciseRequest,
                        ++exerciseOrderIndex,
                        exerciseDisplayIndex,
                        accumulator,
                        requireSets,
                        requireCompletedSets));
            }

            if (workoutGroup.Exercises.Count > 0)
            {
                workout.ExerciseGroups.Add(workoutGroup);
            }
        }
    }

    private static IReadOnlyList<WorkoutExerciseRequestGroup> BuildWorkoutExerciseRequestGroups(
        IReadOnlyList<CreateWorkoutExerciseRequest> exercises)
    {
        var sortedExercises = exercises
            .Select((exercise, index) => new
            {
                Exercise = exercise,
                OriginalIndex = index,
                SafeOrderIndex = exercise.OrderIndex > 0 ? exercise.OrderIndex : index + 1,
            })
            .OrderBy(x => x.SafeOrderIndex)
            .ThenBy(x => x.OriginalIndex)
            .ToList();

        var groups = new List<WorkoutExerciseRequestGroup>();
        var groupedByClientGroupId = new Dictionary<string, WorkoutExerciseRequestGroup>();

        foreach (var item in sortedExercises)
        {
            var exercise = item.Exercise;
            var isGrouped = IsGroupedExerciseType(exercise.GroupType) && exercise.ClientGroupId.HasValue;
            if (!isGrouped)
            {
                groups.Add(new WorkoutExerciseRequestGroup
                {
                    GroupType = ExerciseGroupType.Straight,
                    Exercises = [exercise],
                });
                continue;
            }

            var groupKey = $"{(int)exercise.GroupType}:{exercise.ClientGroupId!.Value}";
            if (!groupedByClientGroupId.TryGetValue(groupKey, out var group))
            {
                group = new WorkoutExerciseRequestGroup
                {
                    GroupType = exercise.GroupType,
                    Exercises = [],
                };
                groupedByClientGroupId[groupKey] = group;
                groups.Add(group);
            }

            group.Exercises.Add(exercise);
        }

        return groups;
    }

    private static bool IsGroupedExerciseType(ExerciseGroupType groupType)
    {
        return groupType == ExerciseGroupType.Superset || groupType == ExerciseGroupType.Circuit;
    }

    private static WorkoutExercise BuildWorkoutExercise(
        CreateWorkoutExerciseRequest exerciseRequest,
        int orderIndex,
        int exerciseDisplayIndex,
        WorkoutCreateAccumulator accumulator,
        bool requireSets,
        bool requireCompletedSets)
    {
        var sets = exerciseRequest.Sets ?? [];
        if (requireSets && sets.Count == 0)
        {
            throw new FitMateException($"Exercise #{exerciseDisplayIndex} must include at least one set.");
        }

        if (requireCompletedSets && !sets.Any(x => x.IsCompleted))
        {
            throw new FitMateException($"Exercise #{exerciseDisplayIndex} must include at least one completed set.");
        }

        var workoutExercise = new WorkoutExercise
        {
            ExerciseId = exerciseRequest.ExerciseId,
            OrderIndex = orderIndex,
            Notes = NormalizeNullable(exerciseRequest.Notes),
        };

        for (var setIndex = 0; setIndex < sets.Count; setIndex++)
        {
            var setRequest = sets[setIndex];
            var validationError = ValidateSet(setRequest);
            if (validationError != null)
            {
                throw new FitMateException($"Exercise #{exerciseDisplayIndex}, set #{setIndex + 1}: {validationError}");
            }

            var exerciseSet = new ExerciseSet
            {
                OrderIndex = setIndex + 1,
                SetType = setRequest.SetType,
                WeightKg = NormalizeWeight(setRequest.WeightKg),
                Reps = setRequest.Reps,
                DurationSeconds = setRequest.DurationSeconds,
                DistanceMeters = NormalizeDistance(setRequest.DistanceMeters),
                Rpe = NormalizeRpe(setRequest.Rpe),
                IsCompleted = setRequest.IsCompleted,
                IsPersonalRecord = false,
                Notes = NormalizeNullable(setRequest.Notes),
            };

            accumulator.AddSet(exerciseSet);
            workoutExercise.Sets.Add(exerciseSet);
        }

        return workoutExercise;
    }

    private static string? ValidateSet(CreateWorkoutSetRequest request)
    {
        if (!Enum.IsDefined(request.SetType))
        {
            return "Set type is invalid.";
        }

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

        if (!request.IsCompleted)
        {
            return null;
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

    private static int? BuildDurationSeconds(DateTime startedAt, DateTime? finishedAt)
    {
        if (!finishedAt.HasValue)
        {
            return null;
        }

        var duration = finishedAt.Value - startedAt;
        if (duration <= TimeSpan.Zero)
        {
            return 0;
        }

        var totalSeconds = (long)Math.Round(duration.TotalSeconds, MidpointRounding.AwayFromZero);
        if (totalSeconds > int.MaxValue)
        {
            return int.MaxValue;
        }

        return (int)totalSeconds;
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

    private static DateTime NormalizeUtc(DateTime value)
    {
        return value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc),
        };
    }

    private static DateTime EnsureUtcKind(DateTime value)
    {
        return value.Kind == DateTimeKind.Utc
            ? value
            : DateTime.SpecifyKind(value, DateTimeKind.Utc);
    }

    private static DateTime? EnsureUtcKind(DateTime? value)
    {
        return value.HasValue ? EnsureUtcKind(value.Value) : null;
    }

    private static WorkoutModel MapWorkout(Workout workout)
    {
        var groups = workout.ExerciseGroups
            .OrderBy(group => group.SortOrder)
            .Select(group => new WorkoutExerciseGroupModel
            {
                Id = group.Id,
                SortOrder = group.SortOrder,
                GroupType = group.GroupType,
                Exercises = group.Exercises
                    .OrderBy(exercise => exercise.OrderIndex)
                    .Select(exercise => new WorkoutExerciseModel
                    {
                        Id = exercise.Id,
                        ExerciseId = exercise.ExerciseId,
                        ExerciseName = exercise.Exercise.Name,
                        ExerciseImageUrl = exercise.Exercise.ImageUrl,
                        OrderIndex = exercise.OrderIndex,
                        Notes = exercise.Notes,
                        Sets = exercise.Sets
                            .OrderBy(set => set.OrderIndex)
                            .Select(set => new WorkoutSetModel
                            {
                                Id = set.Id,
                                OrderIndex = set.OrderIndex,
                                SetType = set.SetType,
                                WeightKg = set.WeightKg,
                                Reps = set.Reps,
                                DurationSeconds = set.DurationSeconds,
                                DistanceMeters = set.DistanceMeters,
                                Rpe = set.Rpe,
                                IsCompleted = set.IsCompleted,
                                Notes = set.Notes,
                            })
                            .ToList(),
                    })
                    .ToList(),
            })
            .ToList();

        return new WorkoutModel
        {
            Id = workout.Id,
            WorkoutTemplateId = workout.WorkoutTemplateId,
            TemplateName = workout.WorkoutTemplate?.Name,
            Title = workout.Title,
            StartedAt = EnsureUtcKind(workout.StartedAt),
            FinishedAt = EnsureUtcKind(workout.FinishedAt),
            DurationSeconds = workout.DurationSeconds,
            TotalVolumeKg = workout.TotalVolumeKg,
            Notes = workout.Notes,
            ExerciseCount = groups.Sum(group => group.Exercises.Count),
            SetCount = groups.Sum(group => group.Exercises.Sum(exercise => exercise.Sets.Count)),
            Groups = groups,
        };
    }

    private async Task<WorkoutModel> ResolveImageUrlsAsync(WorkoutModel model)
    {
        var resolvedCache = new Dictionary<string, string?>();
        foreach (var group in model.Groups)
        {
            foreach (var exercise in group.Exercises)
            {
                if (string.IsNullOrWhiteSpace(exercise.ExerciseImageUrl))
                {
                    continue;
                }

                if (!resolvedCache.TryGetValue(exercise.ExerciseImageUrl, out var resolved))
                {
                    resolved = await photoUrlResolver.ResolveAsync(exercise.ExerciseImageUrl);
                    resolvedCache[exercise.ExerciseImageUrl] = resolved;
                }

                exercise.ExerciseImageUrl = resolved;
            }
        }

        return model;
    }

    private class PreviousWorkoutExerciseCandidate
    {
        public long WorkoutExerciseId { get; set; }
        public long ExerciseId { get; set; }
        public string ExerciseName { get; set; } = string.Empty;
        public long WorkoutId { get; set; }
        public string WorkoutTitle { get; set; } = string.Empty;
        public DateTime WorkoutStartedAt { get; set; }
    }

    private class PreviousSetProjection
    {
        public long WorkoutExerciseId { get; set; }
        public int SetNumber { get; set; }
        public ExerciseSetType SetType { get; set; }
        public decimal? WeightKg { get; set; }
        public int? Reps { get; set; }
        public int? DurationSeconds { get; set; }
        public decimal? DistanceMeters { get; set; }
        public decimal? Rpe { get; set; }
        public string? Notes { get; set; }
    }

    private sealed class WorkoutExerciseRequestGroup
    {
        public ExerciseGroupType GroupType { get; set; }
        public List<CreateWorkoutExerciseRequest> Exercises { get; set; } = [];
    }

    private sealed class WorkoutCreateAccumulator
    {
        public int TotalSetCount { get; private set; }
        public decimal TotalVolumeKg { get; private set; }
        public bool HasTotalVolume { get; private set; }

        public void AddSet(ExerciseSet exerciseSet)
        {
            if (!exerciseSet.IsCompleted)
            {
                return;
            }

            TotalSetCount++;

            if (!exerciseSet.WeightKg.HasValue || !exerciseSet.Reps.HasValue)
            {
                return;
            }

            TotalVolumeKg += exerciseSet.WeightKg.Value * exerciseSet.Reps.Value;
            HasTotalVolume = true;
        }
    }
}
