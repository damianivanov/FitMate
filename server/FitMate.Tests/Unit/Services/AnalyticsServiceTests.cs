using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.Analytics;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.Services.Analytics;
using FitMate.Tests.TestInfrastructure;

namespace FitMate.Tests.Unit.Services;

public class AnalyticsServiceTests
{
    private static long SeedExercise(AppDbContext db, string name, long muscleGroupId, long? userId = SqliteTestDatabase.UserId)
    {
        var exercise = new Exercise
        {
            UserId = userId,
            Name = name,
            Slug = name.ToLowerInvariant().Replace(' ', '-'),
            PrimaryMuscleGroupId = muscleGroupId,
            IsPublic = true,
        };

        db.Exercises.Add(exercise);
        db.SaveChanges();
        return exercise.Id;
    }

    private static Workout SeedWorkout(
        AppDbContext db,
        long userId,
        DateTime startedAt,
        DateTime? finishedAt,
        decimal? totalVolumeKg = null)
    {
        var workout = new Workout
        {
            UserId = userId,
            Title = "Workout",
            StartedAt = startedAt,
            FinishedAt = finishedAt,
            TotalVolumeKg = totalVolumeKg,
        };

        db.Workouts.Add(workout);
        db.SaveChanges();
        return workout;
    }

    private static void AddSets(AppDbContext db, long workoutId, long exerciseId, params ExerciseSet[] sets)
    {
        var group = new WorkoutExerciseGroup
        {
            WorkoutId = workoutId,
            SortOrder = db.WorkoutExerciseGroups.Count(g => g.WorkoutId == workoutId),
        };

        db.WorkoutExerciseGroups.Add(group);
        db.SaveChanges();

        var workoutExercise = new WorkoutExercise
        {
            WorkoutExerciseGroupId = group.Id,
            ExerciseId = exerciseId,
            OrderIndex = 0,
        };

        db.WorkoutExercises.Add(workoutExercise);
        db.SaveChanges();

        var index = 0;
        foreach (var set in sets)
        {
            set.WorkoutExerciseId = workoutExercise.Id;
            set.OrderIndex = index++;
        }

        db.ExerciseSets.AddRange(sets);
        db.SaveChanges();
    }

    // Невалиден потребител хвърля Unauthorized
    [Fact]
    public async Task GetOverviewAsync_InvalidUserId_Throws()
    {
        using var db = new SqliteTestDatabase();
        var service = new AnalyticsService(db.CreateContext());

        var ex = await Assert.ThrowsAsync<FitMateException>(
            () => service.GetOverviewAsync(0, new AnalyticsQueryRequest()));

        Assert.Equal("Unauthorized.", ex.Message);
    }

    // Без завършени тренировки връща нули
    [Fact]
    public async Task GetOverviewAsync_NoCompletedWorkouts_ReturnsZeros()
    {
        using var db = new SqliteTestDatabase();

        using (var arrange = db.CreateContext())
        {
            var exerciseId = SeedExercise(arrange, "Bench Press", SqliteTestDatabase.ChestId);
            var draft = SeedWorkout(
                arrange,
                SqliteTestDatabase.UserId,
                new DateTime(2026, 3, 4, 8, 0, 0, DateTimeKind.Utc),
                finishedAt: null);

            AddSets(arrange, draft.Id, exerciseId, new ExerciseSet
            {
                WeightKg = 100m,
                Reps = 5,
                IsCompleted = true,
            });
        }

        var service = new AnalyticsService(db.CreateContext());
        var result = await service.GetOverviewAsync(SqliteTestDatabase.UserId, new AnalyticsQueryRequest());

        Assert.Equal(0, result.WorkoutCount);
        Assert.Equal(0m, result.TotalVolumeKg);
        Assert.Equal(0, result.TotalSets);
        Assert.Equal(0, result.TotalReps);
        Assert.Empty(result.MuscleGroupVolumes);
        Assert.Empty(result.PersonalRecords);
        Assert.Empty(result.VolumeTrend);
    }

    // Незавършените чернови не се броят
    [Fact]
    public async Task GetOverviewAsync_IgnoresDrafts()
    {
        using var db = new SqliteTestDatabase();

        using (var arrange = db.CreateContext())
        {
            var exerciseId = SeedExercise(arrange, "Bench Press", SqliteTestDatabase.ChestId);

            var finished = SeedWorkout(
                arrange,
                SqliteTestDatabase.UserId,
                new DateTime(2026, 3, 4, 8, 0, 0, DateTimeKind.Utc),
                finishedAt: new DateTime(2026, 3, 4, 9, 0, 0, DateTimeKind.Utc),
                totalVolumeKg: 500m);
            AddSets(arrange, finished.Id, exerciseId, new ExerciseSet
            {
                WeightKg = 100m,
                Reps = 5,
                IsCompleted = true,
            });

            SeedWorkout(
                arrange,
                SqliteTestDatabase.UserId,
                new DateTime(2026, 3, 5, 8, 0, 0, DateTimeKind.Utc),
                finishedAt: null);
        }

        var service = new AnalyticsService(db.CreateContext());
        var result = await service.GetOverviewAsync(SqliteTestDatabase.UserId, new AnalyticsQueryRequest());

        Assert.Equal(1, result.WorkoutCount);
    }

