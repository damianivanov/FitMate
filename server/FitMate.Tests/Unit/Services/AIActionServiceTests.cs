using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.AIActions;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Integrations.AI.Serialization;
using FitMate.Services.AIActions;
using FitMate.Services.AIActions.Executors;
using FitMate.Services.Exercises;
using FitMate.Services.Subscriptions;
using FitMate.Services.WorkoutTemplates;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace FitMate.Tests.Unit.Services;

public class AIActionServiceTests
{
    private static async Task<long> SeedConversationAsync(SqliteTestDatabase db, long userId)
    {
        await using var context = db.CreateContext();
        var conversation = new AIConversation
        {
            UserId = userId,
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

    private static AIActionService CreateService(AppDbContext context, FakeUserService? userService = null)
    {
        var exerciseService = new ExerciseService(
            context,
            new MemoryCache(new MemoryCacheOptions()),
            userService ?? FakeUserService.ForUser(SqliteTestDatabase.UserId),
            new FakeBlobStorageService(),
            new FakeImageProcessor(),
            new FakePhotoUrlResolver());

        var templateService = new WorkoutTemplateService(
            context,
            new FakePhotoUrlResolver(),
            new FakeEntitlementService());

        return new AIActionService(context, [
            new CreatePersonalExerciseActionExecutor(context, exerciseService),
            new CreateGlobalExerciseActionExecutor(context, exerciseService),
            new CreateWorkoutTemplateActionExecutor(context, templateService, exerciseService),
        ]);
    }

    private static CreateAIActionRequest ExerciseProposal(long conversationId, string name = "Incline cable press") =>
        new()
        {
            ConversationId = conversationId,
            AIRunId = 0,
            ActionType = AIActionType.CreatePersonalExercise,
            PayloadJson = AIJsonSerializer.Serialize(new ProposeExercisePayload
            {
                Name = name,
                PrimaryMuscleGroupId = SqliteTestDatabase.ChestId,
                IsPublic = false,
            }),
            Preview = new AIActionPreviewModel { Title = name },
        };

    // Предложението не създава нищо, докато не бъде потвърдено
    [Fact]
    public async Task CreatePending_DoesNotCreateTheDomainEntity()
    {
        using var db = new SqliteTestDatabase();
        var conversationId = await SeedConversationAsync(db, SqliteTestDatabase.UserId);
        await using var context = db.CreateContext();
        var service = CreateService(context);

        var action = await service.CreatePendingAsync(ExerciseProposal(conversationId), SqliteTestDatabase.UserId);

        Assert.Equal(AIActionStatus.PendingConfirmation, action.Status);
        Assert.NotNull(action.ExpiresAt);
        Assert.Empty(await context.Exercises.Where(x => x.Name == "Incline cable press").ToListAsync());
    }

    // Потвърждаването минава през нормалната услуга и създава упражнението
    [Fact]
    public async Task Confirm_CreatesTheExerciseThroughTheDomainService()
    {
        using var db = new SqliteTestDatabase();
        var conversationId = await SeedConversationAsync(db, SqliteTestDatabase.UserId);
        await using var context = db.CreateContext();
        var service = CreateService(context);
        var action = await service.CreatePendingAsync(ExerciseProposal(conversationId), SqliteTestDatabase.UserId);

        var confirmed = await service.ConfirmAsync(action.Id, SqliteTestDatabase.UserId);

        Assert.Equal(AIActionStatus.Executed, confirmed.Status);
        Assert.NotNull(confirmed.Result);
        Assert.Equal("exercises", confirmed.Result!.EntityKind);

        var created = await context.Exercises.SingleAsync(x => x.Id == confirmed.Result.CreatedEntityId);
        Assert.Equal(SqliteTestDatabase.UserId, created.UserId);
        Assert.False(created.IsPublic);
    }

    // Двойното потвърждаване е идемпотентно: без втори запис
    [Fact]
    public async Task Confirm_Twice_IsIdempotent()
    {
        using var db = new SqliteTestDatabase();
        var conversationId = await SeedConversationAsync(db, SqliteTestDatabase.UserId);
        await using var context = db.CreateContext();
        var service = CreateService(context);
        var action = await service.CreatePendingAsync(ExerciseProposal(conversationId), SqliteTestDatabase.UserId);

        var first = await service.ConfirmAsync(action.Id, SqliteTestDatabase.UserId);
        var second = await service.ConfirmAsync(action.Id, SqliteTestDatabase.UserId);

        Assert.Equal(first.Result!.CreatedEntityId, second.Result!.CreatedEntityId);
        Assert.Equal(1, await context.Exercises.CountAsync(x => x.Name == "Incline cable press"));
    }

    // Чужд потребител не може да потвърди предложението
    [Fact]
    public async Task Confirm_ByAnotherUser_Throws()
    {
        using var db = new SqliteTestDatabase();
        var conversationId = await SeedConversationAsync(db, SqliteTestDatabase.UserId);
        await using var context = db.CreateContext();
        var service = CreateService(context);
        var action = await service.CreatePendingAsync(ExerciseProposal(conversationId), SqliteTestDatabase.UserId);

        await Assert.ThrowsAsync<FitMateException>(() =>
            service.ConfirmAsync(action.Id, SqliteTestDatabase.OtherUserId));

        Assert.Empty(await context.Exercises.Where(x => x.Name == "Incline cable press").ToListAsync());
    }

    // Отхвърленото предложение не може да се изпълни
    [Fact]
    public async Task Confirm_AfterReject_Throws()
    {
        using var db = new SqliteTestDatabase();
        var conversationId = await SeedConversationAsync(db, SqliteTestDatabase.UserId);
        await using var context = db.CreateContext();
        var service = CreateService(context);
        var action = await service.CreatePendingAsync(ExerciseProposal(conversationId), SqliteTestDatabase.UserId);

        var rejected = await service.RejectAsync(action.Id, SqliteTestDatabase.UserId);
        Assert.Equal(AIActionStatus.Rejected, rejected.Status);

        await Assert.ThrowsAsync<FitMateException>(() =>
            service.ConfirmAsync(action.Id, SqliteTestDatabase.UserId));
        Assert.Empty(await context.Exercises.Where(x => x.Name == "Incline cable press").ToListAsync());
    }

    // Изтеклото предложение не може да се изпълни
    [Fact]
    public async Task Confirm_AfterExpiry_Throws()
    {
        using var db = new SqliteTestDatabase();
        var conversationId = await SeedConversationAsync(db, SqliteTestDatabase.UserId);
        await using var context = db.CreateContext();
        var service = CreateService(context);
        var action = await service.CreatePendingAsync(ExerciseProposal(conversationId), SqliteTestDatabase.UserId);

        var stored = await context.AIActions.SingleAsync(x => x.Id == action.Id);
        stored.ExpiresAt = DateTime.UtcNow.AddMinutes(-1);
        await context.SaveChangesAsync();

        await Assert.ThrowsAsync<AIActionExpiredException>(() =>
            service.ConfirmAsync(action.Id, SqliteTestDatabase.UserId));

        var reloaded = await context.AIActions.AsNoTracking().SingleAsync(x => x.Id == action.Id);
        Assert.Equal(AIActionStatus.Expired, reloaded.Status);
    }

    // Подправеният payload се хваща при повторната валидация
    [Fact]
    public async Task Confirm_WithTamperedPayload_IsRevalidatedAndFails()
    {
        using var db = new SqliteTestDatabase();
        var conversationId = await SeedConversationAsync(db, SqliteTestDatabase.UserId);
        await using var context = db.CreateContext();
        var service = CreateService(context);
        var action = await service.CreatePendingAsync(ExerciseProposal(conversationId), SqliteTestDatabase.UserId);

        // Simulate the payload being altered after the first validation pass.
        var stored = await context.AIActions.SingleAsync(x => x.Id == action.Id);
        stored.PayloadJson = AIJsonSerializer.Serialize(new ProposeExercisePayload
        {
            Name = "Tampered",
            PrimaryMuscleGroupId = 9999, // muscle group that does not exist
        });
        await context.SaveChangesAsync();

        await Assert.ThrowsAsync<FitMateException>(() =>
            service.ConfirmAsync(action.Id, SqliteTestDatabase.UserId));

        Assert.Empty(await context.Exercises.Where(x => x.Name == "Tampered").ToListAsync());
        var reloaded = await context.AIActions.AsNoTracking().SingleAsync(x => x.Id == action.Id);
        Assert.Equal(AIActionStatus.Failed, reloaded.Status);
    }

    // Шаблон, чиито упражнения вече не са видими, не се създава
    [Fact]
    public async Task Confirm_TemplateWithUnavailableExercise_Fails()
    {
        using var db = new SqliteTestDatabase();
        var conversationId = await SeedConversationAsync(db, SqliteTestDatabase.UserId);
        var exerciseId = await SeedExerciseAsync(db, "bench-press-action");
        await using var context = db.CreateContext();
        var service = CreateService(context);

        var action = await service.CreatePendingAsync(
            new CreateAIActionRequest
            {
                ConversationId = conversationId,
                ActionType = AIActionType.CreateWorkoutTemplate,
                PayloadJson = AIJsonSerializer.Serialize(new ProposeWorkoutTemplatePayload
                {
                    Name = "Upper A",
                    Exercises =
                    [
                        new ProposedExercise
                        {
                            ExerciseId = exerciseId,
                            Sets = [new ProposedSet { Reps = 8, WeightKg = 60 }],
                        },
                    ],
                }),
                Preview = new AIActionPreviewModel { Title = "Upper A" },
            },
            SqliteTestDatabase.UserId);

        // The exercise becomes private to somebody else between proposal and confirmation.
        var exercise = await context.Exercises.SingleAsync(x => x.Id == exerciseId);
        exercise.IsPublic = false;
        exercise.UserId = SqliteTestDatabase.OtherUserId;
        await context.SaveChangesAsync();

        await Assert.ThrowsAsync<FitMateException>(() =>
            service.ConfirmAsync(action.Id, SqliteTestDatabase.UserId));

        Assert.Empty(await context.WorkoutTemplates.Where(x => x.Name == "Upper A").ToListAsync());
    }

    // Валидното потвърждаване на шаблон го създава
    [Fact]
    public async Task Confirm_ValidTemplate_CreatesIt()
    {
        using var db = new SqliteTestDatabase();
        var conversationId = await SeedConversationAsync(db, SqliteTestDatabase.UserId);
        var exerciseId = await SeedExerciseAsync(db, "row-action");
        await using var context = db.CreateContext();
        var service = CreateService(context);

        var action = await service.CreatePendingAsync(
            new CreateAIActionRequest
            {
                ConversationId = conversationId,
                ActionType = AIActionType.CreateWorkoutTemplate,
                PayloadJson = AIJsonSerializer.Serialize(new ProposeWorkoutTemplatePayload
                {
                    Name = "Pull A",
                    Exercises =
                    [
                        new ProposedExercise
                        {
                            ExerciseId = exerciseId,
                            Sets = [new ProposedSet { Reps = 10, WeightKg = 40 }],
                        },
                    ],
                }),
                Preview = new AIActionPreviewModel { Title = "Pull A" },
            },
            SqliteTestDatabase.UserId);

        var confirmed = await service.ConfirmAsync(action.Id, SqliteTestDatabase.UserId);

        Assert.Equal(AIActionStatus.Executed, confirmed.Status);
        Assert.Equal("templates", confirmed.Result!.EntityKind);
        Assert.Equal(1, await context.WorkoutTemplates.CountAsync(x => x.Name == "Pull A"));
    }

    // Прегледът и предупрежденията оцеляват презареждането
    [Fact]
    public async Task GetById_ReturnsPreviewAndWarnings()
    {
        using var db = new SqliteTestDatabase();
        var conversationId = await SeedConversationAsync(db, SqliteTestDatabase.UserId);
        await using var context = db.CreateContext();
        var service = CreateService(context);

        var request = ExerciseProposal(conversationId);
        request.Preview = new AIActionPreviewModel
        {
            Title = "Incline cable press",
            Subtitle = "New exercise",
            Lines = [new AIActionPreviewLineModel { Label = "Equipment", Value = "Cable" }],
        };
        request.ValidationSummary = new AIActionValidationSummaryModel
        {
            Warnings = ["Similar exercises already exist."],
            DuplicateCandidates = [new DuplicateCandidateModel { Id = 7, Name = "Cable press" }],
        };

        var created = await service.CreatePendingAsync(request, SqliteTestDatabase.UserId);
        var reloaded = await service.GetByIdAsync(created.Id, SqliteTestDatabase.UserId);

        Assert.NotNull(reloaded);
        Assert.Equal("Incline cable press", reloaded!.Preview.Title);
        Assert.Single(reloaded.Preview.Lines);
        Assert.Single(reloaded.ValidationSummary.Warnings);
        Assert.Single(reloaded.ValidationSummary.DuplicateCandidates);
    }
}
