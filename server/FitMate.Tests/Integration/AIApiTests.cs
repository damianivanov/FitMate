using System.Net;
using System.Net.Http.Json;
using FitMate.Core.JsonModels.AI;
using FitMate.DB.Enums;
using FitMate.Tests.TestInfrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace FitMate.Tests.Integration;

public class AIApiTests
{
    // Без логин AI endpoint-ите връщат 401
    [Theory]
    [InlineData("/api/ai/conversations")]
    [InlineData("/api/ai/usage")]
    public async Task AIEndpoints_WithoutAuth_Return401(string url)
    {
        using var factory = new TestWebApplicationFactory();
        var client = factory.CreateApiClient();

        var response = await client.GetAsync(url);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // Изпращането приема прогона веднага, без да чака отговора
    [Fact]
    public async Task SendMessage_Returns202WithQueuedRun()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateUserClientAsync("ai-user@test.local");
        factory.Services.GetRequiredService<FakeAICompletionProvider>().EnqueueText("Rest today.");

        var created = await client.PostAsJsonAsync("/api/ai/conversations", new CreateAIConversationRequest());
        var conversation = await created.Content.ReadFromJsonAsync<ApiResponse<AIConversationModel>>();
        Assert.True(conversation!.Success);

        var sent = await client.PostAsJsonAsync(
            $"/api/ai/conversations/{conversation.Data!.Id}/messages",
            new SendAIMessageRequest
            {
                Content = "What should I train today?",
                ClientRequestId = Guid.NewGuid().ToString(),
            });

        Assert.Equal(HttpStatusCode.Accepted, sent.StatusCode);

        var body = await sent.Content.ReadFromJsonAsync<ApiResponse<StartAIRunResponse>>();
        Assert.True(body!.Success);
        Assert.True(body.Data!.RunId > 0);
        Assert.Equal(AIRunStatus.Queued, body.Data.Status);
        Assert.Equal("What should I train today?", body.Data.UserMessage.Content);
        Assert.Equal(conversation.Data.Id, body.Data.ConversationId);
    }

    // Изпълненият прогон връща отговора през моментната снимка
    [Fact]
    public async Task ProcessedRun_ExposesAssistantReplyThroughSnapshot()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateUserClientAsync("ai-snapshot@test.local");
        factory.Services.GetRequiredService<FakeAICompletionProvider>().EnqueueText("Rest today.");

        var created = await client.PostAsJsonAsync("/api/ai/conversations", new CreateAIConversationRequest());
        var conversation = await created.Content.ReadFromJsonAsync<ApiResponse<AIConversationModel>>();

        var sent = await client.PostAsJsonAsync(
            $"/api/ai/conversations/{conversation!.Data!.Id}/messages",
            new SendAIMessageRequest { Content = "What now?", ClientRequestId = Guid.NewGuid().ToString() });
        var started = await sent.Content.ReadFromJsonAsync<ApiResponse<StartAIRunResponse>>();

        await factory.ProcessPendingAIRunsAsync();

        var snapshotResponse = await client.GetAsync($"/api/ai/runs/{started!.Data!.RunId}");
        var snapshot = await snapshotResponse.Content.ReadFromJsonAsync<ApiResponse<AIRunSnapshotModel>>();

        Assert.True(snapshot!.Success);
        Assert.Equal(AIRunStatus.Completed, snapshot.Data!.Status);
        Assert.Equal("Rest today.", snapshot.Data.AssistantMessage!.Content);
        Assert.Equal(SqliteTestDatabase.FreeAIChatMonthlyLimit, snapshot.Data.Usage!.Limit);
    }

    // Чужд разговор не е достъпен
    [Fact]
    public async Task GetConversation_OtherUser_ReturnsErrorEnvelope()
    {
        using var factory = new TestWebApplicationFactory();
        var owner = await factory.CreateUserClientAsync("ai-owner@test.local");
        var created = await owner.PostAsJsonAsync("/api/ai/conversations", new CreateAIConversationRequest());
        var conversation = await created.Content.ReadFromJsonAsync<ApiResponse<AIConversationModel>>();

        var stranger = await factory.CreateUserClientAsync("ai-stranger@test.local");
        var response = await stranger.GetAsync($"/api/ai/conversations/{conversation!.Data!.Id}");
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<AIConversationModel>>();

        Assert.False(body!.Success);
    }

    // Изтритият разговор изчезва от списъка
    [Fact]
    public async Task DeleteConversation_RemovesItFromTheList()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateUserClientAsync("ai-delete@test.local");
        var created = await client.PostAsJsonAsync("/api/ai/conversations", new CreateAIConversationRequest());
        var conversation = await created.Content.ReadFromJsonAsync<ApiResponse<AIConversationModel>>();

        await client.DeleteAsync($"/api/ai/conversations/{conversation!.Data!.Id}");

        var listResponse = await client.GetAsync("/api/ai/conversations");
        var list = await listResponse.Content.ReadFromJsonAsync<ApiResponse<List<AIConversationSummaryModel>>>();

        Assert.True(list!.Success);
        Assert.DoesNotContain(list.Data!, x => x.Id == conversation.Data.Id);
    }
}