    // Общият обем идва от запазения обем на тренировката
    [Fact]
    public async Task GetOverviewAsync_TotalVolumeComesFromStoredWorkoutVolume()
    {
        using var db = new SqliteTestDatabase();

        using (var arrange = db.CreateContext())
        {
            var exerciseId = SeedExercise(arrange, "Bench Press", SqliteTestDatabase.ChestId);
            var finished = SeedWorkout(
                arrange,
                SqliteTestDatabase.UserId,
                new DateTime(2026, 3, 4, 8, 0, 0, DateTimeKind.Utc),
                finishedAt: new DateTime(2026, 3, 4, 9, 0, 0, DateTimeKind.Utc),
                totalVolumeKg: 500m);

            AddSets(arrange, finished.Id, exerciseId, new ExerciseSet
            {
                WeightKg = 10m,
                Reps = 3,
                IsCompleted = true,
            });
        }

        var service = new AnalyticsService(db.CreateContext());
        var result = await service.GetOverviewAsync(SqliteTestDatabase.UserId, new AnalyticsQueryRequest());

        Assert.Equal(500m, result.TotalVolumeKg);
    }

    // Брои само завършените серии и повторения
    [Fact]
    public async Task GetOverviewAsync_CountsOnlyCompletedSets()
    {
        using var db = new SqliteTestDatabase();

        using (var arrange = db.CreateContext())
        {
            var exerciseId = SeedExercise(arrange, "Bench Press", SqliteTestDatabase.ChestId);
            var finished = SeedWorkout(
                arrange,
                SqliteTestDatabase.UserId,
                new DateTime(2026, 3, 4, 8, 0, 0, DateTimeKind.Utc),
                finishedAt: new DateTime(2026, 3, 4, 9, 0, 0, DateTimeKind.Utc),
                totalVolumeKg: 0m);

            AddSets(
                arrange,
                finished.Id,
                exerciseId,
                new ExerciseSet { WeightKg = 100m, Reps = 5, IsCompleted = true },
                new ExerciseSet { WeightKg = 100m, Reps = 8, IsCompleted = false });
        }

        var service = new AnalyticsService(db.CreateContext());
        var result = await service.GetOverviewAsync(SqliteTestDatabase.UserId, new AnalyticsQueryRequest());

        Assert.Equal(1, result.TotalSets);
        Assert.Equal(5, result.TotalReps);
    }

    // Групира обема по основна мускулна група
    [Fact]
    public async Task GetOverviewAsync_GroupsVolumeByPrimaryMuscleGroup()
    {
        using var db = new SqliteTestDatabase();

        using (var arrange = db.CreateContext())
        {
            var chestId = SeedExercise(arrange, "Bench Press", SqliteTestDatabase.ChestId);
            var backId = SeedExercise(arrange, "Row", SqliteTestDatabase.BackId);

            var finished = SeedWorkout(
                arrange,
                SqliteTestDatabase.UserId,
                new DateTime(2026, 3, 4, 8, 0, 0, DateTimeKind.Utc),
                finishedAt: new DateTime(2026, 3, 4, 9, 0, 0, DateTimeKind.Utc),
                totalVolumeKg: 700m);

            AddSets(arrange, finished.Id, chestId, new ExerciseSet
            {
                WeightKg = 100m,
                Reps = 5,
                IsCompleted = true,
            });
            AddSets(arrange, finished.Id, backId, new ExerciseSet
            {
                WeightKg = 50m,
                Reps = 4,
                IsCompleted = true,
            });
        }

        var service = new AnalyticsService(db.CreateContext());
        var result = await service.GetOverviewAsync(SqliteTestDatabase.UserId, new AnalyticsQueryRequest());

        Assert.Equal(2, result.MuscleGroupVolumes.Count);

        var first = result.MuscleGroupVolumes[0];
        Assert.Equal(SqliteTestDatabase.ChestId, first.MuscleGroupId);
        Assert.Equal("Chest", first.MuscleGroupName);
        Assert.Equal(500m, first.TotalVolumeKg);

        var second = result.MuscleGroupVolumes[1];
        Assert.Equal(SqliteTestDatabase.BackId, second.MuscleGroupId);
        Assert.Equal("Back", second.MuscleGroupName);
        Assert.Equal(200m, second.TotalVolumeKg);
    }

