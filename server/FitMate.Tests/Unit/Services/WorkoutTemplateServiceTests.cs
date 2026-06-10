using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.WorkoutTemplates;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.WorkoutTemplates;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Tests.Unit.Services;

public class WorkoutTemplateServiceTests
{
    private static async Task<long> SeedExerciseAsync(SqliteTestDatabase db, string slug)
    {
        await using var context = db.CreateContext();
        var exercise = new Exercise
        {
            Name = slug,
            Slug = slug,
            IsPublic = true,
            PrimaryMuscleGroupId = SqliteTestDatabase.ChestId,
        };
        context.Exercises.Add(exercise);
        await context.SaveChangesAsync();
        return exercise.Id;
    }

    private static CreateWorkoutTemplateExerciseRequest StraightExercise(
        long exerciseId,
        params CreateWorkoutTemplateExerciseSetRequest[] sets) => new()
    {
        GroupType = ExerciseGroupType.Straight,
        ExerciseId = exerciseId,
        Sets = sets.ToList(),
    };

    private static CreateWorkoutTemplateExerciseSetRequest WorkingSet(decimal? weightKg, int? reps) => new()
    {
        SetType = ExerciseSetType.Working,
        WeightKg = weightKg,
        Reps = reps,
    };

    // Връща собствените и чуждите публични шаблони
    [Fact]
    public async Task ListAsync_ReturnsOwnAndPublicTemplates()
    {
        using var db = new SqliteTestDatabase();
        var exerciseId = await SeedExerciseAsync(db, "list-mix");

        await using (var arrange = db.CreateContext())
        {
            arrange.WorkoutTemplates.AddRange(
                new WorkoutTemplate
                {
                    UserId = SqliteTestDatabase.UserId,
                    Name = "Own Private",
                    IsPublic = false,
                },
                new WorkoutTemplate
                {
                    UserId = SqliteTestDatabase.OtherUserId,
                    Name = "Other Public",
                    IsPublic = true,
                });
            await arrange.SaveChangesAsync();
        }

        var service = new WorkoutTemplateService(db.CreateContext(), new FakePhotoUrlResolver());
        var result = await service.ListAsync(SqliteTestDatabase.UserId);

        Assert.Equal(2, result.Count);
        Assert.Contains(result, x => x.Name == "Own Private");
        Assert.Contains(result, x => x.Name == "Other Public");
    }

    // Чуждите частни шаблони не се връщат
    [Fact]
    public async Task ListAsync_DoesNotReturnOtherUsersPrivateTemplates()
    {
        using var db = new SqliteTestDatabase();

        await using (var arrange = db.CreateContext())
        {
            arrange.WorkoutTemplates.Add(new WorkoutTemplate
            {
                UserId = SqliteTestDatabase.OtherUserId,
                Name = "Other Private",
                IsPublic = false,
            });
            await arrange.SaveChangesAsync();
        }

        var service = new WorkoutTemplateService(db.CreateContext(), new FakePhotoUrlResolver());
        var result = await service.ListAsync(SqliteTestDatabase.UserId);

        Assert.Empty(result);
    }

    // Публичен шаблон е достъпен за всеки потребител
    [Fact]
    public async Task GetByIdAsync_PublicTemplate_ReturnsForAnyUser()
    {
        using var db = new SqliteTestDatabase();
        long templateId;

        await using (var arrange = db.CreateContext())
        {
            var template = new WorkoutTemplate
            {
                UserId = SqliteTestDatabase.OtherUserId,
                Name = "Shared Public",
                IsPublic = true,
            };
            arrange.WorkoutTemplates.Add(template);
            await arrange.SaveChangesAsync();
            templateId = template.Id;
        }

        var service = new WorkoutTemplateService(db.CreateContext(), new FakePhotoUrlResolver());
        var result = await service.GetByIdAsync(templateId, SqliteTestDatabase.UserId);

        Assert.NotNull(result);
        Assert.Equal("Shared Public", result!.Name);
    }

    // Чужд частен шаблон връща null
    [Fact]
    public async Task GetByIdAsync_OtherUsersPrivateTemplate_ReturnsNull()
    {
        using var db = new SqliteTestDatabase();
        long templateId;

        await using (var arrange = db.CreateContext())
        {
            var template = new WorkoutTemplate
            {
                UserId = SqliteTestDatabase.OtherUserId,
                Name = "Other Private",
                IsPublic = false,
            };
            arrange.WorkoutTemplates.Add(template);
            await arrange.SaveChangesAsync();
            templateId = template.Id;
        }

        var service = new WorkoutTemplateService(db.CreateContext(), new FakePhotoUrlResolver());
        var result = await service.GetByIdAsync(templateId, SqliteTestDatabase.UserId);

        Assert.Null(result);
    }

