using FitMate.Core.Exceptions;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.Subscriptions;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace FitMate.Tests.Unit.Services;

public class UsageServiceTests
{
    private static UsageService CreateService(SqliteTestDatabase db, IMemoryCache? sharedCache = null)
    {
        using (var seedContext = db.CreateContext())
        {
            SqliteTestDatabase.SeedPlans(seedContext);
        }

        var context = db.CreateContext();
        var cache = sharedCache ?? new MemoryCache(new MemoryCacheOptions());
        return new UsageService(context, new EntitlementService(context, cache));
    }

    // Резервацията създава кофа и запис
    [Fact]
    public async Task Reserve_CreatesBucketAndReservation()
    {
        using var db = new SqliteTestDatabase();
        var service = CreateService(db);

        var reservation = await service.ReserveAsync(SqliteTestDatabase.UserId, SubscriptionFeature.AIChat, 1);

        Assert.Equal(UsageReservationStatus.Active, reservation.Status);
        await using var context = db.CreateContext();
        var bucket = await context.UsageBuckets.SingleAsync();
        Assert.Equal(1, bucket.Reserved);
        Assert.Equal(0, bucket.Used);
        Assert.Equal(10, bucket.EffectiveLimit);
        Assert.Equal(UsageEntryType.Reservation, context.UsageEntries.Single().Type);
    }

    // Commit прехвърля резервираното в използвано
    [Fact]
    public async Task Commit_MovesReservedToUsed()
    {
        using var db = new SqliteTestDatabase();
        var service = CreateService(db);
        var reservation = await service.ReserveAsync(SqliteTestDatabase.UserId, SubscriptionFeature.AIChat, 1);

        await service.CommitAsync(reservation.Id);

        await using var context = db.CreateContext();
        var bucket = await context.UsageBuckets.SingleAsync();
        Assert.Equal(0, bucket.Reserved);
        Assert.Equal(1, bucket.Used);
        Assert.Equal(UsageReservationStatus.Committed, context.UsageReservations.Single().Status);
    }

    // Повторен commit е идемпотентен
    [Fact]
    public async Task Commit_Twice_IsIdempotent()
    {
        using var db = new SqliteTestDatabase();
        var service = CreateService(db);
        var reservation = await service.ReserveAsync(SqliteTestDatabase.UserId, SubscriptionFeature.AIChat, 1);

        await service.CommitAsync(reservation.Id);
        await service.CommitAsync(reservation.Id);

        await using var context = db.CreateContext();
        Assert.Equal(1, (await context.UsageBuckets.SingleAsync()).Used);
    }

    // Release освобождава резервацията
    [Fact]
    public async Task Release_FreesReservation()
    {
        using var db = new SqliteTestDatabase();
        var service = CreateService(db);
        var reservation = await service.ReserveAsync(SqliteTestDatabase.UserId, SubscriptionFeature.AIChat, 1);

        await service.ReleaseAsync(reservation.Id);

        await using var context = db.CreateContext();
        var bucket = await context.UsageBuckets.SingleAsync();
        Assert.Equal(0, bucket.Reserved);
        Assert.Equal(0, bucket.Used);
        Assert.Equal(UsageReservationStatus.Released, context.UsageReservations.Single().Status);
    }

    // Release след commit не намалява използваното
    [Fact]
    public async Task Release_AfterCommit_DoesNotDecrementUsed()
    {
        using var db = new SqliteTestDatabase();
        var service = CreateService(db);
        var reservation = await service.ReserveAsync(SqliteTestDatabase.UserId, SubscriptionFeature.AIChat, 1);
        await service.CommitAsync(reservation.Id);

        await service.ReleaseAsync(reservation.Id);

        await using var context = db.CreateContext();
        var bucket = await context.UsageBuckets.SingleAsync();
        Assert.Equal(1, bucket.Used);
        Assert.Equal(0, bucket.Reserved);
    }

    // Над месечния лимит хвърля 429 изключение със spec §49 тяло
    [Fact]
    public async Task Reserve_BeyondMonthlyLimit_Throws()
    {
        using var db = new SqliteTestDatabase();
        var service = CreateService(db);

        // Free планът дава 2 AI генерации на тренировка месечно.
        var first = await service.ReserveAsync(SqliteTestDatabase.UserId, SubscriptionFeature.AIWorkoutGeneration, 1);
        await service.CommitAsync(first.Id);
        var second = await service.ReserveAsync(SqliteTestDatabase.UserId, SubscriptionFeature.AIWorkoutGeneration, 1);
        await service.CommitAsync(second.Id);

        var exception = await Assert.ThrowsAsync<SubscriptionLimitExceededException>(() =>
            service.ReserveAsync(SqliteTestDatabase.UserId, SubscriptionFeature.AIWorkoutGeneration, 1));

        Assert.Equal("subscription_limit_reached", exception.Details.Code);
        Assert.Equal(2, exception.Details.Limit);
        Assert.Equal(2, exception.Details.Used);
        Assert.True(exception.Details.UpgradeAvailable);
    }