    // Обемната тенденция се групира по седмици
    [Fact]
    public async Task GetOverviewAsync_VolumeTrendGroupsByWeek()
    {
        using var db = new SqliteTestDatabase();

        using (var arrange = db.CreateContext())
        {
            var exerciseId = SeedExercise(arrange, "Bench Press", SqliteTestDatabase.ChestId);

            var w1 = SeedWorkout(
                arrange,
                SqliteTestDatabase.UserId,
                new DateTime(2026, 3, 4, 8, 0, 0, DateTimeKind.Utc),
                finishedAt: new DateTime(2026, 3, 4, 9, 0, 0, DateTimeKind.Utc),
                totalVolumeKg: 100m);
            AddSets(arrange, w1.Id, exerciseId, new ExerciseSet { WeightKg = 100m, Reps = 1, IsCompleted = true });

            var w2 = SeedWorkout(
                arrange,
                SqliteTestDatabase.UserId,
                new DateTime(2026, 3, 6, 8, 0, 0, DateTimeKind.Utc),
                finishedAt: new DateTime(2026, 3, 6, 9, 0, 0, DateTimeKind.Utc),
                totalVolumeKg: 100m);
            AddSets(arrange, w2.Id, exerciseId, new ExerciseSet { WeightKg = 100m, Reps = 1, IsCompleted = true });
        }

        var service = new AnalyticsService(db.CreateContext());
        var sameWeek = await service.GetOverviewAsync(SqliteTestDatabase.UserId, new AnalyticsQueryRequest());

        Assert.Single(sameWeek.VolumeTrend);
        Assert.Equal(new DateTime(2026, 3, 2, 0, 0, 0, DateTimeKind.Utc), sameWeek.VolumeTrend[0].PeriodStart);
        Assert.Equal(2, sameWeek.VolumeTrend[0].WorkoutCount);

        using (var arrange = db.CreateContext())
        {
            var exerciseId = arrange.Exercises.First().Id;
            var w3 = SeedWorkout(
                arrange,
                SqliteTestDatabase.UserId,
                new DateTime(2026, 3, 11, 8, 0, 0, DateTimeKind.Utc),
                finishedAt: new DateTime(2026, 3, 11, 9, 0, 0, DateTimeKind.Utc),
                totalVolumeKg: 100m);
            AddSets(arrange, w3.Id, exerciseId, new ExerciseSet { WeightKg = 100m, Reps = 1, IsCompleted = true });
        }

        var twoWeeks = await new AnalyticsService(db.CreateContext())
            .GetOverviewAsync(SqliteTestDatabase.UserId, new AnalyticsQueryRequest());

        Assert.Equal(2, twoWeeks.VolumeTrend.Count);
        Assert.Equal(new DateTime(2026, 3, 2, 0, 0, 0, DateTimeKind.Utc), twoWeeks.VolumeTrend[0].PeriodStart);
        Assert.Equal(new DateTime(2026, 3, 9, 0, 0, 0, DateTimeKind.Utc), twoWeeks.VolumeTrend[1].PeriodStart);
    }

    // Филтрира тренировките по зададен период
    [Fact]
    public async Task GetOverviewAsync_DateRangeFilters()
    {
        using var db = new SqliteTestDatabase();

        using (var arrange = db.CreateContext())
        {
            var exerciseId = SeedExercise(arrange, "Bench Press", SqliteTestDatabase.ChestId);

            foreach (var day in new[] { 4, 10, 16 })
            {
                var workout = SeedWorkout(
                    arrange,
                    SqliteTestDatabase.UserId,
                    new DateTime(2026, 3, day, 8, 0, 0, DateTimeKind.Utc),
                    finishedAt: new DateTime(2026, 3, day, 9, 0, 0, DateTimeKind.Utc),
                    totalVolumeKg: 100m);
                AddSets(arrange, workout.Id, exerciseId, new ExerciseSet { WeightKg = 100m, Reps = 1, IsCompleted = true });
            }
        }

        var request = new AnalyticsQueryRequest
        {
            From = new DateTime(2026, 3, 8, 0, 0, 0, DateTimeKind.Utc),
            To = new DateTime(2026, 3, 12, 0, 0, 0, DateTimeKind.Utc),
        };

        var service = new AnalyticsService(db.CreateContext());
        var result = await service.GetOverviewAsync(SqliteTestDatabase.UserId, request);

        Assert.Equal(1, result.WorkoutCount);
    }