    // Невалиден потребител хвърля "Unauthorized."
    [Fact]
    public async Task ListAsync_InvalidUserId_Throws()
    {
        using var db = new SqliteTestDatabase();
        var service = new WorkoutTemplateService(db.CreateContext(), new FakePhotoUrlResolver());

        var ex = await Assert.ThrowsAsync<FitMateException>(() => service.ListAsync(0));
        Assert.Equal("Unauthorized.", ex.Message);
    }

    // Записва групи, упражнения и серии
    [Fact]
    public async Task CreateAsync_ValidTemplate_PersistsGroupsExercisesSets()
    {
        using var db = new SqliteTestDatabase();
        var exerciseId = await SeedExerciseAsync(db, "bench-press");

        var request = new CreateWorkoutTemplateRequest
        {
            Name = "Push Day",
            Exercises =
            [
                StraightExercise(
                    exerciseId,
                    WorkingSet(60m, 10),
                    WorkingSet(60m, 8)),
            ],
        };

        var service = new WorkoutTemplateService(db.CreateContext(), new FakePhotoUrlResolver());
        var result = await service.CreateAsync(request, SqliteTestDatabase.UserId);

        Assert.Equal(1, result.ExerciseCount);
        Assert.Equal(2, result.SetCount);

        await using var assert = db.CreateContext();
        var stored = await assert.WorkoutTemplates
            .Include(x => x.ExerciseGroups)
                .ThenInclude(x => x.Exercises)
                    .ThenInclude(x => x.Sets)
            .SingleAsync(x => x.Id == result.Id);

        Assert.Single(stored.ExerciseGroups);
        var group = stored.ExerciseGroups.Single();
        Assert.Equal(ExerciseGroupType.Straight, group.GroupType);
        var exercise = Assert.Single(group.Exercises);
        Assert.Equal(exerciseId, exercise.ExerciseId);
        Assert.Equal(2, exercise.Sets.Count);
    }

    // Празно име хвърля грешка за задължително име
    [Fact]
    public async Task CreateAsync_EmptyName_Throws()
    {
        using var db = new SqliteTestDatabase();
        var exerciseId = await SeedExerciseAsync(db, "empty-name");

        var request = new CreateWorkoutTemplateRequest
        {
            Name = "   ",
            Exercises = [StraightExercise(exerciseId, WorkingSet(40m, 5))],
        };

        var service = new WorkoutTemplateService(db.CreateContext(), new FakePhotoUrlResolver());

        var ex = await Assert.ThrowsAsync<FitMateException>(
            () => service.CreateAsync(request, SqliteTestDatabase.UserId));
        Assert.Equal("Template name is required.", ex.Message);
    }

    // Изисква поне едно упражнение
    [Fact]
    public async Task CreateAsync_NoExercises_Throws()
    {
        using var db = new SqliteTestDatabase();

        var request = new CreateWorkoutTemplateRequest
        {
            Name = "No Exercises",
            Exercises = [],
        };

        var service = new WorkoutTemplateService(db.CreateContext(), new FakePhotoUrlResolver());

        var ex = await Assert.ThrowsAsync<FitMateException>(
            () => service.CreateAsync(request, SqliteTestDatabase.UserId));
        Assert.Equal("At least one template exercise is required.", ex.Message);
    }

    // Повтарящи се упражнения не се позволяват
    [Fact]
    public async Task CreateAsync_DuplicateExercises_Throws()
    {
        using var db = new SqliteTestDatabase();
        var exerciseId = await SeedExerciseAsync(db, "dup");

        var request = new CreateWorkoutTemplateRequest
        {
            Name = "Duplicates",
            Exercises =
            [
                StraightExercise(exerciseId, WorkingSet(50m, 10)),
                StraightExercise(exerciseId, WorkingSet(50m, 10)),
            ],
        };

        var service = new WorkoutTemplateService(db.CreateContext(), new FakePhotoUrlResolver());

        var ex = await Assert.ThrowsAsync<FitMateException>(
            () => service.CreateAsync(request, SqliteTestDatabase.UserId));
        Assert.Equal("Duplicate exercises are not supported in one template.", ex.Message);
    }

