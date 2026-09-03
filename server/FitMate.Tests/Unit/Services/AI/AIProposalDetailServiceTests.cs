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

public class AIProposalDetailServiceTests
{
    private static AIActionService CreateActionService(AppDbContext context)
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

    private static CreateAIActionRequest ProposalWithNewExercise(long conversationId, long knownExerciseId) => new()
    {
        ConversationId = conversationId,
        AIRunId = 3,
        ActionType = AIActionType.CreateWorkout,
        PayloadJson = AIJsonSerializer.Serialize(new ProposeWorkoutPayload
        {
            Title = "Push day",
            Notes = "Keep the elbows tucked.",
            Exercises =
            [
                new ProposedExercise
                {
                    ExerciseId = knownExerciseId,
                    Sets = [new ProposedSet { SetType = ExerciseSetType.Working, Reps = 6, WeightKg = 80, Rpe = 8 }],
                },
                new ProposedExercise
                {
                    NewExerciseClientKey = "standing-cable-row",
                    Sets = [new ProposedSet { SetType = ExerciseSetType.Warmup, Reps = 12 }],
                },
            ],
            NewExercises =
            [
                new ProposedNewExercise
                {
                    ClientKey = "standing-cable-row",
                    Name = "Standing cable row",
                    PrimaryMuscleGroupId = SqliteTestDatabase.BackId,
                    Equipment = ExerciseEquipment.Cable,
                },
            ],
        }),
    };

    // Неподтвърдено предложение показва и упражнението, което още не съществува
    [Fact]
    public async Task GetAsync_PendingProposal_ShowsProposedExerciseAsNew()
    {
        using var db = new SqliteTestDatabase();
        var conversationId = await SeedConversationAsync(db);
        var knownId = await SeedExerciseAsync(db, "bench-press");

        await using var context = db.CreateContext();
        var actionService = CreateActionService(context);
        var detailService = new AIProposalDetailService(context, new FakePhotoUrlResolver());

        var action = await actionService.CreatePendingAsync(
            ProposalWithNewExercise(conversationId, knownId), SqliteTestDatabase.UserId);

        var detail = await detailService.GetAsync(action.Id, SqliteTestDatabase.UserId);

        Assert.NotNull(detail);
        Assert.Equal("Push day", detail.Title);
        Assert.Equal("Keep the elbows tucked.", detail.Notes);
        Assert.True(detail.EstimatedDurationMinutes > 0);
        Assert.Equal(2, detail.Exercises.Count);

        var known = detail.Exercises[0];
        Assert.False(known.IsNew);
        Assert.Equal("bench-press", known.Name);
        Assert.Equal("Chest", known.PrimaryMuscleGroupName);
        var set = Assert.Single(known.Sets);
        Assert.Equal(6, set.Reps);
        Assert.Equal(80m, set.WeightKg);
        Assert.Equal(8m, set.Rpe);

        var proposed = detail.Exercises[1];
        Assert.True(proposed.IsNew);
        Assert.Equal("Standing cable row", proposed.Name);
        Assert.Equal(ExerciseEquipment.Cable, proposed.Equipment);
    }

    // След потвърждаване детайлът чете вече създаденото упражнение, не клиентския ключ
    [Fact]
    public async Task GetAsync_AfterConfirmation_ResolvesTheExerciseTheProposalCreated()
    {
        using var db = new SqliteTestDatabase();
        var conversationId = await SeedConversationAsync(db);
        var knownId = await SeedExerciseAsync(db, "bench-press");
        long actionId;

        await using (var context = db.CreateContext())
        {
            var actionService = CreateActionService(context);
            var action = await actionService.CreatePendingAsync(
                ProposalWithNewExercise(conversationId, knownId), SqliteTestDatabase.UserId);
            actionId = action.Id;

            await actionService.ConfirmAsync(actionId, SqliteTestDatabase.UserId);
        }

        await using var assert = db.CreateContext();
        var detailService = new AIProposalDetailService(assert, new FakePhotoUrlResolver());
        var detail = await detailService.GetAsync(actionId, SqliteTestDatabase.UserId);

        Assert.NotNull(detail);
        Assert.Equal(AIActionStatus.Executed, detail.Status);

        var created = detail.Exercises[1];
        Assert.False(created.IsNew);
        Assert.Equal("Standing cable row", created.Name);
        Assert.True(created.ExerciseId > 0);

        var storedExercise = await assert.Exercises.SingleAsync(x => x.Id == created.ExerciseId);
        Assert.Equal(SqliteTestDatabase.UserId, storedExercise.UserId);
    }

    // Предложение без упражнения (напр. ново упражнение) няма какво да покаже
    [Fact]
    public async Task GetAsync_ProposalWithoutExercises_ReturnsAnEmptyDetail()
    {
        using var db = new SqliteTestDatabase();
        var conversationId = await SeedConversationAsync(db);

        await using var context = db.CreateContext();
        var actionService = CreateActionService(context);
        var detailService = new AIProposalDetailService(context, new FakePhotoUrlResolver());

        var action = await actionService.CreatePendingAsync(
            new CreateAIActionRequest
            {
                ConversationId = conversationId,
                AIRunId = 1,
                ActionType = AIActionType.CreatePersonalExercise,
                PayloadJson = AIJsonSerializer.Serialize(new ProposeExercisePayload
                {
                    Name = "Standing cable row",
                    PrimaryMuscleGroupId = SqliteTestDatabase.BackId,
                }),
            },
            SqliteTestDatabase.UserId);

        var detail = await detailService.GetAsync(action.Id, SqliteTestDatabase.UserId);

        Assert.NotNull(detail);
        Assert.Empty(detail.Exercises);
    }

    // Чуждо предложение не се чете
    [Fact]
    public async Task GetAsync_ProposalOfAnotherUser_ReturnsNull()
    {
        using var db = new SqliteTestDatabase();
        var conversationId = await SeedConversationAsync(db);
        var knownId = await SeedExerciseAsync(db, "bench-press");

        await using var context = db.CreateContext();
        var actionService = CreateActionService(context);
        var detailService = new AIProposalDetailService(context, new FakePhotoUrlResolver());

        var action = await actionService.CreatePendingAsync(
            ProposalWithNewExercise(conversationId, knownId), SqliteTestDatabase.UserId);

        Assert.Null(await detailService.GetAsync(action.Id, SqliteTestDatabase.OtherUserId));
    }
}