    // Изключена функция хвърля 403 изключение
    [Fact]
    public async Task Reserve_DisabledFeature_Throws()
    {
        using var db = new SqliteTestDatabase();
        var service = CreateService(db);

        await Assert.ThrowsAsync<SubscriptionFeatureDisabledException>(() =>
            service.ReserveAsync(SqliteTestDatabase.UserId, SubscriptionFeature.AIProgramGeneration, 1));
    }

    // Неограничена функция никога не хвърля
    [Fact]
    public async Task Reserve_UnlimitedFeature_NeverThrows()
    {
        using var db = new SqliteTestDatabase();
        await using (var context = db.CreateContext())
        {
            SqliteTestDatabase.SeedPlans(context);
            context.UserSubscriptions.Add(new UserSubscription
            {
                UserId = SqliteTestDatabase.UserId,
                PlanId = SqliteTestDatabase.ProPlanId,
                Status = SubscriptionStatus.Active,
            });
            await context.SaveChangesAsync();
        }
        var service = CreateService(db);

        for (var i = 0; i < 5; i++)
        {
            var reservation = await service.ReserveAsync(
                SqliteTestDatabase.UserId,
                SubscriptionFeature.CustomWorkoutTemplates,
                1);
            await service.CommitAsync(reservation.Id);
        }

        await using var verify = db.CreateContext();
        Assert.Equal(5, (await verify.UsageBuckets.SingleAsync()).Used);
    }

    // Две едновременни резервации за последната единица: минава точно една
    [Fact]
    public async Task Reserve_ConcurrentCallsForLastUnit_OnlyOneSucceeds()
    {
        using var db = new SqliteTestDatabase();
        var cache = new MemoryCache(new MemoryCacheOptions());

        // Free планът дава 2; консумираме едната, за да остане точно една свободна единица.
        var warmup = CreateService(db, cache);
        var used = await warmup.ReserveAsync(SqliteTestDatabase.UserId, SubscriptionFeature.AIWorkoutGeneration, 1);
        await warmup.CommitAsync(used.Id);

        var serviceA = CreateService(db, cache);
        var serviceB = CreateService(db, cache);

        // Двата контекста четат кофата, преди някой да е записал: класическа надпревара.
        var results = await Task.WhenAll(TryReserveAsync(serviceA), TryReserveAsync(serviceB));

        Assert.Equal(1, results.Count(success => success));
        await using var context = db.CreateContext();
        var bucket = await context.UsageBuckets.SingleAsync(x => x.Feature == SubscriptionFeature.AIWorkoutGeneration);
        Assert.True(bucket.Used + bucket.Reserved <= 2);

        static async Task<bool> TryReserveAsync(UsageService service)
        {
            try
            {
                await service.ReserveAsync(SqliteTestDatabase.UserId, SubscriptionFeature.AIWorkoutGeneration, 1);
                return true;
            }
            catch (SubscriptionLimitExceededException)
            {
                return false;
            }
        }
    }

    // Изтеклите резервации се освобождават
    [Fact]
    public async Task ExpireStaleReservations_FreesReservedUnits()
    {
        using var db = new SqliteTestDatabase();
        var service = CreateService(db);
        var reservation = await service.ReserveAsync(SqliteTestDatabase.UserId, SubscriptionFeature.AIChat, 1);

        await using (var context = db.CreateContext())
        {
            var stored = await context.UsageReservations.SingleAsync(x => x.Id == reservation.Id);
            stored.ExpiresAt = DateTime.UtcNow.AddMinutes(-1);
            await context.SaveChangesAsync();
        }

        await service.ExpireStaleReservationsAsync(SqliteTestDatabase.UserId);

        await using var verify = db.CreateContext();
        Assert.Equal(0, (await verify.UsageBuckets.SingleAsync()).Reserved);
        Assert.Equal(UsageReservationStatus.Expired, (await verify.UsageReservations.SingleAsync()).Status);
    }
}
