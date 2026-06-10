using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.Workouts;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.Workouts;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Tests.Unit.Services;

public class WorkoutServiceTests
{
    private static long SeedExercise(SqliteTestDatabase db, string slug = "bench-press")
    {
        using var context = db.CreateContext();
        var exercise = new Exercise
        {
            Name = slug,
            Slug = slug,
            PrimaryMuscleGroupId = SqliteTestDatabase.ChestId,
        };
        context.Exercises.Add(exercise);
        context.SaveChanges();
        return exercise.Id;
    }

    private static SaveWorkoutRequest BuildRequest(
        string title,
        params CreateWorkoutExerciseRequest[] exercises)
    {
        return new SaveWorkoutRequest
        {
            Title = title,
            Exercises = exercises.ToList(),
        };
    }

    private static CreateWorkoutExerciseRequest Exercise(
        long exerciseId,
        params CreateWorkoutSetRequest[] sets)
    {
        return new CreateWorkoutExerciseRequest
        {
            ExerciseId = exerciseId,
            GroupType = ExerciseGroupType.Straight,
            OrderIndex = 1,
            Sets = sets.ToList(),
        };
    }

    private static CreateWorkoutSetRequest Set(
        bool isCompleted,
        decimal? weightKg = null,
        int? reps = null)
    {
        return new CreateWorkoutSetRequest
        {
            SetType = ExerciseSetType.Working,
            IsCompleted = isCompleted,
            WeightKg = weightKg,
            Reps = reps,
        };
    }

    private static Workout SeedWorkout(
        SqliteTestDatabase db,
        long userId,
        DateTime startedAt,
        DateTime? finishedAt,
        long exerciseId,
        bool setCompleted)
    {
        using var context = db.CreateContext();
        var workout = new Workout
        {
            UserId = userId,
            Title = "Seeded Workout",
            StartedAt = startedAt,
            FinishedAt = finishedAt,
            ExerciseGroups =
            {
                new WorkoutExerciseGroup
                {
                    SortOrder = 1,
                    GroupType = ExerciseGroupType.Straight,
                    Exercises =
                    {
                        new WorkoutExercise
                        {
                            ExerciseId = exerciseId,
                            OrderIndex = 1,
                            Sets =
                            {
                                new ExerciseSet
                                {
                                    OrderIndex = 1,
                                    SetType = ExerciseSetType.Working,
                                    WeightKg = 100m,
                                    Reps = 5,
                                    IsCompleted = setCompleted,
                                },
                            },
                        },
                    },
                },
            },
        };
        context.Workouts.Add(workout);
        context.SaveChanges();
        return workout;
    }

    // Връща само тренировките на текущия потребител
    [Fact]
    public async Task ListAsync_ReturnsOnlyCurrentUsersWorkouts()
    {
        using var db = new SqliteTestDatabase();
        var exerciseId = SeedExercise(db);
        var started = new DateTime(2026, 1, 1, 10, 0, 0, DateTimeKind.Utc);
        SeedWorkout(db, SqliteTestDatabase.UserId, started, started.AddHours(1), exerciseId, true);
        SeedWorkout(db, SqliteTestDatabase.OtherUserId, started, started.AddHours(1), exerciseId, true);

        var service = new WorkoutService(db.CreateContext(), new FakePhotoUrlResolver());
        var result = await service.ListAsync(SqliteTestDatabase.UserId);

        Assert.Single(result);
    }

    // Подрежда тренировките по начало, низходящо
    [Fact]
    public async Task ListAsync_OrdersByStartedAtDescending()
    {
        using var db = new SqliteTestDatabase();
        var exerciseId = SeedExercise(db);
        var earlier = new DateTime(2026, 1, 1, 10, 0, 0, DateTimeKind.Utc);
        var later = new DateTime(2026, 2, 1, 10, 0, 0, DateTimeKind.Utc);
        SeedWorkout(db, SqliteTestDatabase.UserId, earlier, earlier.AddHours(1), exerciseId, true);
        var laterWorkout = SeedWorkout(db, SqliteTestDatabase.UserId, later, later.AddHours(1), exerciseId, true);

        var service = new WorkoutService(db.CreateContext(), new FakePhotoUrlResolver());
        var result = await service.ListAsync(SqliteTestDatabase.UserId);

        Assert.Equal(2, result.Count);
        Assert.Equal(laterWorkout.Id, result[0].Id);
    }

