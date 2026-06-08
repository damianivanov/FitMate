using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.Analytics;
using FitMate.DB;
using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.Analytics;

public class AnalyticsService : IAnalyticsService
{
    private const int PersonalRecordLimit = 20;

    private readonly AppDbContext dbContext;

    public AnalyticsService(AppDbContext dbContext)
    {
        this.dbContext = dbContext;
    }

    public async Task<AnalyticsOverviewModel> GetOverviewAsync(long userId, AnalyticsQueryRequest request)
    {
        if (userId <= 0)
        {
            throw new FitMateException("Unauthorized.");
        }

        var workouts = await LoadCompletedWorkoutsAsync(userId, request);
        var entries = BuildSetEntries(workouts);
        var muscleGroupNames = await LoadMuscleGroupNamesAsync(entries);

        return new AnalyticsOverviewModel
        {
            WorkoutCount = workouts.Count,
            TotalVolumeKg = Round(workouts.Sum(x => x.TotalVolumeKg ?? 0m)),
            TotalSets = entries.Count,
            TotalReps = entries.Sum(x => x.Reps ?? 0),
            VolumeTrend = BuildVolumeTrend(workouts),
            MuscleGroupVolumes = BuildMuscleGroupVolumes(entries, muscleGroupNames),
            PersonalRecords = BuildPersonalRecords(entries, muscleGroupNames),
        };
    }

    public async Task<ExerciseProgressionModel> GetExerciseProgressionAsync(
        long userId,
        long exerciseId,
        AnalyticsQueryRequest request)
    {
        if (userId <= 0)
        {
            throw new FitMateException("Unauthorized.");
        }

        if (exerciseId <= 0)
        {
            throw new FitMateException("Exercise id is invalid.");
        }

        var workouts = await LoadCompletedWorkoutsAsync(userId, request);
        var entries = BuildSetEntries(workouts)
            .Where(x => x.ExerciseId == exerciseId)
            .ToList();

        var exerciseName = entries.FirstOrDefault()?.ExerciseName
            ?? await dbContext.Exercises
                .AsNoTracking()
                .Where(x => x.Id == exerciseId)
                .Select(x => x.Name)
                .FirstOrDefaultAsync()
            ?? string.Empty;

        var points = entries
            .GroupBy(x => x.Date.Date)
            .OrderBy(group => group.Key)
            .Select(group => new ExerciseProgressionPointModel
            {
                Date = AsUtc(group.Key),
                BestWeightKg = group.Where(x => x.WeightKg.HasValue).Max(x => x.WeightKg),
                BestReps = group.Where(x => x.Reps.HasValue).Max(x => x.Reps),
                EstimatedOneRepMax = MaxOrNull(group.Select(EstimateOneRepMax)),
                TotalVolumeKg = Round(group.Sum(x => x.VolumeKg)),
            })
            .ToList();

        return new ExerciseProgressionModel
        {
            ExerciseId = exerciseId,
            ExerciseName = exerciseName,
            Points = points,
        };
    }

    private async Task<List<Workout>> LoadCompletedWorkoutsAsync(long userId, AnalyticsQueryRequest request)
    {
        var query = dbContext.Workouts
            .AsNoTracking()
            .Where(x => x.UserId == userId && x.FinishedAt != null);

        if (request.From.HasValue)
        {
            var from = request.From.Value;
            query = query.Where(x => x.FinishedAt >= from);
        }

        if (request.To.HasValue)
        {
            var to = request.To.Value;
            query = query.Where(x => x.FinishedAt <= to);
        }

        return await query
            .Include(x => x.ExerciseGroups)
                .ThenInclude(x => x.Exercises)
                    .ThenInclude(x => x.Exercise)
            .Include(x => x.ExerciseGroups)
                .ThenInclude(x => x.Exercises)
                    .ThenInclude(x => x.Sets)
            .AsSplitQuery()
            .ToListAsync();
    }

    private static List<SetEntry> BuildSetEntries(IEnumerable<Workout> workouts)
    {
        var entries = new List<SetEntry>();

        foreach (var workout in workouts)
        {
            var date = workout.FinishedAt ?? workout.StartedAt;

            foreach (var group in workout.ExerciseGroups)
            {
                foreach (var exercise in group.Exercises)
                {
                    foreach (var set in exercise.Sets)
                    {
                        if (!set.IsCompleted)
                        {
                            continue;
                        }

                        var volume = set.WeightKg.HasValue && set.Reps.HasValue
                            ? set.WeightKg.Value * set.Reps.Value
                            : 0m;

                        entries.Add(new SetEntry
                        {
                            Date = date,
                            ExerciseId = exercise.ExerciseId,
                            ExerciseName = exercise.Exercise?.Name ?? string.Empty,
                            MuscleGroupId = exercise.Exercise?.PrimaryMuscleGroupId ?? 0,
                            WeightKg = set.WeightKg,
                            Reps = set.Reps,
                            VolumeKg = volume,
                        });
                    }
                }
            }
        }

        return entries;
    }

