using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.Subscriptions;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.Subscriptions;

/// <summary>
/// Reserve → commit/release usage accounting. The bucket carries a concurrency token, so two
/// simultaneous reservations serialize and only one can consume the last unit.
/// </summary>
public class UsageService : IUsageService
{
    private const int MaxConcurrencyRetries = 3;
    private static readonly TimeSpan ReservationLifetime = TimeSpan.FromMinutes(15);

    private readonly AppDbContext dbContext;
    private readonly IEntitlementService entitlementService;

    public UsageService(AppDbContext dbContext, IEntitlementService entitlementService)
    {
        this.dbContext = dbContext;
        this.entitlementService = entitlementService;
    }

    public async Task<UsageReservationModel> ReserveAsync(long userId, SubscriptionFeature feature, int quantity)
    {
        if (quantity <= 0)
        {
            throw new FitMateException("Reservation quantity must be positive.");
        }

        var entitlement = await entitlementService.GetEntitlementAsync(userId, feature);
        if (entitlement is not { IsEnabled: true })
        {
            throw new SubscriptionFeatureDisabledException(feature);
        }

        if (entitlement.MaximumPerRequest is { } perRequest && quantity > perRequest)
        {
            throw new FitMateException($"At most {perRequest} can be requested at once.");
        }

        await ExpireStaleReservationsAsync(userId);

        var limit = entitlement.MonthlyLimit ?? entitlement.HardLimit;
        var period = UsagePeriod.CurrentMonth();

        for (var attempt = 0; attempt < MaxConcurrencyRetries; attempt++)
        {
            var bucket = await GetOrCreateBucketAsync(userId, feature, period, limit);

            if (limit.HasValue && bucket.Used + bucket.Reserved + quantity > limit.Value)
            {
                throw new SubscriptionLimitExceededException(new SubscriptionLimitErrorModel
                {
                    Feature = feature,
                    Limit = limit,
                    Used = bucket.Used,
                    Reserved = bucket.Reserved,
                    ResetsAt = period.ResetsAt,
                    UpgradeAvailable = true,
                });
            }

            var reservation = new UsageReservation
            {
                UserId = userId,
                Feature = feature,
                Quantity = quantity,
                Status = UsageReservationStatus.Active,
                ExpiresAt = DateTime.UtcNow.Add(ReservationLifetime),
            };

            bucket.Reserved += quantity;
            bucket.EffectiveLimit = limit;
            bucket.Version++;
            dbContext.UsageReservations.Add(reservation);

            try
            {
                await dbContext.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                // Someone else changed the bucket first. Drop our pending changes and re-evaluate
                // the limit against fresh numbers.
                dbContext.ChangeTracker.Clear();
                continue;
            }

            dbContext.UsageEntries.Add(new UsageEntry
            {
                UserId = userId,
                Feature = feature,
                UsageReservationId = reservation.Id,
                Quantity = quantity,
                Type = UsageEntryType.Reservation,
            });
            await dbContext.SaveChangesAsync();

            return ToModel(reservation);
        }

        throw new FitMateException("Could not reserve usage because of concurrent requests. Please retry.");
    }

    public Task CommitAsync(long reservationId) => FinalizeAsync(reservationId, commit: true);

    public Task ReleaseAsync(long reservationId) => FinalizeAsync(reservationId, commit: false);

    public async Task ExpireStaleReservationsAsync(long userId)
    {
        var now = DateTime.UtcNow;
        var stale = await dbContext.UsageReservations
            .Where(x => x.UserId == userId
                && x.Status == UsageReservationStatus.Active
                && x.ExpiresAt < now)
            .ToListAsync();

        if (stale.Count == 0)
        {
            return;
        }

        foreach (var reservation in stale)
        {
            reservation.Status = UsageReservationStatus.Expired;
            reservation.FinalizedAt = now;
            await AdjustBucketAsync(reservation, commit: false);

            dbContext.UsageEntries.Add(new UsageEntry
            {
                UserId = reservation.UserId,
                Feature = reservation.Feature,
                UsageReservationId = reservation.Id,
                Quantity = reservation.Quantity,
                Type = UsageEntryType.Release,
            });
        }

        await dbContext.SaveChangesAsync();
    }

    private async Task FinalizeAsync(long reservationId, bool commit)
    {
        var reservation = await dbContext.UsageReservations.FirstOrDefaultAsync(x => x.Id == reservationId);
        if (reservation == null || reservation.Status != UsageReservationStatus.Active)
        {
            return; // idempotent
        }

        reservation.Status = commit ? UsageReservationStatus.Committed : UsageReservationStatus.Released;
        reservation.FinalizedAt = DateTime.UtcNow;
        await AdjustBucketAsync(reservation, commit);

        dbContext.UsageEntries.Add(new UsageEntry
        {
            UserId = reservation.UserId,
            Feature = reservation.Feature,
            UsageReservationId = reservation.Id,
            Quantity = reservation.Quantity,
            Type = commit ? UsageEntryType.Commit : UsageEntryType.Release,
        });

        await dbContext.SaveChangesAsync();
    }

    private async Task AdjustBucketAsync(UsageReservation reservation, bool commit)
    {
        var period = UsagePeriod.ForDate(DateOnly.FromDateTime(reservation.DateCreated));
        var bucket = await dbContext.UsageBuckets.FirstOrDefaultAsync(x =>
            x.UserId == reservation.UserId
            && x.Feature == reservation.Feature
            && x.PeriodStart == period.Start
            && x.PeriodEnd == period.End);

        if (bucket == null)
        {
            return;
        }

        bucket.Reserved = Math.Max(0, bucket.Reserved - reservation.Quantity);
        if (commit)
        {
            bucket.Used += reservation.Quantity;
        }

        bucket.Version++;
    }

    private async Task<UsageBucket> GetOrCreateBucketAsync(
        long userId,
        SubscriptionFeature feature,
        UsagePeriod period,
        int? limit)
    {
        var bucket = await dbContext.UsageBuckets.FirstOrDefaultAsync(x =>
            x.UserId == userId
            && x.Feature == feature
            && x.PeriodStart == period.Start
            && x.PeriodEnd == period.End);

        if (bucket != null)
        {
            return bucket;
        }

        bucket = new UsageBucket
        {
            UserId = userId,
            Feature = feature,
            PeriodStart = period.Start,
            PeriodEnd = period.End,
            EffectiveLimit = limit,
        };
        dbContext.UsageBuckets.Add(bucket);

        try
        {
            await dbContext.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // Lost the create race against a parallel request: reload the winner's row.
            dbContext.ChangeTracker.Clear();
            bucket = await dbContext.UsageBuckets.FirstAsync(x =>
                x.UserId == userId
                && x.Feature == feature
                && x.PeriodStart == period.Start
                && x.PeriodEnd == period.End);
        }

        return bucket;
    }

    private static UsageReservationModel ToModel(UsageReservation reservation) => new()
    {
        Id = reservation.Id,
        Feature = reservation.Feature,
        Quantity = reservation.Quantity,
        Status = reservation.Status,
        ExpiresAt = reservation.ExpiresAt,
    };
}
