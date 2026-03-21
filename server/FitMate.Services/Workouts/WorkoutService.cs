using FitMate.Core.JsonModels.Workouts;
using FitMate.Core.Exceptions;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.Workouts;

public class WorkoutService : IWorkoutService
{
    private readonly AppDbContext dbContext;

    public WorkoutService(AppDbContext dbContext)
    {
        this.dbContext = dbContext;
    }

    public async Task<WorkoutCreatedModel> CreateAsync(
        CreateWorkoutRequest request,
        long userId)
    {
        if (userId <= 0)
        {
            throw new FitMateException("Unauthorized.");
        }

        var title = (request.Title ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(title))
        {
            throw new FitMateException("Workout title is required.");
        }

        var exercises = request.Exercises ?? [];
        if (exercises.Count == 0)
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

        var existingExerciseIds = await dbContext.Exercises
            .AsNoTracking()
            .Where(x => distinctExerciseIds.Contains(x.Id))
            .Select(x => x.Id)
            .ToListAsync();

        if (existingExerciseIds.Count != distinctExerciseIds.Count)
        {
            throw new FitMateException("One or more selected exercises do not exist.");
        }

        var startedAt = request.StartedAt?.ToUniversalTime() ?? DateTime.UtcNow;
        var finishedAt = request.FinishedAt?.ToUniversalTime();

        if (finishedAt.HasValue && finishedAt.Value < startedAt)
        {
            throw new FitMateException("Workout finish time cannot be before start time.");
        }

        var workout = new Workout
        {
            UserId = userId,
            Title = title,
            StartedAt = startedAt,
            FinishedAt = finishedAt,
            DurationSeconds = BuildDurationSeconds(startedAt, finishedAt),
            Notes = NormalizeNullable(request.Notes),
        };

        var straightGroup = new WorkoutExerciseGroup
        {
            SortOrder = 1,
            GroupType = ExerciseGroupType.Straight,
        };

        workout.ExerciseGroups.Add(straightGroup);

        var totalSetCount = 0;
        var totalVolumeKg = 0m;
        var hasTotalVolume = false;

        for (var exerciseIndex = 0; exerciseIndex < exercises.Count; exerciseIndex++)
        {
            var exerciseRequest = exercises[exerciseIndex];
            var sets = exerciseRequest.Sets ?? [];

            if (sets.Count == 0)
            {
                throw new FitMateException($"Exercise #{exerciseIndex + 1} must include at least one set.");
            }

            var workoutExercise = new WorkoutExercise
            {
                ExerciseId = exerciseRequest.ExerciseId,
                OrderIndex = exerciseIndex + 1,
                Notes = NormalizeNullable(exerciseRequest.Notes),
            };

            for (var setIndex = 0; setIndex < sets.Count; setIndex++)
            {
                var setRequest = sets[setIndex];
                var validationError = ValidateSet(setRequest);
                if (validationError != null)
                {
                    throw new FitMateException($"Exercise #{exerciseIndex + 1}, set #{setIndex + 1}: {validationError}");
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
                    IsPersonalRecord = false,
                    Notes = NormalizeNullable(setRequest.Notes),
                };

                if (exerciseSet.WeightKg.HasValue && exerciseSet.Reps.HasValue)
                {
                    totalVolumeKg += exerciseSet.WeightKg.Value * exerciseSet.Reps.Value;
                    hasTotalVolume = true;
                }

                workoutExercise.Sets.Add(exerciseSet);
                totalSetCount++;
            }

            straightGroup.Exercises.Add(workoutExercise);
        }

        workout.TotalVolumeKg = hasTotalVolume
            ? Math.Round(totalVolumeKg, 2, MidpointRounding.AwayFromZero)
            : null;

        dbContext.Workouts.Add(workout);
        await dbContext.SaveChangesAsync(userId);

        return new WorkoutCreatedModel
        {
            WorkoutId = workout.Id,
            Title = workout.Title,
            StartedAt = workout.StartedAt,
            FinishedAt = workout.FinishedAt,
            ExerciseCount = exercises.Count,
            SetCount = totalSetCount,
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
                && x.WorkoutExerciseGroup.Workout.UserId == userId)
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
            .Where(x => workoutExerciseIds.Contains(x.WorkoutExerciseId))
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
                    WorkoutStartedAt = latest.WorkoutStartedAt,
                    Sets = sets ?? [],
                };
            })
            .ToList();

        return response;
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
}