    // Невалиден потребител хвърля "Unauthorized."
    [Fact]
    public async Task ListAsync_InvalidUserId_Throws()
    {
        using var db = new SqliteTestDatabase();
        var service = new WorkoutService(db.CreateContext(), new FakePhotoUrlResolver());

        var ex = await Assert.ThrowsAsync<FitMateException>(() => service.ListAsync(0));
        Assert.Equal("Unauthorized.", ex.Message);
    }

    // Чужда тренировка не се вижда (null)
    [Fact]
    public async Task GetByIdAsync_OtherUsersWorkout_ReturnsNull()
    {
        using var db = new SqliteTestDatabase();
        var exerciseId = SeedExercise(db);
        var started = new DateTime(2026, 1, 1, 10, 0, 0, DateTimeKind.Utc);
        var workout = SeedWorkout(db, SqliteTestDatabase.OtherUserId, started, started.AddHours(1), exerciseId, true);

        var service = new WorkoutService(db.CreateContext(), new FakePhotoUrlResolver());
        var result = await service.GetByIdAsync(workout.Id, SqliteTestDatabase.UserId);

        Assert.Null(result);
    }

    // Празно заглавие хвърля грешка за задължително заглавие
    [Fact]
    public async Task CreateAsync_EmptyTitle_Throws()
    {
        using var db = new SqliteTestDatabase();
        var exerciseId = SeedExercise(db);
        var request = BuildRequest("   ", Exercise(exerciseId, Set(true, 100m, 5)));

        var service = new WorkoutService(db.CreateContext(), new FakePhotoUrlResolver());

        var ex = await Assert.ThrowsAsync<FitMateException>(
            () => service.CreateAsync(request, SqliteTestDatabase.UserId));
        Assert.Equal("Workout title is required.", ex.Message);
    }

    // Изисква поне едно упражнение при създаване
    [Fact]
    public async Task CreateAsync_NoExercises_Throws()
    {
        using var db = new SqliteTestDatabase();
        var request = BuildRequest("Leg Day");

        var service = new WorkoutService(db.CreateContext(), new FakePhotoUrlResolver());

        var ex = await Assert.ThrowsAsync<FitMateException>(
            () => service.CreateAsync(request, SqliteTestDatabase.UserId));
        Assert.Equal("At least one exercise is required.", ex.Message);
    }

    // Чернова без упражнения се запазва без край
    [Fact]
    public async Task UpsertDraftAsync_NoExercises_Succeeds()
    {
        using var db = new SqliteTestDatabase();
        var request = BuildRequest("Draft Day");

        var service = new WorkoutService(db.CreateContext(), new FakePhotoUrlResolver());
        var result = await service.UpsertDraftAsync(request, SqliteTestDatabase.UserId);

        Assert.True(result.WorkoutId > 0);

        using var assertContext = db.CreateContext();
        var persisted = await assertContext.Workouts.FirstAsync(x => x.Id == result.WorkoutId);
        Assert.Null(persisted.FinishedAt);
    }

    // Чернова с празно заглавие се запазва
    [Fact]
    public async Task UpsertDraftAsync_EmptyTitle_Succeeds()
    {
        using var db = new SqliteTestDatabase();
        var exerciseId = SeedExercise(db);
        var request = BuildRequest("   ", Exercise(exerciseId, Set(false, 100m, 5)));

        var service = new WorkoutService(db.CreateContext(), new FakePhotoUrlResolver());
        var result = await service.UpsertDraftAsync(request, SqliteTestDatabase.UserId);

        Assert.True(result.WorkoutId > 0);

        using var assertContext = db.CreateContext();
        var persisted = await assertContext.Workouts.FirstAsync(x => x.Id == result.WorkoutId);
        Assert.Null(persisted.FinishedAt);
        Assert.Equal(string.Empty, persisted.Title);
    }

    // Чернова с упражнение без серии се запазва
    [Fact]
    public async Task UpsertDraftAsync_ExerciseWithoutSets_Succeeds()
    {
        using var db = new SqliteTestDatabase();
        var exerciseId = SeedExercise(db);
        var request = BuildRequest("Draft Day", Exercise(exerciseId));

        var service = new WorkoutService(db.CreateContext(), new FakePhotoUrlResolver());
        var result = await service.UpsertDraftAsync(request, SqliteTestDatabase.UserId);

        Assert.True(result.WorkoutId > 0);

        using var assertContext = db.CreateContext();
        var persisted = await assertContext.Workouts
            .Include(x => x.ExerciseGroups)
                .ThenInclude(x => x.Exercises)
                    .ThenInclude(x => x.Sets)
            .FirstAsync(x => x.Id == result.WorkoutId);

        var exercise = persisted.ExerciseGroups.Single().Exercises.Single();
        Assert.Equal(exerciseId, exercise.ExerciseId);
        Assert.Empty(exercise.Sets);
    }