    // Продължителност над 600 минути хвърля грешка
    [Fact]
    public async Task CreateAsync_EstimatedDurationTooLong_Throws()
    {
        using var db = new SqliteTestDatabase();
        var exerciseId = await SeedExerciseAsync(db, "too-long");

        var request = new CreateWorkoutTemplateRequest
        {
            Name = "Too Long",
            EstimatedDurationMinutes = 601,
            Exercises = [StraightExercise(exerciseId, WorkingSet(50m, 10))],
        };

        var service = new WorkoutTemplateService(db.CreateContext(), new FakePhotoUrlResolver());

        var ex = await Assert.ThrowsAsync<FitMateException>(
            () => service.CreateAsync(request, SqliteTestDatabase.UserId));
        Assert.Equal("Estimated duration cannot exceed 600 minutes.", ex.Message);
    }

    // Създава шаблон от тренировка с метрични серии
    [Fact]
    public async Task CreateFromWorkoutAsync_WorkoutWithMetricSets_CreatesTemplate()
    {
        using var db = new SqliteTestDatabase();
        var exerciseId = await SeedExerciseAsync(db, "from-workout");
        long workoutId;

        await using (var arrange = db.CreateContext())
        {
            var workout = new Workout
            {
                UserId = SqliteTestDatabase.UserId,
                Title = "Leg Day",
                StartedAt = DateTime.UtcNow,
                ExerciseGroups =
                [
                    new WorkoutExerciseGroup
                    {
                        SortOrder = 1,
                        GroupType = ExerciseGroupType.Straight,
                        Exercises =
                        [
                            new WorkoutExercise
                            {
                                ExerciseId = exerciseId,
                                OrderIndex = 1,
                                Sets =
                                [
                                    new ExerciseSet
                                    {
                                        OrderIndex = 1,
                                        SetType = ExerciseSetType.Working,
                                        WeightKg = 80m,
                                        Reps = 5,
                                        IsCompleted = true,
                                    },
                                ],
                            },
                        ],
                    },
                ],
            };
            arrange.Workouts.Add(workout);
            await arrange.SaveChangesAsync();
            workoutId = workout.Id;
        }

        var service = new WorkoutTemplateService(db.CreateContext(), new FakePhotoUrlResolver());
        var result = await service.CreateFromWorkoutAsync(
            workoutId,
            new CreateTemplateFromWorkoutRequest(),
            SqliteTestDatabase.UserId);

        Assert.True(result.ExerciseCount >= 1);
        Assert.Equal("Leg Day", result.Name);
    }

    // Тренировка без записани стойности хвърля грешка
    [Fact]
    public async Task CreateFromWorkoutAsync_WorkoutWithNoMetricSets_Throws()
    {
        using var db = new SqliteTestDatabase();
        var exerciseId = await SeedExerciseAsync(db, "no-metric");
        long workoutId;

        await using (var arrange = db.CreateContext())
        {
            var workout = new Workout
            {
                UserId = SqliteTestDatabase.UserId,
                Title = "Empty",
                StartedAt = DateTime.UtcNow,
                ExerciseGroups =
                [
                    new WorkoutExerciseGroup
                    {
                        SortOrder = 1,
                        GroupType = ExerciseGroupType.Straight,
                        Exercises =
                        [
                            new WorkoutExercise
                            {
                                ExerciseId = exerciseId,
                                OrderIndex = 1,
                                Sets =
                                [
                                    new ExerciseSet
                                    {
                                        OrderIndex = 1,
                                        SetType = ExerciseSetType.Working,
                                        IsCompleted = true,
                                    },
                                ],
                            },
                        ],
                    },
                ],
            };
            arrange.Workouts.Add(workout);
            await arrange.SaveChangesAsync();
            workoutId = workout.Id;
        }

        var service = new WorkoutTemplateService(db.CreateContext(), new FakePhotoUrlResolver());

        var ex = await Assert.ThrowsAsync<FitMateException>(
            () => service.CreateFromWorkoutAsync(
                workoutId,
                new CreateTemplateFromWorkoutRequest(),
                SqliteTestDatabase.UserId));
        Assert.Equal("This workout has no sets with logged values to build a template from.", ex.Message);
    }

