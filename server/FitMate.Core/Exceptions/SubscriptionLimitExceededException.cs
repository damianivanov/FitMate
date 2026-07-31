using FitMate.Core.JsonModels.Subscriptions;

namespace FitMate.Core.Exceptions;

/// <summary>
/// The feature is included but the quota is exhausted. Maps to HTTP 429.
/// </summary>
public class SubscriptionLimitExceededException : FitMateException
{
    public SubscriptionLimitExceededException(SubscriptionLimitErrorModel details)
        : base($"You have reached your plan limit for {details.Feature}.")
    {
        Details = details;
    }

    public SubscriptionLimitErrorModel Details { get; }
}
