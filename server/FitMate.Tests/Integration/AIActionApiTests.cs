using System.Net;
using System.Net.Http.Json;
using FitMate.Core.JsonModels.AI;
using FitMate.Core.JsonModels.AIActions;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitMate.Tests.Integration;

public class AIActionApiTests
{
    private static async Task<long> SeedMuscleGroupAsync(TestWebApplicationFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var muscleGroup = new MuscleGroup { Name = $"Chest-{Guid.NewGuid():N}" };
        dbContext.MuscleGroups.Add(muscleGroup);
        await dbContext.SaveChangesAsync();
        return muscleGroup.Id;
    }

    /// <summary>
    /// Drives a full run: the scripted model proposes an exercise, then answers in words. The
    /// response carries the pending action the user must confirm.
    /// </summary>
    private static async Task<(HttpClient Client, AIActionModel Action)> ProposeExerciseAsync(
        TestWebApplicationFactory factory,
        string email)
    {
        var client = await factory.CreateUserClientAsync(email);
        var muscleGroupId = await SeedMuscleGroupAsync(factory);

        factory.Services.GetRequiredService<FakeAICompletionProvider>()
            .EnqueueToolCall(
                "call-1",
                "propose_exercise",
                $$"""{"name":"Incline cable press","primaryMuscleGroupId":{{muscleGroupId}},"isPublic":false}""")
            .EnqueueText("I prepared a new exercise for you to confirm.");

        var created = await client.PostAsJsonAsync("/api/ai/conversations", new CreateAIConversationRequest());
        var conversation = await created.Content.ReadFromJsonAsync<ApiResponse<AIConversationModel>>();

        var sent = await client.PostAsJsonAsync(
            $"/api/ai/conversations/{conversation!.Data!.Id}/messages",
            new SendAIMessageRequest { Content = "Add an incline cable press." });
        var body = await sent.Content.ReadFromJsonAsync<ApiResponse<SendAIMessageResponse>>();

        Assert.True(body!.Success);
        var action = Assert.Single(body.Data!.Actions);
        return (client, action);
    }

    // Предложението се връща като чакащо и още нищо не е създадено
    [Fact]
    public async Task ProposeExercise_ReturnsPendingActionAndCreatesNothing()
    {
        using var factory = new TestWebApplicationFactory();
        var (_, action) = await ProposeExerciseAsync(factory, "action-propose@test.local");

        Assert.Equal(AIActionStatus.PendingConfirmation, action.Status);
        Assert.Equal(AIActionType.CreatePersonalExercise, action.ActionType);
        Assert.Equal("Incline cable press", action.Preview.Title);

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Empty(await dbContext.Exercises.Where(x => x.Name == "Incline cable press").ToListAsync());
    }

    // Потвърждаването създава упражнението
    [Fact]
    public async Task Confirm_CreatesTheExercise()
    {
        using var factory = new TestWebApplicationFactory();
        var (client, action) = await ProposeExerciseAsync(factory, "action-confirm@test.local");

        var response = await client.PostAsync($"/api/ai/actions/{action.Id}/confirm", null);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<AIActionModel>>();

        Assert.True(body!.Success);
        Assert.Equal(AIActionStatus.Executed, body.Data!.Status);
        Assert.NotNull(body.Data.Result);

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(1, await dbContext.Exercises.CountAsync(x => x.Name == "Incline cable press"));
    }

    // Отхвърлянето оставя базата непокътната
    [Fact]
    public async Task Reject_LeavesNothingBehind()
    {
        using var factory = new TestWebApplicationFactory();
        var (client, action) = await ProposeExerciseAsync(factory, "action-reject@test.local");

        var response = await client.PostAsync($"/api/ai/actions/{action.Id}/reject", null);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<AIActionModel>>();

        Assert.True(body!.Success);
        Assert.Equal(AIActionStatus.Rejected, body.Data!.Status);

        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Empty(await dbContext.Exercises.Where(x => x.Name == "Incline cable press").ToListAsync());
    }

    // Чужд потребител не вижда предложението
    [Fact]
    public async Task GetById_OtherUser_ReturnsErrorEnvelope()
    {
        using var factory = new TestWebApplicationFactory();
        var (_, action) = await ProposeExerciseAsync(factory, "action-owner@test.local");

        var stranger = await factory.CreateUserClientAsync("action-stranger@test.local");
        var response = await stranger.GetAsync($"/api/ai/actions/{action.Id}");
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<AIActionModel>>();

        Assert.False(body!.Success);
    }

    // Без логин потвърждаването е забранено
    [Fact]
    public async Task Confirm_WithoutAuth_Returns401()
    {
        using var factory = new TestWebApplicationFactory();
        var client = factory.CreateApiClient();

        var response = await client.PostAsync("/api/ai/actions/1/confirm", null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
