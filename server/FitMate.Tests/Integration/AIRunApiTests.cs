using System.Net;
using System.Net.Http.Json;
using FitMate.Core.JsonModels.AI;
using FitMate.DB.Enums;
using FitMate.Services.AI.Runs;
using FitMate.Tests.TestInfrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace FitMate.Tests.Integration;

public class AIRunApiTests
{
    // Чужд прогон не се различава от несъществуващ
    [Fact]
    public async Task GetRunSnapshot_ForAnotherUsersRun_ReturnsNotFound()
    {
        using var factory = new TestWebApplicationFactory();
        var owner = await factory.CreateUserClientAsync("run-owner@test.local");
        var started = await StartRunAsync(factory, owner, "hello");

        var intruder = await factory.CreateUserClientAsync("run-intruder@test.local");
        var response = await intruder.GetAsync($"/api/ai/runs/{started.RunId}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // Потокът от събития също проверява собствеността
    [Fact]
    public async Task StreamEvents_ForAnotherUsersRun_ReturnsNotFound()
    {
        using var factory = new TestWebApplicationFactory();
        var owner = await factory.CreateUserClientAsync("stream-owner@test.local");
        var started = await StartRunAsync(factory, owner, "hello");

        var intruder = await factory.CreateUserClientAsync("stream-intruder@test.local");
        var response = await intruder.GetAsync($"/api/ai/runs/{started.RunId}/events");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // Потокът се затваря на терминално събитие, вместо да виси
    [Fact]
    public async Task StreamEvents_ForFinishedRun_ClosesInsteadOfHanging()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateUserClientAsync("stream-finished@test.local");
        factory.Services.GetRequiredService<FakeAICompletionProvider>().EnqueueText("All done.");

        var conversationId = await CreateConversationAsync(client);
        var started = await PostMessageAsync(client, conversationId, "hello", Guid.NewGuid().ToString());
        await factory.ProcessPendingAIRunsAsync();

        // A stream that never closed would hang here until the test timeout rather than failing.
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(20));
        var body = await client.GetStringAsync($"/api/ai/runs/{started.RunId}/events", timeout.Token);

        Assert.Contains(AIProgressCodes.RunQueued, body);
        Assert.Contains(AIProgressCodes.RunCompleted, body);
        Assert.Contains("event: progress", body);
    }

    // Курсорът връща само новите събития
    [Fact]
    public async Task GetRunSnapshot_ReplaysOnlyEventsAfterCursor()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateUserClientAsync("run-cursor@test.local");
        var started = await StartRunAsync(factory, client, "hello");

        var full = await ReadSnapshotAsync(client, started.RunId);
        Assert.NotEmpty(full.Events);
        Assert.Equal(AIProgressCodes.RunQueued, full.Events[0].Code);

        var after = await ReadSnapshotAsync(client, started.RunId, full.LastEventId);
        Assert.Empty(after.Events);
        Assert.Equal(full.LastEventId, after.LastEventId);
    }

    // Второ съобщение при активен прогон се отказва
    [Fact]
    public async Task SecondMessageWhileRunActive_Returns409()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateUserClientAsync("run-conflict@test.local");
        var conversationId = await CreateConversationAsync(client);

        await client.PostAsJsonAsync(
            $"/api/ai/conversations/{conversationId}/messages",
            new SendAIMessageRequest { Content = "first", ClientRequestId = Guid.NewGuid().ToString() });

