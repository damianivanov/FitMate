using FitMate.Core.JsonModels.Subscriptions;
using FitMate.DB.Enums;
using FitMate.Services.Subscriptions;

namespace FitMate.Tests.TestInfrastructure;

/// <summary>
/// Records reserve/commit/release calls so tests can prove usage is charged exactly once.
/// </summary>
public sealed class FakeUsageService : IUsageService
{
    private long nextReservationId = 1;

    public List<(long UserId, SubscriptionFeature Feature, int Quantity)> Reserved { get; } = [];

    public List<long> Committed { get; } = [];

    public List<long> Released { get; } = [];

    public Exception? ThrowOnReserve { get; set; }

    public Task<UsageReservationModel> ReserveAsync(long userId, SubscriptionFeature feature, int quantity)
    {
        if (ThrowOnReserve != null)
        {
            throw ThrowOnReserve;
        }

        Reserved.Add((userId, feature, quantity));

        return Task.FromResult(new UsageReservationModel
        {
            Id = nextReservationId++,
            Feature = feature,
            Quantity = quantity,
            Status = UsageReservationStatus.Active,
            ExpiresAt = DateTime.UtcNow.AddMinutes(15),
        });
    }

    public Task CommitAsync(long reservationId)
    {
        Committed.Add(reservationId);
        return Task.CompletedTask;
    }

    public Task ReleaseAsync(long reservationId)
    {
        Released.Add(reservationId);
        return Task.CompletedTask;
    }

    public Task ExpireStaleReservationsAsync(long userId) => Task.CompletedTask;
}
