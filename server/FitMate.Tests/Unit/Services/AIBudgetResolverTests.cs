using FitMate.Core.JsonModels.AdminAI;
using FitMate.Core.Settings;
using FitMate.DB;
using FitMate.DB.Enums;
using FitMate.Services.AI;
using FitMate.Tests.TestInfrastructure;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace FitMate.Tests.Unit.Services;

public class AIBudgetResolverTests
{
    private static AISettingsService CreateSettings(AppDbContext context) =>
        new(
            context,
            new MemoryCache(new MemoryCacheOptions()),
            Options.Create(new AIOptions
            {
                Provider = "OpenAI",
                DefaultModel = "default-model",
                FastModel = "fast-model",
                ReasoningModel = "reasoning-model",
                TimeoutSeconds = 90,
                MaximumToolIterations = 6,
                MaximumToolCallsPerRun = 12,
                MaximumConversationMessages = 30,
            }),
            new FakeAIModelCatalog());

    [Fact]
    public async Task WithNoStoredRow_FallsBackToAppsettingsAndThe32kDefault()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();

        var settings = await CreateSettings(context).GetAsync();

        Assert.False(settings.IsStored);
        Assert.Equal("default-model", settings.DefaultModel);
        Assert.Equal(AISettingsService.DefaultMaximumContextTokens, settings.MaximumContextTokens);
        Assert.Equal(32_000, settings.MaximumContextTokens);
    }

    [Fact]
    public async Task SavedSettings_AreReturnedAndMarkedStored()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var service = CreateSettings(context);

        var saved = await service.SaveAsync(new SaveAISettingsRequest
        {
            DefaultModel = "chosen-model",
            FastModel = "fast",
            ReasoningModel = "reasoning",
            VisionModel = "vision",
            ImageModel = "image",
            TimeoutSeconds = 45,
            MaximumToolIterations = 3,
            MaximumToolCallsPerRun = 5,
            MaximumConversationMessages = 12,
            MaximumContextTokens = 16_000,
            MaximumOutputTokens = 2_000,
            MaximumMessageCharacters = 8_000,
            ConversationRetentionDays = 365,
            OperationalLogRetentionDays = 180,
            TemporaryUploadRetentionHours = 24,
            ExpiredActionRetentionDays = 90,
        });

        Assert.True(saved.IsStored);
        Assert.Equal("chosen-model", saved.DefaultModel);
        Assert.Equal(16_000, (await service.GetAsync()).MaximumContextTokens);
    }

    [Fact]
    public async Task PlanCeilingAboveGlobal_IsClampedToGlobal()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();

        var entitlements = new FakeEntitlementService();
        entitlements.HardLimits[SubscriptionFeature.AIContextTokens] = 500_000;

        var budget = await new AIBudgetResolver(CreateSettings(context), entitlements)
            .ResolveAsync(SqliteTestDatabase.UserId);

        Assert.Equal(32_000, budget.MaximumContextTokens);
    }

    [Fact]
    public async Task PlanCeilingBelowGlobal_Wins()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();

        var entitlements = new FakeEntitlementService();
        entitlements.HardLimits[SubscriptionFeature.AIContextTokens] = 8_000;
        entitlements.HardLimits[SubscriptionFeature.AIConversationMessages] = 10;

        var budget = await new AIBudgetResolver(CreateSettings(context), entitlements)
            .ResolveAsync(SqliteTestDatabase.UserId);

        Assert.Equal(8_000, budget.MaximumContextTokens);
        Assert.Equal(10, budget.MaximumConversationMessages);
    }

    [Theory]
    [InlineData(null, "default-model")]
    [InlineData(AIModelTier.Fast, "fast-model")]
    [InlineData(AIModelTier.Default, "default-model")]
    [InlineData(AIModelTier.Reasoning, "reasoning-model")]
    public async Task ModelTier_SelectsTheMatchingModel(AIModelTier? tier, string expected)
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();

        var entitlements = new FakeEntitlementService { ModelTier = tier };

        var budget = await new AIBudgetResolver(CreateSettings(context), entitlements)
            .ResolveAsync(SqliteTestDatabase.UserId);

        Assert.Equal(expected, budget.Model);
    }

    // An unconfigured tier model must not send an empty model name to the provider.
    [Fact]
    public async Task TierWithNoConfiguredModel_FallsBackToDefault()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var service = CreateSettings(context);

        await service.SaveAsync(new SaveAISettingsRequest
        {
            DefaultModel = "only-default",
            FastModel = string.Empty,
            ReasoningModel = string.Empty,
            TimeoutSeconds = 90,
            MaximumToolIterations = 6,
            MaximumToolCallsPerRun = 12,
            MaximumConversationMessages = 30,
            MaximumContextTokens = 32_000,
            MaximumOutputTokens = 4_000,
            MaximumMessageCharacters = 16_000,
            ConversationRetentionDays = 365,
            OperationalLogRetentionDays = 180,
            TemporaryUploadRetentionHours = 24,
            ExpiredActionRetentionDays = 90,
        });

        var entitlements = new FakeEntitlementService { ModelTier = AIModelTier.Fast };
        var budget = await new AIBudgetResolver(service, entitlements).ResolveAsync(SqliteTestDatabase.UserId);

        Assert.Equal("only-default", budget.Model);
    }
}
