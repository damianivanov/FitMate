using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.AdminSubscriptions;
using FitMate.DB;
using FitMate.DB.Constants;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.AdminSubscriptions;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Tests.Unit.Services;

public class AdminSubscriptionServiceTests
{
    private const long AdminId = SqliteTestDatabase.AdminUserId;

    private static AdminSubscriptionService CreateService(AppDbContext context) =>
        new(context, new FakeEntitlementService());

    private static void SeedSubscription(AppDbContext context, long userId, long planId)
    {
        SqliteTestDatabase.SeedActiveSubscription(context, userId, planId);
    }

    // Без нищо друго потребителят е на безплатния план
    [Fact]
    public async Task GetByUserId_NoSubscription_ResolvesToFreePlan()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        SqliteTestDatabase.SeedPlans(context);

        var model = await CreateService(context).GetByUserIdAsync(SqliteTestDatabase.UserId);

        Assert.NotNull(model);
        Assert.Equal(PlanCodes.Free, model.EffectivePlanCode);
        Assert.Equal(EntitlementSource.FreePlan, model.Source);
        Assert.Null(model.ActiveOverride);
    }

    // Активният абонамент определя плана
    [Fact]
    public async Task GetByUserId_ActiveSubscription_ResolvesToThatPlan()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        SqliteTestDatabase.SeedPlans(context);
        SeedSubscription(context, SqliteTestDatabase.UserId, SqliteTestDatabase.PlusPlanId);

        var model = await CreateService(context).GetByUserIdAsync(SqliteTestDatabase.UserId);

        Assert.Equal(PlanCodes.Plus, model!.EffectivePlanCode);
        Assert.Equal(EntitlementSource.Subscription, model.Source);
        Assert.Equal(SubscriptionStatus.Active, model.SubscriptionStatus);
    }

    // Админ override-ът бие платения абонамент
    [Fact]
    public async Task AssignOverride_BeatsActiveSubscription()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        SqliteTestDatabase.SeedPlans(context);
        SeedSubscription(context, SqliteTestDatabase.UserId, SqliteTestDatabase.PlusPlanId);
        var service = CreateService(context);

        var model = await service.AssignOverrideAsync(
            SqliteTestDatabase.UserId,
            new AssignPlanOverrideRequest { PlanCode = PlanCodes.Pro, Reason = "Support case #12" },
            AdminId);

        Assert.Equal(PlanCodes.Pro, model.EffectivePlanCode);
        Assert.Equal(EntitlementSource.AdminOverride, model.Source);
        Assert.Equal("Support case #12", model.ActiveOverride!.Reason);

        // Абонаментът остава видим, за да се знае какво ще важи после
        Assert.Equal(SubscriptionStatus.Active, model.SubscriptionStatus);
    }

    // Второ назначение затваря първото
    [Fact]
    public async Task AssignOverride_Twice_KeepsOnlyOneActive()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        SqliteTestDatabase.SeedPlans(context);
        var service = CreateService(context);

        await service.AssignOverrideAsync(
            SqliteTestDatabase.UserId,
            new AssignPlanOverrideRequest { PlanCode = PlanCodes.Plus, Reason = "Trial" },
            AdminId);
        var model = await service.AssignOverrideAsync(
            SqliteTestDatabase.UserId,
            new AssignPlanOverrideRequest { PlanCode = PlanCodes.Pro, Reason = "Upgraded trial" },
            AdminId);

        Assert.Equal(PlanCodes.Pro, model.EffectivePlanCode);
        Assert.Equal(
            1,
            await context.UserPlanOverrides.CountAsync(x => x.UserId == SqliteTestDatabase.UserId && x.IsActive));

        // Предишният план се записва, за да е ясна историята
        var replaced = await context.UserPlanOverrides
            .OrderBy(x => x.Id)
            .FirstAsync(x => x.UserId == SqliteTestDatabase.UserId);
        Assert.False(replaced.IsActive);
        Assert.NotNull(replaced.EndsAt);
    }

    // Изтеклият override не важи
    [Fact]
    public async Task GetByUserId_ExpiredOverride_FallsBackToSubscription()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        SqliteTestDatabase.SeedPlans(context);
        SeedSubscription(context, SqliteTestDatabase.UserId, SqliteTestDatabase.PlusPlanId);

        context.UserPlanOverrides.Add(new UserPlanOverride
        {
            UserId = SqliteTestDatabase.UserId,
            PlanId = SqliteTestDatabase.ProPlanId,
            CreatedByUserId = AdminId,
            Reason = "Expired trial",
            StartsAt = DateTime.UtcNow.AddDays(-10),
            EndsAt = DateTime.UtcNow.AddDays(-1),
            IsActive = true,
        });
        await context.SaveChangesAsync();

        var model = await CreateService(context).GetByUserIdAsync(SqliteTestDatabase.UserId);

        Assert.Equal(PlanCodes.Plus, model!.EffectivePlanCode);
        Assert.Equal(EntitlementSource.Subscription, model.Source);
    }

    // Премахването връща потребителя на реалния му план
    [Fact]
    public async Task RemoveOverride_RestoresSubscription()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        SqliteTestDatabase.SeedPlans(context);
        SeedSubscription(context, SqliteTestDatabase.UserId, SqliteTestDatabase.PlusPlanId);
        var service = CreateService(context);
        await service.AssignOverrideAsync(
            SqliteTestDatabase.UserId,
            new AssignPlanOverrideRequest { PlanCode = PlanCodes.Pro, Reason = "Support case" },
            AdminId);

        var model = await service.RemoveOverrideAsync(SqliteTestDatabase.UserId);

        Assert.Equal(PlanCodes.Plus, model.EffectivePlanCode);
        Assert.Null(model.ActiveOverride);
    }

    // Override без причина не се приема
    [Fact]
    public async Task AssignOverride_WithoutReason_Throws()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        SqliteTestDatabase.SeedPlans(context);

        await Assert.ThrowsAsync<FitMateException>(() =>
            CreateService(context).AssignOverrideAsync(
                SqliteTestDatabase.UserId,
                new AssignPlanOverrideRequest { PlanCode = PlanCodes.Pro, Reason = "  " },
                AdminId));
    }

    // Несъществуващ план не се приема
    [Fact]
    public async Task AssignOverride_UnknownPlan_Throws()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        SqliteTestDatabase.SeedPlans(context);

        await Assert.ThrowsAsync<FitMateException>(() =>
            CreateService(context).AssignOverrideAsync(
                SqliteTestDatabase.UserId,
                new AssignPlanOverrideRequest { PlanCode = "platinum", Reason = "Nice try" },
                AdminId));
    }

    // Филтърът за override показва само засегнатите потребители
    [Fact]
    public async Task List_OverriddenOnly_ReturnsOnlyOverriddenUsers()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        SqliteTestDatabase.SeedPlans(context);
        var service = CreateService(context);
        await service.AssignOverrideAsync(
            SqliteTestDatabase.UserId,
            new AssignPlanOverrideRequest { PlanCode = PlanCodes.Pro, Reason = "Staff" },
            AdminId);

        var response = await service.ListAsync(new SubscriptionQueryRequest { OverriddenOnly = true });

        Assert.Equal(SqliteTestDatabase.UserId, Assert.Single(response.Items).UserId);
    }

    // Нулирането изчиства употребата за периода
    [Fact]
    public async Task ResetUsage_ZeroesTheBucket()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var bucket = new UsageBucket
        {
            UserId = SqliteTestDatabase.UserId,
            Feature = SubscriptionFeature.AIChat,
            PeriodStart = new DateOnly(today.Year, today.Month, 1),
            PeriodEnd = new DateOnly(today.Year, today.Month, 1).AddMonths(1).AddDays(-1),
            Used = 9,
            Reserved = 1,
            EffectiveLimit = 10,
        };
        context.UsageBuckets.Add(bucket);
        await context.SaveChangesAsync();

        var model = await CreateService(context).ResetUsageAsync(bucket.Id);

        Assert.Equal(0, model.Used);
        Assert.Equal(0, model.Reserved);
        Assert.Equal(10, model.EffectiveLimit);
    }
}
