using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Tests.Unit.Database;

public class AppDbContextTests
{
    private static long SeedExercise(SqliteTestDatabase db)
    {
        using var context = db.CreateContext();
        var exercise = new Exercise
        {
            Name = "Bench Press",
            Slug = "bench-press",
            PrimaryMuscleGroupId = SqliteTestDatabase.ChestId,
        };
        context.Exercises.Add(exercise);
        context.SaveChanges();
        return exercise.Id;
    }

    private static Workout BuildWorkout(long exerciseId) => new()
    {
        UserId = SqliteTestDatabase.UserId,
        Title = "Workout",
        StartedAt = new DateTime(2026, 1, 1, 10, 0, 0, DateTimeKind.Utc),
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
                                WeightKg = 50m,
                                Reps = 5,
                                IsCompleted = true,
                            },
                        },
                    },
                },
            },
        },
    };

    // Нов запис получава дата на създаване и промяна
    [Fact]
    public async Task SaveChanges_NewEntity_SetsDateCreatedAndDateModified()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();

        var exercise = new Exercise
        {
            Name = "Row",
            Slug = "row",
            PrimaryMuscleGroupId = SqliteTestDatabase.BackId,
        };
        context.Exercises.Add(exercise);
        await context.SaveChangesAsync();

        Assert.NotEqual(default, exercise.DateCreated);
        Assert.NotNull(exercise.DateModified);
    }

    // Обновяване сменя дата на промяна, не на създаване
    [Fact]
    public async Task SaveChanges_UpdatingEntity_RefreshesDateModifiedButNotDateCreated()
    {
        using var db = new SqliteTestDatabase();
        var exerciseId = SeedExercise(db);

        DateTime createdAt;
        await using (var read = db.CreateContext())
        {
            createdAt = (await read.Exercises.SingleAsync(x => x.Id == exerciseId)).DateCreated;
        }

        var beforeUpdate = DateTime.UtcNow;
        await using (var update = db.CreateContext())
        {
            var exercise = await update.Exercises.SingleAsync(x => x.Id == exerciseId);
            exercise.Name = "Renamed";
            await update.SaveChangesAsync();

            Assert.Equal(createdAt, exercise.DateCreated);
            Assert.NotNull(exercise.DateModified);
            Assert.True(exercise.DateModified >= beforeUpdate);
        }
    }

    // Подаден userId попълва създал и променил
    [Fact]
    public async Task SaveChangesWithUserId_SetsCreatedByAndModifiedBy()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();

        var token = new Token
        {
            UserId = SqliteTestDatabase.UserId,
            Value = "token-value",
            ExpiresAtUtc = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
        };
        context.Tokens.Add(token);
        await context.SaveChangesAsync(SqliteTestDatabase.UserId);

        Assert.Equal(SqliteTestDatabase.UserId, token.CreatedById);
        Assert.Equal(SqliteTestDatabase.UserId, token.ModifiedById);
    }

    // Без userId колоните за следене остават null
    [Fact]
    public async Task SaveChangesWithoutUserId_LeavesTrackingColumnsNull()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();

        var token = new Token
        {
            UserId = SqliteTestDatabase.UserId,
            Value = "token-value",
            ExpiresAtUtc = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
        };
        context.Tokens.Add(token);
        await context.SaveChangesAsync();

        Assert.Null(token.CreatedById);
        Assert.Null(token.ModifiedById);
    }

    // Триене на тренировка каскадно трие групи, упражнения, серии
    [Fact]
    public async Task DeletingWorkout_CascadesToGroupsExercisesAndSets()
    {
        using var db = new SqliteTestDatabase();
        var exerciseId = SeedExercise(db);

        long workoutId;
        await using (var arrange = db.CreateContext())
        {
            var workout = BuildWorkout(exerciseId);
            arrange.Workouts.Add(workout);
            await arrange.SaveChangesAsync();
            workoutId = workout.Id;
        }

        await using (var act = db.CreateContext())
        {
            var workout = await act.Workouts
                .Include(x => x.ExerciseGroups)
                    .ThenInclude(g => g.Exercises)
                        .ThenInclude(e => e.Sets)
                .SingleAsync(x => x.Id == workoutId);
            act.Workouts.Remove(workout);
            await act.SaveChangesAsync();
        }

        await using var assert = db.CreateContext();
        Assert.False(await assert.WorkoutExerciseGroups.AnyAsync(x => x.WorkoutId == workoutId));
        Assert.False(await assert.WorkoutExercises.AnyAsync());
        Assert.False(await assert.ExerciseSets.AnyAsync());
        Assert.True(await assert.Exercises.AnyAsync(x => x.Id == exerciseId));
    }

    // Триене на ползвано упражнение хвърля DbUpdateException
    [Fact]
    public async Task DeletingExerciseReferencedByWorkout_ThrowsDbUpdateException()
    {
        using var db = new SqliteTestDatabase();
        var exerciseId = SeedExercise(db);

        await using (var arrange = db.CreateContext())
        {
            arrange.Workouts.Add(BuildWorkout(exerciseId));
            await arrange.SaveChangesAsync();
        }

        await using var act = db.CreateContext();
        var exercise = await act.Exercises.SingleAsync(x => x.Id == exerciseId);
        act.Exercises.Remove(exercise);

        await Assert.ThrowsAsync<DbUpdateException>(() => act.SaveChangesAsync());
    }

    // Навигацията на токена зарежда свързания потребител
    [Fact]
    public async Task Token_UserNavigation_LoadsRelatedUser()
    {
        using var db = new SqliteTestDatabase();

        long tokenId;
        await using (var arrange = db.CreateContext())
        {
            var token = new Token
            {
                UserId = SqliteTestDatabase.UserId,
                Value = "token-value",
                ExpiresAtUtc = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            };
            arrange.Tokens.Add(token);
            await arrange.SaveChangesAsync();
            tokenId = token.Id;
        }

        await using var assert = db.CreateContext();
        var loaded = await assert.Tokens
            .Include(x => x.User)
            .SingleAsync(x => x.Id == tokenId);

        Assert.NotNull(loaded.User);
        Assert.Equal("user@test.local", loaded.User.Email);
    }
}