    // Повтарящи се упражнения не са позволени
    [Fact]
    public async Task CreateAsync_DuplicateExercises_Throws()
    {
        using var db = new SqliteTestDatabase();
        var exerciseId = SeedExercise(db);
        var request = BuildRequest(
            "Dup Day",
            Exercise(exerciseId, Set(true, 100m, 5)),
            Exercise(exerciseId, Set(true, 100m, 5)));

        var service = new WorkoutService(db.CreateContext(), new FakePhotoUrlResolver());

        var ex = await Assert.ThrowsAsync<FitMateException>(
            () => service.CreateAsync(request, SqliteTestDatabase.UserId));
        Assert.Equal("Duplicate exercises are not supported in one workout.", ex.Message);
    }

    // Краят не може да е преди началото
    [Fact]
    public async Task CreateAsync_FinishedBeforeStarted_Throws()
    {
        using var db = new SqliteTestDatabase();
        var exerciseId = SeedExercise(db);
        var request = BuildRequest("Backwards", Exercise(exerciseId, Set(true, 100m, 5)));
        request.StartedAt = new DateTime(2026, 1, 1, 12, 0, 0, DateTimeKind.Utc);
        request.FinishedAt = new DateTime(2026, 1, 1, 10, 0, 0, DateTimeKind.Utc);

        var service = new WorkoutService(db.CreateContext(), new FakePhotoUrlResolver());

        var ex = await Assert.ThrowsAsync<FitMateException>(
            () => service.CreateAsync(request, SqliteTestDatabase.UserId));
        Assert.Equal("Workout finish time cannot be before start time.", ex.Message);
    }

    // Несъществуващо упражнение хвърля грешка
    [Fact]
    public async Task CreateAsync_NonExistentExercise_Throws()
    {
        using var db = new SqliteTestDatabase();
        var request = BuildRequest("Ghost", Exercise(99999, Set(true, 100m, 5)));

        var service = new WorkoutService(db.CreateContext(), new FakePhotoUrlResolver());

        var ex = await Assert.ThrowsAsync<FitMateException>(
            () => service.CreateAsync(request, SqliteTestDatabase.UserId));
        Assert.Equal("One or more selected exercises do not exist.", ex.Message);
    }

    // Смята обем и продължителност от завършените серии
    [Fact]
    public async Task CreateAsync_CompletedSets_CalculatesVolumeAndDuration()
    {
        using var db = new SqliteTestDatabase();
        var exerciseId = SeedExercise(db);
        var started = new DateTime(2026, 1, 1, 10, 0, 0, DateTimeKind.Utc);
        var request = BuildRequest(
            "Volume Day",
            Exercise(
                exerciseId,
                Set(true, 100m, 5),
                Set(false, 200m, 10),
                Set(true, 80m)));
        request.StartedAt = started;
        request.FinishedAt = started.AddHours(1);

        var service = new WorkoutService(db.CreateContext(), new FakePhotoUrlResolver());
        var result = await service.CreateAsync(request, SqliteTestDatabase.UserId);

        Assert.Equal(500m, result.TotalVolumeKg);
        Assert.Equal(2, result.SetCount);

        using var assertContext = db.CreateContext();
        var persisted = await assertContext.Workouts.FirstAsync(x => x.Id == result.WorkoutId);
        Assert.Equal(3600, persisted.DurationSeconds);
    }

    // Еднакво начало и край дава нулева продължителност
    [Fact]
    public async Task CreateAsync_FinishedEqualsStarted_SucceedsWithZeroDuration()
    {
        using var db = new SqliteTestDatabase();
        var exerciseId = SeedExercise(db);
        var moment = new DateTime(2026, 1, 1, 10, 0, 0, DateTimeKind.Utc);
        var request = BuildRequest("Instant", Exercise(exerciseId, Set(true, 100m, 5)));
        request.StartedAt = moment;
        request.FinishedAt = moment;

        var service = new WorkoutService(db.CreateContext(), new FakePhotoUrlResolver());
        var result = await service.CreateAsync(request, SqliteTestDatabase.UserId);

        using var assertContext = db.CreateContext();
        var persisted = await assertContext.Workouts.FirstAsync(x => x.Id == result.WorkoutId);
        Assert.Equal(0, persisted.DurationSeconds);
    }