    private async Task<Dictionary<long, string>> LoadMuscleGroupNamesAsync(IEnumerable<SetEntry> entries)
    {
        var muscleGroupIds = entries
            .Select(x => x.MuscleGroupId)
            .Where(id => id > 0)
            .Distinct()
            .ToList();

        if (muscleGroupIds.Count == 0)
        {
            return [];
        }

        return await dbContext.MuscleGroups
            .AsNoTracking()
            .Where(x => muscleGroupIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => x.Name);
    }

    private static List<VolumeTrendPointModel> BuildVolumeTrend(IEnumerable<Workout> workouts)
    {
        return workouts
            .GroupBy(x => GetWeekStart(x.FinishedAt ?? x.StartedAt))
            .OrderBy(group => group.Key)
            .Select(group => new VolumeTrendPointModel
            {
                PeriodStart = AsUtc(group.Key),
                TotalVolumeKg = Round(group.Sum(x => x.TotalVolumeKg ?? 0m)),
                WorkoutCount = group.Count(),
            })
            .ToList();
    }

    private static List<MuscleGroupVolumeModel> BuildMuscleGroupVolumes(
        IEnumerable<SetEntry> entries,
        IReadOnlyDictionary<long, string> muscleGroupNames)
    {
        return entries
            .Where(x => x.MuscleGroupId > 0)
            .GroupBy(x => x.MuscleGroupId)
            .Select(group => new MuscleGroupVolumeModel
            {
                MuscleGroupId = group.Key,
                MuscleGroupName = muscleGroupNames.TryGetValue(group.Key, out var name) ? name : "Unknown",
                TotalVolumeKg = Round(group.Sum(x => x.VolumeKg)),
                SetCount = group.Count(),
            })
            .OrderByDescending(x => x.TotalVolumeKg)
            .ThenByDescending(x => x.SetCount)
            .ToList();
    }

    private static List<PersonalRecordSummaryModel> BuildPersonalRecords(
        IEnumerable<SetEntry> entries,
        IReadOnlyDictionary<long, string> muscleGroupNames)
    {
        return entries
            .GroupBy(x => new { x.ExerciseId, x.ExerciseName })
            .Select(group => new PersonalRecordSummaryModel
            {
                ExerciseId = group.Key.ExerciseId,
                ExerciseName = group.Key.ExerciseName,
                PrimaryMuscleGroupId = group.Select(x => x.MuscleGroupId).FirstOrDefault(id => id > 0),
                PrimaryMuscleGroupName = muscleGroupNames.TryGetValue(
                    group.Select(x => x.MuscleGroupId).FirstOrDefault(id => id > 0),
                    out var name)
                    ? name
                    : string.Empty,
                BestWeightKg = group.Where(x => x.WeightKg.HasValue).Max(x => x.WeightKg),
                BestReps = group.Where(x => x.Reps.HasValue).Max(x => x.Reps),
                BestEstimatedOneRepMax = MaxOrNull(group.Select(EstimateOneRepMax)),
                BestVolumeKg = group.Any(x => x.VolumeKg > 0m) ? Round(group.Max(x => x.VolumeKg)) : null,
                LastTrainedOn = AsUtc(group.Max(x => x.Date)),
            })
            .OrderByDescending(x => x.LastTrainedOn)
            .ThenByDescending(x => x.BestEstimatedOneRepMax ?? 0m)
            .Take(PersonalRecordLimit)
            .ToList();
    }

    private static decimal? EstimateOneRepMax(SetEntry entry)
    {
        if (!entry.WeightKg.HasValue || !entry.Reps.HasValue || entry.WeightKg.Value <= 0m || entry.Reps.Value <= 0)
        {
            return null;
        }

        var estimate = entry.WeightKg.Value * (1m + entry.Reps.Value / 30m);
        return Round(estimate);
    }

    private static decimal? MaxOrNull(IEnumerable<decimal?> values)
    {
        var present = values.Where(x => x.HasValue).Select(x => x!.Value).ToList();
        return present.Count == 0 ? null : present.Max();
    }

    private static DateTime GetWeekStart(DateTime value)
    {
        var date = value.Date;
        var diff = ((int)date.DayOfWeek + 6) % 7;
        return date.AddDays(-diff);
    }

    private static DateTime AsUtc(DateTime value)
    {
        return DateTime.SpecifyKind(value, DateTimeKind.Utc);
    }

    private static decimal Round(decimal value)
    {
        return Math.Round(value, 2, MidpointRounding.AwayFromZero);
    }

    private sealed class SetEntry
    {
        public DateTime Date { get; init; }
        public long ExerciseId { get; init; }
        public string ExerciseName { get; init; } = string.Empty;
        public long MuscleGroupId { get; init; }
        public decimal? WeightKg { get; init; }
        public int? Reps { get; init; }
        public decimal VolumeKg { get; init; }
    }
}
