using FitMate.Core.JsonModels.AdminAI;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.AI;
using FitMate.Services.AdminAI;
using FitMate.Tests.TestInfrastructure;

namespace FitMate.Tests.Unit.Services;

public class AdminAIServiceTests
{
    private static AdminAIService CreateService(AppDbContext context) =>
        new(context, new AIRedactionService());

    private static async Task<(long ConversationId, long RunId)> SeedRunAsync(
        AppDbContext context,
        long userId,
        decimal cost,
        AIRunStatus status = AIRunStatus.Completed,
        string model = "gpt-test")
    {
        var conversation = new AIConversation
        {
            UserId = userId,
            Title = "Program help",
            Status = AIConversationStatus.Active,
            LastMessageAt = DateTime.UtcNow,
        };
        context.AIConversations.Add(conversation);
        await context.SaveChangesAsync();

        var run = new AIRun
        {
            UserId = userId,
            ConversationId = conversation.Id,
            Status = status,
            Provider = "test",
            Model = model,
            PromptVersion = "v1",
            InputTokens = 100,
            OutputTokens = 50,
            EstimatedCost = cost,
            ToolCallCount = 1,
            DurationMilliseconds = 1200,
            StartedAt = DateTime.UtcNow.AddMinutes(-1),
            CompletedAt = DateTime.UtcNow,
        };
        context.AIRuns.Add(run);
        await context.SaveChangesAsync();

        context.AIToolExecutions.Add(new AIToolExecution
        {
            AIRunId = run.Id,
            ToolCallId = "call-1",
            ToolName = "search_exercises",
            Status = AIToolExecutionStatus.Completed,
            DurationMilliseconds = 40,
            StartedAt = DateTime.UtcNow.AddMinutes(-1),
            CompletedAt = DateTime.UtcNow,
        });
        await context.SaveChangesAsync();

        return (conversation.Id, run.Id);
    }

    // Прегледът сумира разходите и активните потребители
    [Fact]
    public async Task GetOverview_AggregatesRunsAndCosts()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        await SeedRunAsync(context, SqliteTestDatabase.UserId, 0.25m);
        await SeedRunAsync(context, SqliteTestDatabase.OtherUserId, 0.75m, AIRunStatus.Failed);

        var overview = await CreateService(context).GetOverviewAsync(30);