    // Извън чернова изисква поне една завършена серия
    [Fact]
    public async Task CreateAsync_RequiresCompletedSet_WhenNotDraft()
    {
        using var db = new SqliteTestDatabase();
        var exerciseId = SeedExercise(db);
        var request = BuildRequest("Incomplete", Exercise(exerciseId, Set(false, 100m, 5)));

        var service = new WorkoutService(db.CreateContext(), new FakePhotoUrlResolver());

        var ex = await Assert.ThrowsAsync<FitMateException>(
            () => service.CreateAsync(request, SqliteTestDatabase.UserId));
        Assert.Equal("Exercise #1 must include at least one completed set.", ex.Message);
    }

    // Завършена серия без метрика хвърля грешка
    [Fact]
    public async Task CreateAsync_CompletedSetWithoutMetric_Throws()
    {
        using var db = new SqliteTestDatabase();
        var exerciseId = SeedExercise(db);
        var request = BuildRequest("No Metric", Exercise(exerciseId, Set(true)));

        var service = new WorkoutService(db.CreateContext(), new FakePhotoUrlResolver());

        var ex = await Assert.ThrowsAsync<FitMateException>(
            () => service.CreateAsync(request, SqliteTestDatabase.UserId));
        Assert.Equal(
            "Exercise #1, set #1: Set must include at least one metric (weight/reps/duration/distance).",
            ex.Message);
    }

    // Копира тренировка с нулирано изпълнение
    [Fact]
    public async Task DuplicateAsync_CreatesNewWorkoutWithResetCompletion()
    {
        using var db = new SqliteTestDatabase();
        var exerciseId = SeedExercise(db);
        var started = new DateTime(2026, 1, 1, 10, 0, 0, DateTimeKind.Utc);
        var source = SeedWorkout(db, SqliteTestDatabase.UserId, started, started.AddHours(1), exerciseId, true);

        var service = new WorkoutService(db.CreateContext(), new FakePhotoUrlResolver());
        var newId = await service.DuplicateAsync(source.Id, SqliteTestDatabase.UserId);

        Assert.NotEqual(source.Id, newId);

        using var assertContext = db.CreateContext();
        var copy = await assertContext.Workouts
            .Include(x => x.ExerciseGroups)
                .ThenInclude(x => x.Exercises)
                    .ThenInclude(x => x.Sets)
            .FirstAsync(x => x.Id == newId);

        Assert.Null(copy.FinishedAt);
        Assert.NotEqual(started, copy.StartedAt);
        var copySet = copy.ExerciseGroups.Single().Exercises.Single().Sets.Single();
        Assert.Equal(exerciseId, copy.ExerciseGroups.Single().Exercises.Single().ExerciseId);
        Assert.False(copySet.IsCompleted);
    }

    // Чужда тренировка не може да се копира
    [Fact]
    public async Task DuplicateAsync_OtherUsersWorkout_Throws()
    {
        using var db = new SqliteTestDatabase();
        var exerciseId = SeedExercise(db);
        var started = new DateTime(2026, 1, 1, 10, 0, 0, DateTimeKind.Utc);
        var source = SeedWorkout(db, SqliteTestDatabase.OtherUserId, started, started.AddHours(1), exerciseId, true);

        var service = new WorkoutService(db.CreateContext(), new FakePhotoUrlResolver());

        var ex = await Assert.ThrowsAsync<FitMateException>(
            () => service.DuplicateAsync(source.Id, SqliteTestDatabase.UserId));
        Assert.Equal("Workout not found.", ex.Message);
    }

