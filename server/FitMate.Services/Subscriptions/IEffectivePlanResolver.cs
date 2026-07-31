using FitMate.DB.Enums;

namespace FitMate.Services.Subscriptions;

public record ResolvedPlan(
    string EffectivePlanCode,
    string EffectivePlanName,
    EntitlementSource Source,
    long? ActiveOverrideId);

/// <summary>
/// Batch form of the plan-resolution rule used by admin reads: active override, then active
/// subscription, then Free. Set-based so a page of users costs a fixed number of queries.
/// </summary>
public interface IEffectivePlanResolver
{
    Task<IReadOnlyDictionary<long, ResolvedPlan>> ResolveManyAsync(IReadOnlyCollection<long> userIds);
}
