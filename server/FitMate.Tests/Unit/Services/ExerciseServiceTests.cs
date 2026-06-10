using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.Exercises;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.Services.Exercises;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace FitMate.Tests.Unit.Services;

public class ExerciseServiceTests
{
    private static ExerciseService BuildService(AppDbContext context, FakeUserService userService)
    {
        return new ExerciseService(
            context,
            new MemoryCache(new MemoryCacheOptions()),
            userService,
            new FakeBlobStorageService(),
            new FakeImageProcessor(),
            new FakePhotoUrlResolver());
    }

    private static CreateExerciseRequest NewRequest(
        string name = "Bench Press",
        long primary = SqliteTestDatabase.ChestId,
        long? secondary = null,
        bool isPublic = true)
    {
        return new CreateExerciseRequest
        {
            Name = name,
            PrimaryMuscleGroupId = primary,
            SecondaryMuscleGroupId = secondary,
            IsPublic = isPublic,
        };
    }

    // Потребител създава упражнение със своя UserId и зададена видимост
    [Fact]
    public async Task CreateAsync_UserCreatesExercise_AssignsUserIdAndKeepsRequestVisibility()
    {
        using var db = new SqliteTestDatabase();

        ExerciseModel created;
        using (var context = db.CreateContext())
        {
            var service = BuildService(context, FakeUserService.ForUser(SqliteTestDatabase.UserId));
            created = await service.CreateAsync(NewRequest(isPublic: false));
        }

        using var assert = db.CreateContext();
        var stored = await assert.Exercises.SingleAsync(x => x.Id == created.Id);
        Assert.Equal(SqliteTestDatabase.UserId, stored.UserId);
        Assert.False(stored.IsPublic);
    }

    // Admin създава глобално публично упражнение без собственик
    [Fact]
    public async Task CreateAsync_AdminCreatesExercise_CreatesGlobalPublicExercise()
    {
        using var db = new SqliteTestDatabase();

        ExerciseModel created;
        using (var context = db.CreateContext())
        {
            var service = BuildService(context, FakeUserService.ForAdmin(SqliteTestDatabase.AdminUserId));
            created = await service.CreateAsync(NewRequest(isPublic: false));
        }

        using var assert = db.CreateContext();
        var stored = await assert.Exercises.SingleAsync(x => x.Id == created.Id);
        Assert.Null(stored.UserId);
        Assert.True(stored.IsPublic);
    }

    // Без логнат потребител хвърля Unauthorized
    [Fact]
    public async Task CreateAsync_NoLoggedInUser_ThrowsUnauthorized()
    {
        using var db = new SqliteTestDatabase();
        using var context = db.CreateContext();
        var service = BuildService(context, new FakeUserService { LoggedInUserId = null });

        var ex = await Assert.ThrowsAsync<FitMateException>(() => service.CreateAsync(NewRequest()));
        Assert.Equal("Unauthorized.", ex.Message);
    }

    // Празно име хвърля грешка че името е задължително
    [Fact]
    public async Task CreateAsync_EmptyName_Throws()
    {
        using var db = new SqliteTestDatabase();
        using var context = db.CreateContext();
        var service = BuildService(context, FakeUserService.ForUser(SqliteTestDatabase.UserId));

        var ex = await Assert.ThrowsAsync<FitMateException>(() => service.CreateAsync(NewRequest(name: "")));
        Assert.Equal("Name is required.", ex.Message);
    }

    // Липсваща основна мускулна група хвърля грешка
    [Fact]
    public async Task CreateAsync_PrimaryMuscleGroupIdZero_Throws()
    {
        using var db = new SqliteTestDatabase();
        using var context = db.CreateContext();
        var service = BuildService(context, FakeUserService.ForUser(SqliteTestDatabase.UserId));

        var ex = await Assert.ThrowsAsync<FitMateException>(() => service.CreateAsync(NewRequest(primary: 0)));
        Assert.Equal("Primary muscle group id is required.", ex.Message);
    }