    // Създава тренировка от шаблон с незавършени серии
    [Fact]
    public async Task StartFromTemplateAsync_CreatesWorkoutFromTemplate()
    {
        using var db = new SqliteTestDatabase();
        var exerciseId = SeedExercise(db);

        long templateId;
        string templateName = "My Template";
        using (var seedContext = db.CreateContext())
        {
            var template = new WorkoutTemplate
            {
                UserId = SqliteTestDatabase.UserId,
                Name = templateName,
                IsPublic = false,
                ExerciseGroups =
                {
                    new TemplateExerciseGroup
                    {
                        SortOrder = 1,
                        GroupType = ExerciseGroupType.Straight,
                        Exercises =
                        {
                            new TemplateExercise
                            {
                                ExerciseId = exerciseId,
                                OrderIndex = 1,
                                TargetSets = 2,
                                Sets =
                                {
                                    new TemplateExerciseSet { OrderIndex = 1, SetType = ExerciseSetType.Working, WeightKg = 50m, Reps = 8 },
                                    new TemplateExerciseSet { OrderIndex = 2, SetType = ExerciseSetType.Working, WeightKg = 50m, Reps = 8 },
                                },
                            },
                        },
                    },
                },
            };
            seedContext.WorkoutTemplates.Add(template);
            seedContext.SaveChanges();
            templateId = template.Id;
        }

        var service = new WorkoutService(db.CreateContext(), new FakePhotoUrlResolver());
        var workoutId = await service.StartFromTemplateAsync(templateId, SqliteTestDatabase.UserId);

        using var assertContext = db.CreateContext();
        var workout = await assertContext.Workouts
            .Include(x => x.ExerciseGroups)
                .ThenInclude(x => x.Exercises)
                    .ThenInclude(x => x.Sets)
            .FirstAsync(x => x.Id == workoutId);

        Assert.Equal(templateName, workout.Title);
        var workoutExercise = workout.ExerciseGroups.Single().Exercises.Single();
        Assert.Equal(exerciseId, workoutExercise.ExerciseId);
        Assert.Equal(2, workoutExercise.Sets.Count);
        Assert.All(workoutExercise.Sets, set => Assert.False(set.IsCompleted));
    }

    // Чужд частен шаблон не е достъпен
    [Fact]
    public async Task StartFromTemplateAsync_InaccessibleTemplate_Throws()
    {
        using var db = new SqliteTestDatabase();
        var exerciseId = SeedExercise(db);

        long templateId;
        using (var seedContext = db.CreateContext())
        {
            var template = new WorkoutTemplate
            {
                UserId = SqliteTestDatabase.OtherUserId,
                Name = "Private",
                IsPublic = false,
                ExerciseGroups =
                {
                    new TemplateExerciseGroup
                    {
                        SortOrder = 1,
                        GroupType = ExerciseGroupType.Straight,
                        Exercises =
                        {
                            new TemplateExercise { ExerciseId = exerciseId, OrderIndex = 1, TargetSets = 1 },
                        },
                    },
                },
            };
            seedContext.WorkoutTemplates.Add(template);
            seedContext.SaveChanges();
            templateId = template.Id;
        }

        var service = new WorkoutService(db.CreateContext(), new FakePhotoUrlResolver());

        var ex = await Assert.ThrowsAsync<FitMateException>(
            () => service.StartFromTemplateAsync(templateId, SqliteTestDatabase.UserId));
        Assert.Equal("Template not found.", ex.Message);
    }

    // Чужда тренировка не може да се изтрие
    [Fact]
    public async Task DeleteAsync_OtherUsersWorkout_Throws()
    {
        using var db = new SqliteTestDatabase();
        var exerciseId = SeedExercise(db);
        var started = new DateTime(2026, 1, 1, 10, 0, 0, DateTimeKind.Utc);
        var workout = SeedWorkout(db, SqliteTestDatabase.OtherUserId, started, started.AddHours(1), exerciseId, true);

        var service = new WorkoutService(db.CreateContext(), new FakePhotoUrlResolver());

        var ex = await Assert.ThrowsAsync<FitMateException>(
            () => service.DeleteAsync(workout.Id, SqliteTestDatabase.UserId));
        Assert.Equal("Workout not found.", ex.Message);
    }

    // Собствена тренировка се изтрива успешно
    [Fact]
    public async Task DeleteAsync_OwnWorkout_ReturnsTrue()
    {
        using var db = new SqliteTestDatabase();
        var exerciseId = SeedExercise(db);
        var started = new DateTime(2026, 1, 1, 10, 0, 0, DateTimeKind.Utc);
        var workout = SeedWorkout(db, SqliteTestDatabase.UserId, started, started.AddHours(1), exerciseId, true);

        var service = new WorkoutService(db.CreateContext(), new FakePhotoUrlResolver());
        var result = await service.DeleteAsync(workout.Id, SqliteTestDatabase.UserId);

        Assert.True(result);
    }

    // Невалиден месец хвърля "Invalid month."
    [Fact]
    public async Task GetCalendarMonthAsync_InvalidMonth_Throws()
    {
        using var db = new SqliteTestDatabase();
        var service = new WorkoutService(db.CreateContext(), new FakePhotoUrlResolver());

        var ex = await Assert.ThrowsAsync<FitMateException>(
            () => service.GetCalendarMonthAsync(SqliteTestDatabase.UserId, 2026, 13));
        Assert.Equal("Invalid month.", ex.Message);
    }
}