        Assert.Equal(2, overview.TotalRuns);
        Assert.Equal(1, overview.FailedRuns);
        Assert.Equal(2, overview.ActiveUsers);
        Assert.Equal(1.00m, overview.EstimatedCost);
        Assert.Equal(200, overview.InputTokens);
        Assert.Equal("search_exercises", Assert.Single(overview.TopTools).ToolName);
        Assert.Equal(2, Assert.Single(overview.TopTools).CallCount);
    }

    // Списъкът с разговори не чете съдържание на съобщения
    [Fact]
    public async Task ListConversations_ReturnsMetadataAndCost()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var (conversationId, _) = await SeedRunAsync(context, SqliteTestDatabase.UserId, 0.4m);

        context.AIMessages.Add(new AIMessage
        {
            ConversationId = conversationId,
            UserId = SqliteTestDatabase.UserId,
            Role = AIMessageRole.User,
            Content = "Secret content",
        });
        await context.SaveChangesAsync();

        var response = await CreateService(context).ListConversationsAsync(new AIConversationQueryRequest());

        var item = Assert.Single(response.Items);
        Assert.Equal(conversationId, item.Id);
        Assert.Equal(1, item.MessageCount);
        Assert.Equal(1, item.RunCount);
        Assert.Equal(0.4m, item.EstimatedCost);
    }

    // Детайлът показва съобщенията, когато потребителят е разрешил преглед
    [Fact]
    public async Task GetConversation_WithConsent_ShowsRedactedContent()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var (conversationId, _) = await SeedRunAsync(context, SqliteTestDatabase.UserId, 0.1m);

        context.AIMessages.Add(new AIMessage
        {
            ConversationId = conversationId,
            UserId = SqliteTestDatabase.UserId,
            Role = AIMessageRole.User,
            Content = "Plan my week",
        });
        await context.SaveChangesAsync();

        var detail = await CreateService(context).GetConversationAsync(conversationId);

        Assert.True(detail!.ContentVisible);
        Assert.Equal("Plan my week", Assert.Single(detail.Messages).Content);
        Assert.Single(detail.Runs);
    }

    // Отказът от преглед скрива съдържанието, но не и одитната следа
    [Fact]
    public async Task GetConversation_WithoutConsent_HidesContent()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var (conversationId, _) = await SeedRunAsync(context, SqliteTestDatabase.UserId, 0.1m);

        context.AIMessages.Add(new AIMessage
        {
            ConversationId = conversationId,
            UserId = SqliteTestDatabase.UserId,
            Role = AIMessageRole.User,
            Content = "Plan my week",
        });
        context.UserAIPreferences.Add(new UserAIPreferences
        {
            UserId = SqliteTestDatabase.UserId,
            AllowAdminContentReview = false,
            UpdatedAt = DateTime.UtcNow,
        });
        await context.SaveChangesAsync();

        var detail = await CreateService(context).GetConversationAsync(conversationId);

        Assert.False(detail!.ContentVisible);
        Assert.DoesNotContain("Plan my week", Assert.Single(detail.Messages).Content);
        Assert.Single(detail.Runs);
    }

    // Филтърът за грешки връща само провалените изпълнения
    [Fact]
    public async Task ListRuns_FailuresOnly_FiltersOutSuccesses()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        await SeedRunAsync(context, SqliteTestDatabase.UserId, 0.2m);
        await SeedRunAsync(context, SqliteTestDatabase.UserId, 0.3m, AIRunStatus.Failed);

        var response = await CreateService(context).ListRunsAsync(new AIRunQueryRequest { FailuresOnly = true });

        Assert.Equal(AIRunStatus.Failed, Assert.Single(response.Items).Status);
    }

    // Разходите се разбиват по модел и по план
    [Fact]
    public async Task GetCosts_BreaksDownByModelAndPlan()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        SqliteTestDatabase.SeedPlans(context);
        SqliteTestDatabase.SeedActiveSubscription(context, SqliteTestDatabase.UserId, SqliteTestDatabase.PlusPlanId);
        await SeedRunAsync(context, SqliteTestDatabase.UserId, 0.5m, model: "gpt-a");
        await SeedRunAsync(context, SqliteTestDatabase.OtherUserId, 0.25m, model: "gpt-b");

        var costs = await CreateService(context).GetCostsAsync(30);

        Assert.Equal(0.75m, costs.EstimatedCost);
        Assert.Equal(0.5m, costs.ByModel.Single(x => x.Model == "gpt-a").EstimatedCost);

        // Без абонамент потребителят се брои към безплатния план
        Assert.Equal(0.5m, costs.ByPlan.Single(x => x.PlanCode == "plus").EstimatedCost);
        Assert.Equal(0.25m, costs.ByPlan.Single(x => x.PlanCode == "free").EstimatedCost);
    }

    // Употребата се обобщава по функция за периода
    [Fact]
    public async Task GetUsage_SummarizesBucketsForThePeriod()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var periodStart = new DateOnly(today.Year, today.Month, 1);

        context.UsageBuckets.AddRange(
            new UsageBucket
            {
                UserId = SqliteTestDatabase.UserId,
                Feature = SubscriptionFeature.AIChat,
                PeriodStart = periodStart,
                PeriodEnd = periodStart.AddMonths(1).AddDays(-1),
                Used = 10,
                EffectiveLimit = 10,
            },
            new UsageBucket
            {
                UserId = SqliteTestDatabase.OtherUserId,
                Feature = SubscriptionFeature.AIChat,
                PeriodStart = periodStart,
                PeriodEnd = periodStart.AddMonths(1).AddDays(-1),
                Used = 3,
                EffectiveLimit = 10,
            });
        await context.SaveChangesAsync();

        var usage = await CreateService(context).GetUsageAsync(null);

        var feature = Assert.Single(usage.Features);
        Assert.Equal(SubscriptionFeature.AIChat, feature.Feature);
        Assert.Equal(13, feature.UsedTotal);
        Assert.Equal(2, feature.UserCount);
        Assert.Equal(1, feature.AtOrOverLimitCount);
    }
}