    // Невалиден потребител хвърля Unauthorized
    [Fact]
    public async Task GetExerciseProgressionAsync_InvalidUserId_Throws()
    {
        using var db = new SqliteTestDatabase();
        var service = new AnalyticsService(db.CreateContext());

        var ex = await Assert.ThrowsAsync<FitMateException>(
            () => service.GetExerciseProgressionAsync(0, 1, new AnalyticsQueryRequest()));

        Assert.Equal("Unauthorized.", ex.Message);
    }

    // Невалидно id на упражнение хвърля грешка
    [Fact]
    public async Task GetExerciseProgressionAsync_InvalidExerciseId_Throws()
    {
        using var db = new SqliteTestDatabase();
        var service = new AnalyticsService(db.CreateContext());

        var ex = await Assert.ThrowsAsync<FitMateException>(
            () => service.GetExerciseProgressionAsync(SqliteTestDatabase.UserId, 0, new AnalyticsQueryRequest()));

        Assert.Equal("Exercise id is invalid.", ex.Message);
    }

    // Изчислява най-добро тегло, повторения и оценен 1ПМ
    [Fact]
    public async Task GetExerciseProgressionAsync_ComputesBestWeightRepsAndOneRepMax()
    {
        using var db = new SqliteTestDatabase();
        long exerciseId;

        using (var arrange = db.CreateContext())
        {
            exerciseId = SeedExercise(arrange, "Bench Press", SqliteTestDatabase.ChestId);
            var finished = SeedWorkout(
                arrange,
                SqliteTestDatabase.UserId,
                new DateTime(2026, 3, 4, 8, 0, 0, DateTimeKind.Utc),
                finishedAt: new DateTime(2026, 3, 4, 9, 0, 0, DateTimeKind.Utc),
                totalVolumeKg: 1450m);

            AddSets(
                arrange,
                finished.Id,
                exerciseId,
                new ExerciseSet { WeightKg = 100m, Reps = 10, IsCompleted = true },
                new ExerciseSet { WeightKg = 90m, Reps = 5, IsCompleted = true });
        }

        var service = new AnalyticsService(db.CreateContext());
        var result = await service.GetExerciseProgressionAsync(
            SqliteTestDatabase.UserId,
            exerciseId,
            new AnalyticsQueryRequest());

        Assert.Equal(exerciseId, result.ExerciseId);
        Assert.Equal("Bench Press", result.ExerciseName);
        Assert.Single(result.Points);

        var point = result.Points[0];
        Assert.Equal(100m, point.BestWeightKg);
        Assert.Equal(10, point.BestReps);
        Assert.Equal(133.33m, point.EstimatedOneRepMax);
        Assert.Equal(1450m, point.TotalVolumeKg);
    }

    // Точките са групирани по ден във възходящ ред
    [Fact]
    public async Task GetExerciseProgressionAsync_GroupsPointsByDayAscending()
    {
        using var db = new SqliteTestDatabase();
        long exerciseId;

        using (var arrange = db.CreateContext())
        {
            exerciseId = SeedExercise(arrange, "Bench Press", SqliteTestDatabase.ChestId);

            var earlier = SeedWorkout(
                arrange,
                SqliteTestDatabase.UserId,
                new DateTime(2026, 3, 4, 8, 0, 0, DateTimeKind.Utc),
                finishedAt: new DateTime(2026, 3, 4, 9, 0, 0, DateTimeKind.Utc),
                totalVolumeKg: 500m);
            AddSets(arrange, earlier.Id, exerciseId, new ExerciseSet { WeightKg = 100m, Reps = 5, IsCompleted = true });

            var later = SeedWorkout(
                arrange,
                SqliteTestDatabase.UserId,
                new DateTime(2026, 3, 7, 8, 0, 0, DateTimeKind.Utc),
                finishedAt: new DateTime(2026, 3, 7, 9, 0, 0, DateTimeKind.Utc),
                totalVolumeKg: 600m);
            AddSets(arrange, later.Id, exerciseId, new ExerciseSet { WeightKg = 120m, Reps = 5, IsCompleted = true });
        }

        var service = new AnalyticsService(db.CreateContext());
        var result = await service.GetExerciseProgressionAsync(
            SqliteTestDatabase.UserId,
            exerciseId,
            new AnalyticsQueryRequest());

        Assert.Equal(2, result.Points.Count);
        Assert.Equal(new DateTime(2026, 3, 4, 0, 0, 0, DateTimeKind.Utc), result.Points[0].Date);
        Assert.Equal(new DateTime(2026, 3, 7, 0, 0, 0, DateTimeKind.Utc), result.Points[1].Date);
    }
}
