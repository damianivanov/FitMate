using FitMate.Services.Subscriptions;

namespace FitMate.Services.AI.Tools.ReadOnly;

public class GetSubscriptionUsageToolHandler : IAIToolHandler
{
    private readonly IEntitlementService entitlementService;

    public GetSubscriptionUsageToolHandler(IEntitlementService entitlementService)
    {
        this.entitlementService = entitlementService;
    }

    public string Name => "get_subscription_usage";

    public AIToolDefinition Definition => new()
    {
        Name = Name,
        Description = "The user's plan and what they have used of each limited feature this month.",
    };

    public bool IsAvailable(AIToolContext context) => true;

    public async Task<AIToolExecutionResult> ExecuteAsync(
        string argumentsJson,
        AIToolContext context,
        CancellationToken cancellationToken)
    {
        var entitlements = await entitlementService.GetAllAsync(context.UserId);
        return AIToolExecutionResult.Ok(entitlements);
    }
}
