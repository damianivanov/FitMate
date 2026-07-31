using System.Net;
using System.Net.Http.Json;
using FitMate.Core.JsonModels.AI;
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

    // Изпращане на съобщение връща отговора на асистента
    [Fact]
    public async Task SendMessage_ReturnsAssistantReply()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateUserClientAsync("ai-user@test.local");
        factory.Services.GetRequiredService<FakeAICompletionProvider>().EnqueueText("Rest today.");

        var created = await client.PostAsJsonAsync("/api/ai/conversations", new CreateAIConversationRequest());
        var conversation = await created.Content.ReadFromJsonAsync<ApiResponse<AIConversationModel>>();
        Assert.True(conversation!.Success);

        var sent = await client.PostAsJsonAsync(
            $"/api/ai/conversations/{conversation.Data!.Id}/messages",
            new SendAIMessageRequest { Content = "What should I train today?" });
        var body = await sent.Content.ReadFromJsonAsync<ApiResponse<SendAIMessageResponse>>();

        Assert.True(body!.Success);
        Assert.Equal("Rest today.", body.Data!.Message.Content);
        Assert.Equal(conversation.Data.Id, body.Data.ConversationId);
        Assert.Equal(10, body.Data.Usage.Limit); // Free plan grants 10 AI chat messages
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