        var second = await client.PostAsJsonAsync(
            $"/api/ai/conversations/{conversationId}/messages",
            new SendAIMessageRequest { Content = "second", ClientRequestId = Guid.NewGuid().ToString() });

        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
    }

    // Повторение със същия ключ не създава втори прогон
    [Fact]
    public async Task RetryWithSameClientRequestId_ReturnsSameRun()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateUserClientAsync("run-idempotent@test.local");
        var conversationId = await CreateConversationAsync(client);
        var clientRequestId = Guid.NewGuid().ToString();

        var first = await PostMessageAsync(client, conversationId, "hello", clientRequestId);
        var second = await PostMessageAsync(client, conversationId, "hello", clientRequestId);

        Assert.Equal(first.RunId, second.RunId);
        Assert.Equal(first.UserMessage.Id, second.UserMessage.Id);
    }

    // Разговорът носи активния прогон, за да може презареждане да се закачи обратно
    [Fact]
    public async Task GetConversation_WhileRunActive_IncludesActiveRun()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateUserClientAsync("run-rehydrate@test.local");
        var started = await StartRunAsync(factory, client, "hello");

        var response = await client.GetAsync($"/api/ai/conversations/{started.ConversationId}");
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<AIConversationModel>>();

        Assert.True(body!.Success);
        Assert.NotNull(body.Data!.ActiveRun);
        Assert.Equal(started.RunId, body.Data.ActiveRun!.RunId);
        Assert.Equal(AIRunStatus.Queued, body.Data.ActiveRun.Status);
    }

    // Завършил прогон освобождава разговора
    [Fact]
    public async Task GetConversation_AfterRunCompletes_HasNoActiveRun()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateUserClientAsync("run-finished@test.local");
        factory.Services.GetRequiredService<FakeAICompletionProvider>().EnqueueText("All done.");

        var conversationId = await CreateConversationAsync(client);
        await factory.SendAndProcessAsync(client, conversationId, "hello");

        var response = await client.GetAsync($"/api/ai/conversations/{conversationId}");
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<AIConversationModel>>();

        Assert.Null(body!.Data!.ActiveRun);
        Assert.Contains(body.Data.Messages, x => x.Content == "All done.");
    }

    // Провалил се прогон излага само код, никога текст на грешка
    [Fact]
    public async Task FailedRun_ExposesOnlyAPublicErrorCode()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateUserClientAsync("run-failed@test.local");
        factory.Services.GetRequiredService<FakeAICompletionProvider>().ThrowOnCall =
            new InvalidOperationException("connection string leaked here");

        var conversationId = await CreateConversationAsync(client);
        var started = await PostMessageAsync(client, conversationId, "hello", Guid.NewGuid().ToString());
        await factory.ProcessPendingAIRunsAsync();

        var snapshot = await ReadSnapshotAsync(client, started.RunId);

        Assert.Equal(AIRunStatus.Failed, snapshot.Status);

        // A stable code, never the exception type name the run row keeps for auditing.
        Assert.Equal(AIPublicErrorCodes.Internal, snapshot.PublicErrorCode);

        var serialized = System.Text.Json.JsonSerializer.Serialize(snapshot);
        Assert.DoesNotContain("connection string leaked here", serialized);
        Assert.DoesNotContain(nameof(InvalidOperationException), serialized);
    }

    private static async Task<long> CreateConversationAsync(HttpClient client)
    {
        var created = await client.PostAsJsonAsync("/api/ai/conversations", new CreateAIConversationRequest());
        var conversation = await created.Content.ReadFromJsonAsync<ApiResponse<AIConversationModel>>();

        return conversation!.Data!.Id;
    }

    private static async Task<StartAIRunResponse> PostMessageAsync(
        HttpClient client,
        long conversationId,
        string content,
        string clientRequestId)
    {
        var sent = await client.PostAsJsonAsync(
            $"/api/ai/conversations/{conversationId}/messages",
            new SendAIMessageRequest { Content = content, ClientRequestId = clientRequestId });

        var body = await sent.Content.ReadFromJsonAsync<ApiResponse<StartAIRunResponse>>();
        Assert.True(body!.Success);

        return body.Data!;
    }

    private static async Task<StartAIRunResponse> StartRunAsync(
        TestWebApplicationFactory factory,
        HttpClient client,
        string content)
    {
        factory.Services.GetRequiredService<FakeAICompletionProvider>().EnqueueText("Reply.");
        var conversationId = await CreateConversationAsync(client);

        return await PostMessageAsync(client, conversationId, content, Guid.NewGuid().ToString());
    }

    private static async Task<AIRunSnapshotModel> ReadSnapshotAsync(
        HttpClient client,
        long runId,
        long afterEventId = 0)
    {
        var response = await client.GetAsync($"/api/ai/runs/{runId}?afterEventId={afterEventId}");
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<AIRunSnapshotModel>>();
        Assert.True(body!.Success);

        return body.Data!;
    }
}
