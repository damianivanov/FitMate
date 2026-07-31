using FitMate.Core.Exceptions;
using FitMate.DB.Constants;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.Subscriptions;
using FitMate.Tests.TestInfrastructure;
using Microsoft.Extensions.Caching.Memory;

namespace FitMate.Tests.Unit.Services;

public class EntitlementServiceTests
{
    private static EntitlementService CreateService(SqliteTestDatabase db)
    {
        using (var seedContext = db.CreateContext())
        {
            SqliteTestDatabase.SeedPlans(seedContext);
        }

        return new EntitlementService(db.CreateContext(), new MemoryCache(new MemoryCacheOptions()));
    }

    private static async Task GiveSubscriptionAsync(
        SqliteTestDatabase db,
        long userId,
        long planId,
        SubscriptionStatus status)
    {
        await using var context = db.CreateContext();
        SqliteTestDatabase.SeedPlans(context); // the subscription's plan FK must already exist
        context.UserSubscriptions.Add(new UserSubscription
        {
            UserId = userId,
            PlanId = planId,
            Status = status,
        });
        await context.SaveChangesAsync();
    }

    // Без абонамент потребителят пада към Free плана
    [Fact]
    public async Task GetAll_NoSubscription_FallsBackToFreePlan()
    {
        using var db = new SqliteTestDatabase();
        var service = CreateService(db);

        var entitlements = await service.GetAllAsync(SqliteTestDatabase.UserId);

        Assert.Equal(PlanCodes.Free, entitlements.PlanCode);
        Assert.Equal(EntitlementSource.FreePlan, entitlements.Source);
        Assert.Equal(10, entitlements.Features.Single(x => x.Feature == SubscriptionFeature.AIChat).Limit);
    }

    // Активен абонамент дава плана на абонамента
    [Fact]
    public async Task GetAll_ActiveSubscription_UsesSubscribedPlan()
    {
        using var db = new SqliteTestDatabase();
        await GiveSubscriptionAsync(db, SqliteTestDatabase.UserId, SqliteTestDatabase.PlusPlanId, SubscriptionStatus.Active);
        var service = CreateService(db);

        var entitlements = await service.GetAllAsync(SqliteTestDatabase.UserId);

        Assert.Equal(PlanCodes.Plus, entitlements.PlanCode);
        Assert.Equal(EntitlementSource.Subscription, entitlements.Source);
    }

    // Отказан абонамент не дава права
    [Fact]
    public async Task GetAll_CancelledSubscription_FallsBackToFree()
    {
        using var db = new SqliteTestDatabase();
        await GiveSubscriptionAsync(db, SqliteTestDatabase.UserId, SqliteTestDatabase.ProPlanId, SubscriptionStatus.Cancelled);
        var service = CreateService(db);

        var entitlements = await service.GetAllAsync(SqliteTestDatabase.UserId);

        Assert.Equal(PlanCodes.Free, entitlements.PlanCode);
    }

    // Админ override бие активния абонамент
    [Fact]
    public async Task GetAll_ActiveOverride_BeatsSubscription()
    {
        using var db = new SqliteTestDatabase();
        await GiveSubscriptionAsync(db, SqliteTestDatabase.UserId, SqliteTestDatabase.PlusPlanId, SubscriptionStatus.Active);
        await using (var context = db.CreateContext())
        {
            SqliteTestDatabase.SeedPlans(context);
            context.UserPlanOverrides.Add(new UserPlanOverride
            {
                UserId = SqliteTestDatabase.UserId,
                PlanId = SqliteTestDatabase.ProPlanId,
                CreatedByUserId = SqliteTestDatabase.AdminUserId,
                Reason = "Beta tester",
                StartsAt = DateTime.UtcNow.AddDays(-1),
                IsActive = true,
            });
            await context.SaveChangesAsync();
        }
        var service = CreateService(db);

        var entitlements = await service.GetAllAsync(SqliteTestDatabase.UserId);

        Assert.Equal(PlanCodes.Pro, entitlements.PlanCode);
        Assert.Equal(EntitlementSource.AdminOverride, entitlements.Source);
    }