    // Несъществуваща основна мускулна група хвърля грешка
    [Fact]
    public async Task CreateAsync_NonExistentPrimaryMuscleGroup_Throws()
    {
        using var db = new SqliteTestDatabase();
        using var context = db.CreateContext();
        var service = BuildService(context, FakeUserService.ForUser(SqliteTestDatabase.UserId));

        var ex = await Assert.ThrowsAsync<FitMateException>(() => service.CreateAsync(NewRequest(primary: 999)));
        Assert.Equal("Primary muscle group does not exist.", ex.Message);
    }

    // Еднаква основна и вторична мускулна група хвърля грешка
    [Fact]
    public async Task CreateAsync_SamePrimaryAndSecondaryMuscleGroup_Throws()
    {
        using var db = new SqliteTestDatabase();
        using var context = db.CreateContext();
        var service = BuildService(context, FakeUserService.ForUser(SqliteTestDatabase.UserId));

        var request = NewRequest(primary: SqliteTestDatabase.ChestId, secondary: SqliteTestDatabase.ChestId);

        var ex = await Assert.ThrowsAsync<FitMateException>(() => service.CreateAsync(request));
        Assert.Equal("Primary and secondary muscle groups must be different.", ex.Message);
    }

    // Дублирано име генерира уникален slug с наставка
    [Fact]
    public async Task CreateAsync_DuplicateName_GeneratesUniqueSlug()
    {
        using var db = new SqliteTestDatabase();

        ExerciseModel first;
        ExerciseModel second;
        using (var context = db.CreateContext())
        {
            var service = BuildService(context, FakeUserService.ForUser(SqliteTestDatabase.UserId));
            first = await service.CreateAsync(NewRequest(name: "Bench Press"));
        }

        using (var context = db.CreateContext())
        {
            var service = BuildService(context, FakeUserService.ForUser(SqliteTestDatabase.UserId));
            second = await service.CreateAsync(NewRequest(name: "Bench Press"));
        }

        using var assert = db.CreateContext();
        var storedFirst = await assert.Exercises.SingleAsync(x => x.Id == first.Id);
        var storedSecond = await assert.Exercises.SingleAsync(x => x.Id == second.Id);
        Assert.Equal("bench-press", storedFirst.Slug);
        Assert.Equal("bench-press-2", storedSecond.Slug);
    }

    // Връща публични и собствени, но скрива чужди частни
    [Fact]
    public async Task GetAllAsync_ReturnsPublicAndOwnExercises_ExcludesOthersPrivate()
    {
        using var db = new SqliteTestDatabase();

        long ownPrivateId;
        long otherPublicId;
        long otherPrivateId;
        using (var context = db.CreateContext())
        {
            var ownPrivate = new Exercise
            {
                UserId = SqliteTestDatabase.UserId,
                IsPublic = false,
                Name = "Own Private",
                Slug = "own-private",
                PrimaryMuscleGroupId = SqliteTestDatabase.ChestId,
            };
            var otherPublic = new Exercise
            {
                UserId = SqliteTestDatabase.OtherUserId,
                IsPublic = true,
                Name = "Other Public",
                Slug = "other-public",
                PrimaryMuscleGroupId = SqliteTestDatabase.BackId,
            };
            var otherPrivate = new Exercise
            {
                UserId = SqliteTestDatabase.OtherUserId,
                IsPublic = false,
                Name = "Other Private",
                Slug = "other-private",
                PrimaryMuscleGroupId = SqliteTestDatabase.LegsId,
            };
            context.Exercises.AddRange(ownPrivate, otherPublic, otherPrivate);
            await context.SaveChangesAsync();
            ownPrivateId = ownPrivate.Id;
            otherPublicId = otherPublic.Id;
            otherPrivateId = otherPrivate.Id;
        }

        using var actContext = db.CreateContext();
        var service = BuildService(actContext, FakeUserService.ForUser(SqliteTestDatabase.UserId));
        var result = await service.GetAllAsync(new ExerciseLookupRequest());

        var ids = result.Select(x => x.Id).ToList();
        Assert.Contains(ownPrivateId, ids);
        Assert.Contains(otherPublicId, ids);
        Assert.DoesNotContain(otherPrivateId, ids);
    }

