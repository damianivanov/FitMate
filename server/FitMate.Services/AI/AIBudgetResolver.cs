using FitMate.DB.Enums;
using FitMate.Services.Subscriptions;

namespace FitMate.Services.AI;

public class AIBudgetResolver : IAIBudgetResolver
{
    private readonly IAISettingsService settingsService;
    private readonly IEntitlementService entitlementService;

    public AIBudgetResolver(IAISettingsService settingsService, IEntitlementService entitlementService)
    {
        this.settingsService = settingsService;
        this.entitlementService = entitlementService;
    }

    public async Task<AIBudget> ResolveAsync(long userId)
    {
        var settings = await settingsService.GetAsync();

        var planContextTokens = await GetPlanLimitAsync(userId, SubscriptionFeature.AIContextTokens);
        var planMessages = await GetPlanLimitAsync(userId, SubscriptionFeature.AIConversationMessages);
        var tier = await entitlementService.GetAIModelTierAsync(userId);

        // The global ceiling is a hard cap: a plan may ask for less, never more.
        var contextTokens = planContextTokens is { } planTokens
            ? Math.Min(planTokens, settings.MaximumContextTokens)
            : settings.MaximumContextTokens;

        var conversationMessages = planMessages is { } messages
            ? Math.Min(messages, settings.MaximumConversationMessages)
            : settings.MaximumConversationMessages;

        return new AIBudget(
            ResolveModel(settings, tier),
            contextTokens,
            conversationMessages,
            settings.MaximumOutputTokens,
            settings.MaximumMessageCharacters,
            settings.TimeoutSeconds,
            settings.MaximumToolIterations,
            settings.MaximumToolCallsPerRun);
    }

    private async Task<int?> GetPlanLimitAsync(long userId, SubscriptionFeature feature)
    {
        var entitlement = await entitlementService.GetEntitlementAsync(userId, feature);
        if (entitlement is not { IsEnabled: true })
        {
            return null;
        }

        var limit = entitlement.HardLimit ?? entitlement.MonthlyLimit;
        return limit > 0 ? limit : null;
    }

    private static string ResolveModel(Core.JsonModels.AdminAI.AISettingsModel settings, AIModelTier? tier)
    {
        var model = tier switch
        {
            AIModelTier.Fast => settings.FastModel,
            AIModelTier.Reasoning => settings.ReasoningModel,
            _ => settings.DefaultModel,
        };

        return string.IsNullOrWhiteSpace(model) ? settings.DefaultModel : model;
    }
}
