using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.AI;
using FitMate.Core.JsonModels.Subscriptions;
using FitMate.DB.Enums;
using FitMate.Services.AI.Runs;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Tests.Unit.Services;

public class AIRunStarterTests
{
    // Заявката се приема веднага, без да чака доставчика
    [Fact]
    public async Task Start_EnqueuesRunAndReturnsBeforeAnyProviderCall()
    {
        using var db = new SqliteTestDatabase();
        var harness = await StarterHarness.CreateAsync(db);

        var response = await harness.Starter.StartAsync(
            harness.ConversationId,
            new SendAIMessageRequest { Content = "hello", ClientRequestId = "req-1" },
            SqliteTestDatabase.UserId);

        Assert.Equal(AIRunStatus.Queued, response.Status);
        Assert.True(response.RunId > 0);
        Assert.Equal("hello", response.UserMessage.Content);
        Assert.True(response.UserMessage.Id > 0);
        Assert.Empty(harness.Provider.Requests);
    }

    // Повторение със същия ключ връща същия прогон и не резервира втори път
    [Fact]
    public async Task Start_WithDuplicateClientRequestId_ReturnsSameRunAndDoesNotReserveTwice()
    {
        using var db = new SqliteTestDatabase();
        var harness = await StarterHarness.CreateAsync(db);
        var request = new SendAIMessageRequest { Content = "hello", ClientRequestId = "req-1" };

        var first = await harness.Starter.StartAsync(harness.ConversationId, request, SqliteTestDatabase.UserId);
        var second = await harness.Starter.StartAsync(harness.ConversationId, request, SqliteTestDatabase.UserId);

        Assert.Equal(first.RunId, second.RunId);
        Assert.Single(harness.Usage.Reserved);
        Assert.Equal(1, await harness.Context.AIRuns.CountAsync());
        Assert.Equal(1, await harness.Context.AIMessages.CountAsync(x => x.Role == AIMessageRole.User));
    }

    // Само един активен прогон на разговор
    [Fact]
    public async Task Start_WhenAnotherRunIsActive_Throws()
    {
        using var db = new SqliteTestDatabase();
        var harness = await StarterHarness.CreateAsync(db);

        await harness.Starter.StartAsync(
            harness.ConversationId,
            new SendAIMessageRequest { Content = "first", ClientRequestId = "req-1" },
            SqliteTestDatabase.UserId);

        await Assert.ThrowsAsync<AIRunAlreadyActiveException>(() => harness.Starter.StartAsync(
            harness.ConversationId,
            new SendAIMessageRequest { Content = "second", ClientRequestId = "req-2" },
            SqliteTestDatabase.UserId));

        Assert.Equal(1, await harness.Context.AIRuns.CountAsync());
    }

    // Изчерпана квота: нито съобщение, нито прогон
    [Fact]
    public async Task Start_WhenQuotaExhausted_CreatesNoMessageAndNoRun()
    {
        using var db = new SqliteTestDatabase();
        var harness = await StarterHarness.CreateAsync(db);
        harness.Usage.ThrowOnReserve = new SubscriptionLimitExceededException(new SubscriptionLimitErrorModel
        {
            Feature = SubscriptionFeature.AIChat,
            Limit = 10,
            Used = 10,
        });

        await Assert.ThrowsAsync<SubscriptionLimitExceededException>(() => harness.Starter.StartAsync(
            harness.ConversationId,
            new SendAIMessageRequest { Content = "hello", ClientRequestId = "req-1" },
            SqliteTestDatabase.UserId));

        Assert.Equal(0, await harness.Context.AIRuns.CountAsync());
        Assert.Equal(0, await harness.Context.AIMessages.CountAsync());

        var conversation = await harness.Context.AIConversations.AsNoTracking().SingleAsync();
        Assert.Null(conversation.ActiveRunId);
    }