    // Изтекъл override се игнорира
    [Fact]
    public async Task GetAll_ExpiredOverride_Ignored()
    {
        using var db = new SqliteTestDatabase();
        await using (var context = db.CreateContext())
        {
            SqliteTestDatabase.SeedPlans(context);
            context.UserPlanOverrides.Add(new UserPlanOverride
            {
                UserId = SqliteTestDatabase.UserId,
                PlanId = SqliteTestDatabase.ProPlanId,
                CreatedByUserId = SqliteTestDatabase.AdminUserId,
                Reason = "Expired trial",
                StartsAt = DateTime.UtcNow.AddDays(-10),
                EndsAt = DateTime.UtcNow.AddDays(-1),
                IsActive = true,
            });
            await context.SaveChangesAsync();
        }
        var service = CreateService(db);

        var entitlements = await service.GetAllAsync(SqliteTestDatabase.UserId);

        Assert.Equal(PlanCodes.Free, entitlements.PlanCode);
    }

    // Изключена функция на Free плана хвърля 403 изключение
    [Fact]
    public async Task RequireFeature_DisabledOnFreePlan_Throws()
    {
        using var db = new SqliteTestDatabase();
        var service = CreateService(db);

        await Assert.ThrowsAsync<SubscriptionFeatureDisabledException>(() =>
            service.RequireFeatureAsync(SqliteTestDatabase.UserId, SubscriptionFeature.AIProgramGeneration));
    }

    // Включена функция минава без изключение
    [Fact]
    public async Task RequireFeature_EnabledFeature_DoesNotThrow()
    {
        using var db = new SqliteTestDatabase();
        var service = CreateService(db);

        await service.RequireFeatureAsync(SqliteTestDatabase.UserId, SubscriptionFeature.AIChat);
    }

    // Наличността отчита използваното и резервираното
    [Fact]
    public async Task GetAvailability_WithExistingUsage_ReportsRemaining()
    {
        using var db = new SqliteTestDatabase();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        await using (var context = db.CreateContext())
        {
            SqliteTestDatabase.SeedPlans(context);
            context.UsageBuckets.Add(new UsageBucket
            {
                UserId = SqliteTestDatabase.UserId,
                Feature = SubscriptionFeature.AIChat,
                PeriodStart = new DateOnly(today.Year, today.Month, 1),
                PeriodEnd = new DateOnly(today.Year, today.Month, 1).AddMonths(1).AddDays(-1),
                Used = 3,
                Reserved = 1,
            });
            await context.SaveChangesAsync();
        }
        var service = CreateService(db);

        var availability = await service.GetAvailabilityAsync(SqliteTestDatabase.UserId, SubscriptionFeature.AIChat);

        Assert.True(availability.IsEnabled);
        Assert.Equal(10, availability.Limit);
        Assert.Equal(3, availability.Used);
        Assert.Equal(1, availability.Reserved);
        Assert.Equal(6, availability.Remaining);
        Assert.NotNull(availability.ResetsAt);
    }

    // Неограничена функция няма лимит и остатък
    [Fact]
    public async Task GetAvailability_UnlimitedFeatureOnPro_HasNullLimitAndRemaining()
    {
        using var db = new SqliteTestDatabase();
        await GiveSubscriptionAsync(db, SqliteTestDatabase.UserId, SqliteTestDatabase.ProPlanId, SubscriptionStatus.Active);
        var service = CreateService(db);

        var availability = await service.GetAvailabilityAsync(
            SqliteTestDatabase.UserId,
            SubscriptionFeature.CustomWorkoutTemplates);

        Assert.True(availability.IsEnabled);
        Assert.Null(availability.Limit);
        Assert.Null(availability.Remaining);
    }
}