    // Връща само упражненията на текущия потребител
    [Fact]
    public async Task GetMineAsync_ReturnsOnlyCurrentUsersExercises()
    {
        using var db = new SqliteTestDatabase();

        long ownId;
        long otherId;
        using (var context = db.CreateContext())
        {
            var own = new Exercise
            {
                UserId = SqliteTestDatabase.UserId,
                IsPublic = false,
                Name = "Mine",
                Slug = "mine",
                PrimaryMuscleGroupId = SqliteTestDatabase.ChestId,
            };
            var other = new Exercise
            {
                UserId = SqliteTestDatabase.OtherUserId,
                IsPublic = true,
                Name = "Theirs",
                Slug = "theirs",
                PrimaryMuscleGroupId = SqliteTestDatabase.BackId,
            };
            context.Exercises.AddRange(own, other);
            await context.SaveChangesAsync();
            ownId = own.Id;
            otherId = other.Id;
        }

        using var actContext = db.CreateContext();
        var service = BuildService(actContext, FakeUserService.ForUser(SqliteTestDatabase.UserId));
        var result = await service.GetMineAsync(new ExerciseLookupRequest());

        var ids = result.Select(x => x.Id).ToList();
        Assert.Contains(ownId, ids);
        Assert.DoesNotContain(otherId, ids);
    }

    // Чуждо упражнение не може да се редактира (not found)
    [Fact]
    public async Task UpdateAsync_NonOwnerNonAdmin_ThrowsNotFound()
    {
        using var db = new SqliteTestDatabase();

        long exerciseId;
        using (var context = db.CreateContext())
        {
            var exercise = new Exercise
            {
                UserId = SqliteTestDatabase.OtherUserId,
                IsPublic = false,
                Name = "Theirs",
                Slug = "theirs",
                PrimaryMuscleGroupId = SqliteTestDatabase.ChestId,
            };
            context.Exercises.Add(exercise);
            await context.SaveChangesAsync();
            exerciseId = exercise.Id;
        }

        using var actContext = db.CreateContext();
        var service = BuildService(actContext, FakeUserService.ForUser(SqliteTestDatabase.UserId));

        var ex = await Assert.ThrowsAsync<FitMateException>(() =>
            service.UpdateAsync(exerciseId, NewRequest(name: "Renamed")));
        Assert.Equal("Exercise not found.", ex.Message);
    }

    // Упражнение използвано в тренировка не се трие
    [Fact]
    public async Task DeleteAsync_ExerciseUsedInWorkout_Throws()
    {
        using var db = new SqliteTestDatabase();

        long exerciseId;
        using (var context = db.CreateContext())
        {
            var exercise = new Exercise
            {
                UserId = SqliteTestDatabase.UserId,
                IsPublic = false,
                Name = "Used",
                Slug = "used",
                PrimaryMuscleGroupId = SqliteTestDatabase.ChestId,
            };
            context.Exercises.Add(exercise);
            await context.SaveChangesAsync();
            exerciseId = exercise.Id;

            var workout = new Workout
            {
                UserId = SqliteTestDatabase.UserId,
                Title = "Session",
                StartedAt = DateTime.UtcNow,
                ExerciseGroups = new List<WorkoutExerciseGroup>
                {
                    new()
                    {
                        SortOrder = 0,
                        Exercises = new List<WorkoutExercise>
                        {
                            new() { ExerciseId = exerciseId, OrderIndex = 0 },
                        },
                    },
                },
            };
            context.Workouts.Add(workout);
            await context.SaveChangesAsync();
        }

        using var actContext = db.CreateContext();
        var service = BuildService(actContext, FakeUserService.ForUser(SqliteTestDatabase.UserId));

        var ex = await Assert.ThrowsAsync<FitMateException>(() => service.DeleteAsync(exerciseId));
        Assert.Equal("Exercise is used in other records and cannot be deleted.", ex.Message);
    }

