using FitMate.DB.Enums;

namespace FitMate.Core.Exceptions;

/// <summary>
/// The user's plan does not include the feature at all. Maps to HTTP 403.
/// </summary>
public class SubscriptionFeatureDisabledException : FitMateException
{
    public SubscriptionFeatureDisabledException(SubscriptionFeature feature)
        : base($"Your plan does not include {feature}.")
    {
        Feature = feature;
    }

    public SubscriptionFeature Feature { get; }
}
