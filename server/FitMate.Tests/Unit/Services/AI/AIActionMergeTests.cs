using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.AIActions;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Integrations.AI.Serialization;
using FitMate.Services.AIActions;
using FitMate.Services.AIActions.Executors;
using FitMate.Services.Exercises;
using FitMate.Services.Workouts;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace FitMate.Tests.Unit.Services.AI;

/// <summary>
/// Adding a suggestion to a session that is already running. The exercises are handed back to the
/// caller rather than written to the workout, because the builder's autosave replaces the whole
/// workout from its own draft and would erase a server-side append.
/// </summary>
public class AIActionMergeTests
{
    private static AIActionService CreateService(AppDbContext context)
    {
        var exerciseService = new ExerciseService(
            context,
            new MemoryCache(new MemoryCacheOptions()),
            FakeUserService.ForUser(SqliteTestDatabase.UserId),
            new FakeBlobStorageService(),
            new FakeImageProcessor(),
            new FakePhotoUrlResolver());

        var workoutService = new WorkoutService(
            context,
            new FakePhotoUrlResolver(),
            new FakeEntitlementService());

        return new AIActionService(
            context,
            exerciseService,
            new AIProposalDetailService(context, new FakePhotoUrlResolver()),
            [new CreateWorkoutActionExecutor(context, workoutService, exerciseService)]);
    }

    private static async Task<long> SeedConversationAsync(SqliteTestDatabase db)
    {
        await using var context = db.CreateContext();
        var conversation = new AIConversation
        {
            UserId = SqliteTestDatabase.UserId,
            Status = AIConversationStatus.Active,
            LastMessageAt = DateTime.UtcNow,
        };
        context.AIConversations.Add(conversation);
        await context.SaveChangesAsync();
        return conversation.Id;
    }

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

    private static async Task<long> SeedWorkoutAsync(SqliteTestDatabase db, DateTime? finishedAt = null)
    {
        await using var context = db.CreateContext();
        var workout = new Workout
        {
            UserId = SqliteTestDatabase.UserId,
            Title = "Back & Biceps",
            StartedAt = DateTime.UtcNow.AddMinutes(-20),
            FinishedAt = finishedAt,
        };
        context.Workouts.Add(workout);
        await context.SaveChangesAsync();
        return workout.Id;
    }

    private static CreateAIActionRequest WorkoutProposal(long conversationId, long exerciseId) => new()
    {
        ConversationId = conversationId,
        AIRunId = 7,
        ActionType = AIActionType.CreateWorkout,
        PayloadJson = AIJsonSerializer.Serialize(new ProposeWorkoutPayload
        {
            Title = "Chest finisher",
            Exercises =
            [
                new ProposedExercise
                {
                    ExerciseId = exerciseId,
                    Sets =
                    [
                        new ProposedSet { SetType = ExerciseSetType.Working, Reps = 10, WeightKg = 40 },
                        new ProposedSet { SetType = ExerciseSetType.Working, Reps = 8, WeightKg = 45 },
                    ],
                },
            ],
        }),
    };

    // Сливането маркира предложението изпълнено срещу текущата тренировка и връща упражненията
    [Fact]
    public async Task MergeIntoWorkoutAsync_RunningSession_ExecutesAgainstItAndReturnsExercises()
    {
        using var db = new SqliteTestDatabase();
        var conversationId = await SeedConversationAsync(db);
        var exerciseId = await SeedExerciseAsync(db, "cable-fly");
        var workoutId = await SeedWorkoutAsync(db);

        await using var context = db.CreateContext();
        var service = CreateService(context);
        var action = await service.CreatePendingAsync(
            WorkoutProposal(conversationId, exerciseId), SqliteTestDatabase.UserId);

        var merged = await service.MergeIntoWorkoutAsync(
            action.Id, SqliteTestDatabase.UserId, workoutId);

        Assert.Equal(AIActionStatus.Executed, merged.Action.Status);
        Assert.Equal(workoutId, merged.Action.Result?.CreatedEntityId);
        Assert.Equal("workouts", merged.Action.Result?.EntityKind);

        var exercise = Assert.Single(merged.Detail.Exercises);
        Assert.Equal(exerciseId, exercise.ExerciseId);
        Assert.Equal("cable-fly", exercise.Name);
        Assert.Equal([10, 8], exercise.Sets.Select(set => set.Reps));
        Assert.Equal([40m, 45m], exercise.Sets.Select(set => set.WeightKg));
    }

    // Сливането не създава втора тренировка
    [Fact]
    public async Task MergeIntoWorkoutAsync_RunningSession_DoesNotCreateASecondWorkout()
    {
        using var db = new SqliteTestDatabase();
        var conversationId = await SeedConversationAsync(db);
        var exerciseId = await SeedExerciseAsync(db, "cable-fly");
        var workoutId = await SeedWorkoutAsync(db);

        await using (var context = db.CreateContext())
        {
            var service = CreateService(context);
            var action = await service.CreatePendingAsync(
                WorkoutProposal(conversationId, exerciseId), SqliteTestDatabase.UserId);

            await service.MergeIntoWorkoutAsync(action.Id, SqliteTestDatabase.UserId, workoutId);
        }

        await using var assert = db.CreateContext();
        var stored = Assert.Single(await assert.Workouts.ToListAsync());
        Assert.Equal(workoutId, stored.Id);
    }

    // Приключена тренировка не приема предложение
    [Fact]
    public async Task MergeIntoWorkoutAsync_FinishedWorkout_Throws()
    {
        using var db = new SqliteTestDatabase();
        var conversationId = await SeedConversationAsync(db);
        var exerciseId = await SeedExerciseAsync(db, "cable-fly");
        var workoutId = await SeedWorkoutAsync(db, finishedAt: DateTime.UtcNow);

        await using var context = db.CreateContext();
        var service = CreateService(context);
        var action = await service.CreatePendingAsync(
            WorkoutProposal(conversationId, exerciseId), SqliteTestDatabase.UserId);

        var ex = await Assert.ThrowsAsync<FitMateException>(
            () => service.MergeIntoWorkoutAsync(action.Id, SqliteTestDatabase.UserId, workoutId));

        Assert.Equal("That workout is already finished.", ex.Message);

        await using var assert = db.CreateContext();
        var stored = await assert.AIActions.SingleAsync(x => x.Id == action.Id);
        Assert.Equal(AIActionStatus.PendingConfirmation, stored.Status);
    }

    // Чужда тренировка не се намира
    [Fact]
    public async Task MergeIntoWorkoutAsync_WorkoutOfAnotherUser_Throws()
    {
        using var db = new SqliteTestDatabase();
        var conversationId = await SeedConversationAsync(db);
        var exerciseId = await SeedExerciseAsync(db, "cable-fly");
        var workoutId = await SeedWorkoutAsync(db);

        await using var context = db.CreateContext();
        var service = CreateService(context);
        var action = await service.CreatePendingAsync(
            WorkoutProposal(conversationId, exerciseId), SqliteTestDatabase.UserId);

        var ex = await Assert.ThrowsAsync<FitMateException>(
            () => service.MergeIntoWorkoutAsync(action.Id, SqliteTestDatabase.OtherUserId, workoutId));

        Assert.Equal("Suggestion not found.", ex.Message);
    }
}
