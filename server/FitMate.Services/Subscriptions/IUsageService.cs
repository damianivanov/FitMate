using FitMate.Core.JsonModels.Subscriptions;
using FitMate.DB.Enums;

namespace FitMate.Services.Subscriptions;

public interface IUsageService
{
    /// <summary>
    /// Reserves quantity against the current month's bucket. Throws
    /// <see cref="Core.Exceptions.SubscriptionFeatureDisabledException"/> (403) when the feature is not in the plan
    /// and <see cref="Core.Exceptions.SubscriptionLimitExceededException"/> (429) when the quota is exhausted.
    /// </summary>
    Task<UsageReservationModel> ReserveAsync(long userId, SubscriptionFeature feature, int quantity);

    /// <summary>Moves Reserved to Used. Idempotent.</summary>
    Task CommitAsync(long reservationId);

    /// <summary>Frees a reservation. Idempotent.</summary>
    Task ReleaseAsync(long reservationId);

    /// <summary>Expires this user's stale reservations and frees the units they held.</summary>
    Task ExpireStaleReservationsAsync(long userId);
}