    // Незавършени серии с метрики също се включват
    [Fact]
    public async Task CreateFromWorkoutAsync_IncludesUncompletedSetsThatHaveMetrics()
    {
        using var db = new SqliteTestDatabase();
        var exerciseId = await SeedExerciseAsync(db, "uncompleted-metric");
        long workoutId;

        await using (var arrange = db.CreateContext())
        {
            var workout = new Workout
            {
                UserId = SqliteTestDatabase.UserId,
                Title = "Uncompleted",
                StartedAt = DateTime.UtcNow,
                ExerciseGroups =
                [
                    new WorkoutExerciseGroup
                    {
                        SortOrder = 1,
                        GroupType = ExerciseGroupType.Straight,
                        Exercises =
                        [
                            new WorkoutExercise
                            {
                                ExerciseId = exerciseId,
                                OrderIndex = 1,
                                Sets =
                                [
                                    new ExerciseSet
                                    {
                                        OrderIndex = 1,
                                        SetType = ExerciseSetType.Working,
                                        WeightKg = 70m,
                                        Reps = 8,
                                        IsCompleted = false,
                                    },
                                ],
                            },
                        ],
                    },
                ],
            };
            arrange.Workouts.Add(workout);
            await arrange.SaveChangesAsync();
            workoutId = workout.Id;
        }

        var service = new WorkoutTemplateService(db.CreateContext(), new FakePhotoUrlResolver());
        var result = await service.CreateFromWorkoutAsync(
            workoutId,
            new CreateTemplateFromWorkoutRequest(),
            SqliteTestDatabase.UserId);

        Assert.Equal(1, result.ExerciseCount);
        Assert.Equal(1, result.SetCount);

        await using var assert = db.CreateContext();
        var stored = await assert.WorkoutTemplates
            .Include(x => x.ExerciseGroups)
                .ThenInclude(x => x.Exercises)
            .SingleAsync(x => x.Id == result.Id);
        var group = Assert.Single(stored.ExerciseGroups);
        var exercise = Assert.Single(group.Exercises);
        Assert.Equal(exerciseId, exercise.ExerciseId);
    }

    // Чужда тренировка хвърля "Workout not found."
    [Fact]
    public async Task CreateFromWorkoutAsync_OtherUsersWorkout_Throws()
    {
        using var db = new SqliteTestDatabase();
        var exerciseId = await SeedExerciseAsync(db, "other-workout");
        long workoutId;

        await using (var arrange = db.CreateContext())
        {
            var workout = new Workout
            {
                UserId = SqliteTestDatabase.OtherUserId,
                Title = "Not Yours",
                StartedAt = DateTime.UtcNow,
                ExerciseGroups =
                [
                    new WorkoutExerciseGroup
                    {
                        SortOrder = 1,
                        GroupType = ExerciseGroupType.Straight,
                        Exercises =
                        [
                            new WorkoutExercise
                            {
                                ExerciseId = exerciseId,
                                OrderIndex = 1,
                                Sets =
                                [
                                    new ExerciseSet
                                    {
                                        OrderIndex = 1,
                                        SetType = ExerciseSetType.Working,
                                        WeightKg = 50m,
                                        Reps = 5,
                                        IsCompleted = true,
                                    },
                                ],
                            },
                        ],
                    },
                ],
            };
            arrange.Workouts.Add(workout);
            await arrange.SaveChangesAsync();
            workoutId = workout.Id;
        }

        var service = new WorkoutTemplateService(db.CreateContext(), new FakePhotoUrlResolver());

        var ex = await Assert.ThrowsAsync<FitMateException>(
            () => service.CreateFromWorkoutAsync(
                workoutId,
                new CreateTemplateFromWorkoutRequest(),
                SqliteTestDatabase.UserId));
        Assert.Equal("Workout not found.", ex.Message);
    }

    // Чужд шаблон не може да се редактира
    [Fact]
    public async Task UpdateAsync_OtherUsersTemplate_ThrowsNotFound()
    {
        using var db = new SqliteTestDatabase();
        var exerciseId = await SeedExerciseAsync(db, "update-other");
        long templateId;

        await using (var arrange = db.CreateContext())
        {
            var template = new WorkoutTemplate
            {
                UserId = SqliteTestDatabase.OtherUserId,
                Name = "Other Template",
            };
            arrange.WorkoutTemplates.Add(template);
            await arrange.SaveChangesAsync();
            templateId = template.Id;
        }

        var request = new CreateWorkoutTemplateRequest
        {
            Name = "Hijack",
            Exercises = [StraightExercise(exerciseId, WorkingSet(50m, 10))],
        };

        var service = new WorkoutTemplateService(db.CreateContext(), new FakePhotoUrlResolver());

        var ex = await Assert.ThrowsAsync<FitMateException>(
            () => service.UpdateAsync(templateId, request, SqliteTestDatabase.UserId));
        Assert.Equal("Template not found.", ex.Message);
    }

