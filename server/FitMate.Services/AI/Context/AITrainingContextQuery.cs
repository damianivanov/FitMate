using FitMate.DB;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.AI.Context;

public class AITrainingContextQuery : IAITrainingContextQuery
{
    private const int MaxWorkouts = 20;
    private const int MaxCandidates = 100;
    private const int MaxExerciseIds = 50;
    private const int MaxTemplates = 10;
    private const int MaxSetsPerExercise = 10;
    private const int MaxExercisesPerWorkout = 20;

    private readonly AppDbContext dbContext;

    public AITrainingContextQuery(AppDbContext dbContext)
    {
        this.dbContext = dbContext;
    }

    public async Task<IReadOnlyList<AIRecentWorkoutModel>> GetRecentWorkoutsAsync(
        long userId,
        int take,
        CancellationToken cancellationToken)
    {
        var limit = Math.Clamp(take, 1, MaxWorkouts);

        var workouts = await dbContext.Workouts
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.StartedAt ?? x.FinishedAt)
            .ThenByDescending(x => x.Id)
            .Take(limit)
            .Select(workout => new
            {
                workout.Id,
                workout.Title,
                workout.StartedAt,
                workout.FinishedAt,
                workout.TotalVolumeKg,
                workout.DurationSeconds,
                Exercises = workout.ExerciseGroups
                    .SelectMany(group => group.Exercises)
                    .Select(exercise => new
                    {
                        exercise.ExerciseId,
                        ExerciseName = exercise.Exercise.Name,
                        SetCount = exercise.Sets.Count,
                        exercise.OrderIndex,
                    })
                    .ToList(),
            })
            .ToListAsync(cancellationToken);