    // Изключена функция: отказва преди резервация
    [Fact]
    public async Task Start_WhenFeatureDisabled_ThrowsWithoutReserving()
    {
        using var db = new SqliteTestDatabase();
        var harness = await StarterHarness.CreateAsync(db);
        harness.Entitlements.DisabledFeatures.Add(SubscriptionFeature.AIChat);

        await Assert.ThrowsAsync<SubscriptionFeatureDisabledException>(() => harness.Starter.StartAsync(
            harness.ConversationId,
            new SendAIMessageRequest { Content = "hello", ClientRequestId = "req-1" },
            SqliteTestDatabase.UserId));

        Assert.Empty(harness.Usage.Reserved);
        Assert.Equal(0, await harness.Context.AIRuns.CountAsync());
    }

    // Приемането записва първото събитие за напредък
    [Fact]
    public async Task Start_PublishesQueuedProgressEvent()
    {
        using var db = new SqliteTestDatabase();
        var harness = await StarterHarness.CreateAsync(db);

        var response = await harness.Starter.StartAsync(
            harness.ConversationId,
            new SendAIMessageRequest { Content = "hello", ClientRequestId = "req-1" },
            SqliteTestDatabase.UserId);

        var codes = await harness.Context.AIProgressEvents
            .Where(x => x.AIRunId == response.RunId)
            .Select(x => x.Code)
            .ToListAsync();

        Assert.Equal([AIProgressCodes.RunQueued], codes);
    }

    // Прогонът сочи към съобщението, резервацията и бюджета си
    [Fact]
    public async Task Start_LinksUserMessageReservationAndBudgetToTheRun()
    {
        using var db = new SqliteTestDatabase();
        var harness = await StarterHarness.CreateAsync(db);

        var response = await harness.Starter.StartAsync(
            harness.ConversationId,
            new SendAIMessageRequest { Content = "hello", ClientRequestId = "req-1" },
            SqliteTestDatabase.UserId);

        var run = await harness.Context.AIRuns.AsNoTracking().SingleAsync();
        Assert.Equal(response.UserMessage.Id, run.UserMessageId);
        Assert.NotNull(run.UsageReservationId);
        Assert.NotNull(run.ExecutionBudgetJson);
        Assert.Contains("test-model", run.ExecutionBudgetJson);
        Assert.NotNull(run.QueuedAt);
        Assert.False(run.HasSideEffects);

        var message = await harness.Context.AIMessages.AsNoTracking().SingleAsync();
        Assert.Equal(run.Id, message.AIRunId);

        var conversation = await harness.Context.AIConversations.AsNoTracking().SingleAsync();
        Assert.Equal(run.Id, conversation.ActiveRunId);
    }

    // Празно съдържание и липсващ ключ се отхвърлят
    [Theory]
    [InlineData("", "req-1")]
    [InlineData("   ", "req-1")]
    [InlineData("hello", "")]
    public async Task Start_WithInvalidRequest_Throws(string content, string clientRequestId)
    {
        using var db = new SqliteTestDatabase();
        var harness = await StarterHarness.CreateAsync(db);

        await Assert.ThrowsAsync<FitMateException>(() => harness.Starter.StartAsync(
            harness.ConversationId,
            new SendAIMessageRequest { Content = content, ClientRequestId = clientRequestId },
            SqliteTestDatabase.UserId));

        Assert.Equal(0, await harness.Context.AIRuns.CountAsync());
    }

    // Чужд разговор не се вижда
    [Fact]
    public async Task Start_ForAnotherUsersConversation_Throws()
    {
        using var db = new SqliteTestDatabase();
        var harness = await StarterHarness.CreateAsync(db);

        await Assert.ThrowsAsync<FitMateException>(() => harness.Starter.StartAsync(
            harness.ConversationId,
            new SendAIMessageRequest { Content = "hello", ClientRequestId = "req-1" },
            SqliteTestDatabase.OtherUserId));

        Assert.Equal(0, await harness.Context.AIRuns.CountAsync());
    }
}