    // Собствено неизползвано упражнение се трие и връща true
    [Fact]
    public async Task DeleteAsync_OwnedUnusedExercise_ReturnsTrueAndRemoves()
    {
        using var db = new SqliteTestDatabase();

        long exerciseId;
        using (var context = db.CreateContext())
        {
            var exercise = new Exercise
            {
                UserId = SqliteTestDatabase.UserId,
                IsPublic = false,
                Name = "Unused",
                Slug = "unused",
                PrimaryMuscleGroupId = SqliteTestDatabase.ChestId,
            };
            context.Exercises.Add(exercise);
            await context.SaveChangesAsync();
            exerciseId = exercise.Id;
        }

        bool result;
        using (var actContext = db.CreateContext())
        {
            var service = BuildService(actContext, FakeUserService.ForUser(SqliteTestDatabase.UserId));
            result = await service.DeleteAsync(exerciseId);
        }

        Assert.True(result);

        using var assert = db.CreateContext();
        var exists = await assert.Exercises.AnyAsync(x => x.Id == exerciseId);
        Assert.False(exists);
    }

    // Не може да качваш снимка на чуждо упражнение
    [Fact]
    public async Task UploadImageAsync_NonOwnerNonAdmin_Throws()
    {
        using var db = new SqliteTestDatabase();

        long exerciseId;
        using (var context = db.CreateContext())
        {
            var exercise = new Exercise
            {
                UserId = SqliteTestDatabase.OtherUserId,
                IsPublic = true,
                Name = "Theirs",
                Slug = "theirs",
                PrimaryMuscleGroupId = SqliteTestDatabase.ChestId,
            };
            context.Exercises.Add(exercise);
            await context.SaveChangesAsync();
            exerciseId = exercise.Id;
        }

        using var actContext = db.CreateContext();
        var service = BuildService(actContext, FakeUserService.ForUser(SqliteTestDatabase.UserId));

        using var content = new MemoryStream([1, 2, 3]);
        var ex = await Assert.ThrowsAsync<FitMateException>(() =>
            service.UploadImageAsync(exerciseId, content, "photo.png"));
        Assert.Equal("You can only change images for your own exercises.", ex.Message);
    }

    // Невалиден файл за снимка хвърля грешка
    [Fact]
    public async Task UploadImageAsync_InvalidImage_Throws()
    {
        using var db = new SqliteTestDatabase();

        long exerciseId;
        using (var context = db.CreateContext())
        {
            var exercise = new Exercise
            {
                UserId = SqliteTestDatabase.UserId,
                IsPublic = false,
                Name = "Mine",
                Slug = "mine",
                PrimaryMuscleGroupId = SqliteTestDatabase.ChestId,
            };
            context.Exercises.Add(exercise);
            await context.SaveChangesAsync();
            exerciseId = exercise.Id;
        }

        using var actContext = db.CreateContext();
        var service = new ExerciseService(
            actContext,
            new MemoryCache(new MemoryCacheOptions()),
            FakeUserService.ForUser(SqliteTestDatabase.UserId),
            new FakeBlobStorageService(),
            new FakeImageProcessor { Result = null },
            new FakePhotoUrlResolver());

        using var content = new MemoryStream([1, 2, 3]);
        var ex = await Assert.ThrowsAsync<FitMateException>(() =>
            service.UploadImageAsync(exerciseId, content, "photo.png"));
        Assert.Equal("The uploaded file is not a valid image.", ex.Message);
    }
}