        return workouts
            .Select(workout => new AIRecentWorkoutModel(
                workout.Id,
                workout.Title,
                workout.StartedAt,
                workout.FinishedAt,
                workout.TotalVolumeKg,
                workout.DurationSeconds,
                workout.Exercises
                    .OrderBy(exercise => exercise.OrderIndex)
                    .Take(MaxExercisesPerWorkout)
                    .Select(exercise => new AIRecentWorkoutExerciseModel(
                        exercise.ExerciseId,
                        exercise.ExerciseName,
                        exercise.SetCount))
                    .ToList()))
            .ToList();
    }

    public async Task<IReadOnlyList<AIExerciseCandidateModel>> GetExerciseCandidatesAsync(
        long userId,
        IReadOnlyCollection<long> muscleGroupIds,
        int take,
        CancellationToken cancellationToken)
    {
        var limit = Math.Clamp(take, 1, MaxCandidates);
        var groupIds = muscleGroupIds.Distinct().ToList();

        var query = dbContext.Exercises
            .AsNoTracking()
            .Where(x => x.IsPublic || x.UserId == userId);

        if (groupIds.Count > 0)
        {
            query = query.Where(x => groupIds.Contains(x.PrimaryMuscleGroupId)
                || (x.SecondaryMuscleGroupId != null && groupIds.Contains(x.SecondaryMuscleGroupId.Value)));
        }

        // No ImageUrl or VideoUrl: the model never sees media, and resolving storage URLs is the
        // reason the UI loader is too expensive to reuse here.
        return await query
            .OrderBy(x => x.Name)
            .Take(limit)
            .Select(x => new AIExerciseCandidateModel(
                x.Id,
                x.Name,
                x.PrimaryMuscleGroupId,
                x.PrimaryMuscleGroup.Name,
                x.SecondaryMuscleGroup != null ? x.SecondaryMuscleGroup.Name : null,
                x.Equipment != null ? x.Equipment.ToString() : null,
                x.MovementPattern != null ? x.MovementPattern.ToString() : null))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyDictionary<long, AILatestExercisePerformanceModel>> GetLatestPerformanceAsync(
        long userId,
        IReadOnlyCollection<long> exerciseIds,
        CancellationToken cancellationToken)
    {
        var ids = exerciseIds.Distinct().Take(MaxExerciseIds).ToList();
        if (ids.Count == 0)
        {
            return new Dictionary<long, AILatestExercisePerformanceModel>();
        }

        // Two bounded queries rather than one grouped-and-ordered query: the single-query form does
        // not translate on every provider and silently degrades to client evaluation, which is the
        // exact cost this exists to remove.
        var newest = await dbContext.WorkoutExercises
            .AsNoTracking()
            .Where(x => ids.Contains(x.ExerciseId)
                && x.WorkoutExerciseGroup.Workout.UserId == userId
                && x.WorkoutExerciseGroup.Workout.StartedAt != null)
            .GroupBy(x => x.ExerciseId)
            .Select(group => new
            {
                ExerciseId = group.Key,
                PerformedAt = group.Max(x => x.WorkoutExerciseGroup.Workout.StartedAt!.Value),
            })
            .ToListAsync(cancellationToken);

        if (newest.Count == 0)
        {
            return new Dictionary<long, AILatestExercisePerformanceModel>();
        }

        var newestByExercise = newest.ToDictionary(x => x.ExerciseId, x => x.PerformedAt);

        var rows = await dbContext.WorkoutExercises
            .AsNoTracking()
            .Where(x => ids.Contains(x.ExerciseId)
                && x.WorkoutExerciseGroup.Workout.UserId == userId
                && x.WorkoutExerciseGroup.Workout.StartedAt != null)
            .Select(x => new
            {
                x.ExerciseId,
                PerformedAt = x.WorkoutExerciseGroup.Workout.StartedAt!.Value,
                Sets = x.Sets
                    .OrderBy(set => set.OrderIndex)
                    .Take(MaxSetsPerExercise)
                    .Select(set => new { set.WeightKg, set.Reps })
                    .ToList(),
            })
            .ToListAsync(cancellationToken);

        return rows
            .Where(x => newestByExercise.TryGetValue(x.ExerciseId, out var performedAt)
                && x.PerformedAt == performedAt)
            .GroupBy(x => x.ExerciseId)
            .ToDictionary(
                group => group.Key,
                group =>
                {
                    var latest = group.First();

                    return new AILatestExercisePerformanceModel(
                        group.Key,
                        latest.PerformedAt,
                        latest.Sets.Select(set => set.WeightKg).FirstOrDefault(weight => weight != null),
                        latest.Sets.Where(set => set.Reps != null).Select(set => set.Reps!.Value).ToList());
                });
    }

    public async Task<IReadOnlyList<AIMatchingTemplateModel>> GetMatchingTemplatesAsync(
        long userId,
        IReadOnlyCollection<long> exerciseIds,
        int take,
        CancellationToken cancellationToken)
    {
        var ids = exerciseIds.Distinct().Take(MaxExerciseIds).ToList();
        if (ids.Count == 0)
        {
            return [];
        }

        var limit = Math.Clamp(take, 1, MaxTemplates);

        return await dbContext.WorkoutTemplates
            .AsNoTracking()
            .Where(template => (template.IsPublic || template.UserId == userId)
                && template.ExerciseGroups
                    .SelectMany(group => group.Exercises)
                    .Any(exercise => ids.Contains(exercise.ExerciseId)))
            .OrderBy(template => template.Name)
            .Take(limit)
            .Select(template => new AIMatchingTemplateModel(
                template.Id,
                template.Name,
                template.ExerciseGroups.SelectMany(group => group.Exercises).Count()))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<AIMuscleExposureModel>> GetRecentMuscleExposureAsync(
        long userId,
        IReadOnlyCollection<long> muscleGroupIds,
        int workoutsToScan,
        CancellationToken cancellationToken)
    {
        var scan = Math.Clamp(workoutsToScan, 1, MaxWorkouts);
        var groupIds = muscleGroupIds.Distinct().ToList();

        var recentWorkoutIds = await dbContext.Workouts
            .AsNoTracking()
            .Where(x => x.UserId == userId && x.StartedAt != null)
            .OrderByDescending(x => x.StartedAt)
            .Take(scan)
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);

        if (recentWorkoutIds.Count == 0)
        {
            return [];
        }

        var query = dbContext.WorkoutExercises
            .AsNoTracking()
            .Where(x => recentWorkoutIds.Contains(x.WorkoutExerciseGroup.WorkoutId));

        if (groupIds.Count > 0)
        {
            query = query.Where(x => groupIds.Contains(x.Exercise.PrimaryMuscleGroupId));
        }

        // Grouped into an anonymous type, not the record: projecting a constructor inside a GroupBy
        // is not translatable and falls back to loading every row.
        var exposure = await query
            .GroupBy(x => x.Exercise.PrimaryMuscleGroupId)
            .Select(group => new
            {
                MuscleGroupId = group.Key,
                LastTrainedAt = group.Max(x => x.WorkoutExerciseGroup.Workout.StartedAt!.Value),
            })
            .ToListAsync(cancellationToken);

        return exposure
            .OrderByDescending(x => x.LastTrainedAt)
            .Select(x => new AIMuscleExposureModel(x.MuscleGroupId, x.LastTrainedAt))
            .ToList();
    }
}