    // Обновяването подменя изцяло съдържанието на шаблона
    [Fact]
    public async Task UpdateAsync_OwnTemplate_ReplacesContents()
    {
        using var db = new SqliteTestDatabase();
        var firstExerciseId = await SeedExerciseAsync(db, "update-first");
        var secondExerciseId = await SeedExerciseAsync(db, "update-second");

        var createService = new WorkoutTemplateService(db.CreateContext(), new FakePhotoUrlResolver());
        var created = await createService.CreateAsync(
            new CreateWorkoutTemplateRequest
            {
                Name = "Original",
                Exercises = [StraightExercise(firstExerciseId, WorkingSet(40m, 12))],
            },
            SqliteTestDatabase.UserId);

        var updateRequest = new CreateWorkoutTemplateRequest
        {
            Name = "Updated",
            Exercises =
            [
                StraightExercise(
                    secondExerciseId,
                    WorkingSet(80m, 5),
                    WorkingSet(80m, 5),
                    WorkingSet(80m, 5)),
            ],
        };

        var updateService = new WorkoutTemplateService(db.CreateContext(), new FakePhotoUrlResolver());
        var updated = await updateService.UpdateAsync(
            created.Id,
            updateRequest,
            SqliteTestDatabase.UserId);

        Assert.Equal("Updated", updated.Name);
        Assert.Equal(1, updated.ExerciseCount);
        Assert.Equal(3, updated.SetCount);

        await using var assert = db.CreateContext();
        var stored = await assert.WorkoutTemplates
            .Include(x => x.ExerciseGroups)
                .ThenInclude(x => x.Exercises)
                    .ThenInclude(x => x.Sets)
            .SingleAsync(x => x.Id == created.Id);

        Assert.Equal("Updated", stored.Name);
        var group = Assert.Single(stored.ExerciseGroups);
        var exercise = Assert.Single(group.Exercises);
        Assert.Equal(secondExerciseId, exercise.ExerciseId);
        Assert.Equal(3, exercise.Sets.Count);

        var totalGroups = await assert.TemplateExerciseGroups
            .CountAsync(x => x.WorkoutTemplateId == created.Id);
        Assert.Equal(1, totalGroups);
    }

    // Изтриване на собствен шаблон връща true
    [Fact]
    public async Task DeleteAsync_OwnTemplate_ReturnsTrue()
    {
        using var db = new SqliteTestDatabase();
        long templateId;

        await using (var arrange = db.CreateContext())
        {
            var template = new WorkoutTemplate
            {
                UserId = SqliteTestDatabase.UserId,
                Name = "To Delete",
            };
            arrange.WorkoutTemplates.Add(template);
            await arrange.SaveChangesAsync();
            templateId = template.Id;
        }

        var service = new WorkoutTemplateService(db.CreateContext(), new FakePhotoUrlResolver());
        var result = await service.DeleteAsync(templateId, SqliteTestDatabase.UserId);

        Assert.True(result);

        await using var assert = db.CreateContext();
        Assert.False(await assert.WorkoutTemplates.AnyAsync(x => x.Id == templateId));
    }

    // Чужд шаблон не може да се изтрие
    [Fact]
    public async Task DeleteAsync_OtherUsersTemplate_ThrowsNotFound()
    {
        using var db = new SqliteTestDatabase();
        long templateId;

        await using (var arrange = db.CreateContext())
        {
            var template = new WorkoutTemplate
            {
                UserId = SqliteTestDatabase.OtherUserId,
                Name = "Other Template",
            };
            arrange.WorkoutTemplates.Add(template);
            await arrange.SaveChangesAsync();
            templateId = template.Id;
        }

        var service = new WorkoutTemplateService(db.CreateContext(), new FakePhotoUrlResolver());

        var ex = await Assert.ThrowsAsync<FitMateException>(
            () => service.DeleteAsync(templateId, SqliteTestDatabase.UserId));
        Assert.Equal("Template not found.", ex.Message);
    }

    // Невалидно id хвърля грешка за невалиден шаблон
    [Fact]
    public async Task DeleteAsync_InvalidId_Throws()
    {
        using var db = new SqliteTestDatabase();
        var service = new WorkoutTemplateService(db.CreateContext(), new FakePhotoUrlResolver());

        var ex = await Assert.ThrowsAsync<FitMateException>(
            () => service.DeleteAsync(0, SqliteTestDatabase.UserId));
        Assert.Equal("Template id is invalid.", ex.Message);
    }
}
