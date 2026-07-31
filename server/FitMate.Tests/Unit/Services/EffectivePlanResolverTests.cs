using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.Subscriptions;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Tests.Unit.Services;

public class EffectivePlanResolverTests
{
    private static async Task<ResolvedPlan> ResolveAsync(AppDbContext context, long userId)
    {
        var resolved = await new EffectivePlanResolver(context).ResolveManyAsync([userId]);
        return resolved[userId];
    }

    private static UserPlanOverride NewOverride(long userId, long planId, bool isActive = true) => new()
    {
        UserId = userId,
        PlanId = planId,
        CreatedByUserId = SqliteTestDatabase.AdminUserId,
        Reason = "support case",
        StartsAt = DateTime.UtcNow.AddDays(-1),
        IsActive = isActive,
    };

    private static UserSubscription NewSubscription(
        long userId,
        long planId,
        SubscriptionStatus status = SubscriptionStatus.Active) => new()
    {
        UserId = userId,
        PlanId = planId,
        Status = status,
    };

    [Fact]
    public async Task NoOverrideAndNoSubscription_ResolvesToFree()
    {
        using var database = new SqliteTestDatabase();
        using var context = database.CreateContext();
        SqliteTestDatabase.SeedPlans(context);
        await context.SaveChangesAsync();

        var resolved = await ResolveAsync(context, SqliteTestDatabase.UserId);

        Assert.Equal("free", resolved.EffectivePlanCode);
        Assert.Equal(EntitlementSource.FreePlan, resolved.Source);
        Assert.Null(resolved.ActiveOverrideId);
    }

    [Fact]
    public async Task ActiveSubscription_WinsOverFree()
    {
        using var database = new SqliteTestDatabase();
        using var context = database.CreateContext();
        SqliteTestDatabase.SeedPlans(context);
        context.UserSubscriptions.Add(
            NewSubscription(SqliteTestDatabase.UserId, SqliteTestDatabase.PlusPlanId));
        await context.SaveChangesAsync();

        var resolved = await ResolveAsync(context, SqliteTestDatabase.UserId);

        Assert.Equal("plus", resolved.EffectivePlanCode);
        Assert.Equal(EntitlementSource.Subscription, resolved.Source);
    }

    [Fact]
    public async Task ActiveOverride_WinsOverActiveSubscription()
    {
        using var database = new SqliteTestDatabase();
        using var context = database.CreateContext();
        SqliteTestDatabase.SeedPlans(context);
        context.UserSubscriptions.Add(
            NewSubscription(SqliteTestDatabase.UserId, SqliteTestDatabase.PlusPlanId));
        context.UserPlanOverrides.Add(
            NewOverride(SqliteTestDatabase.UserId, SqliteTestDatabase.ProPlanId));
        await context.SaveChangesAsync();

        var resolved = await ResolveAsync(context, SqliteTestDatabase.UserId);

        Assert.Equal("pro", resolved.EffectivePlanCode);
        Assert.Equal(EntitlementSource.AdminOverride, resolved.Source);
        Assert.NotNull(resolved.ActiveOverrideId);
    }

    [Fact]
    public async Task ExpiredOverride_IsIgnored()
    {
        using var database = new SqliteTestDatabase();
        using var context = database.CreateContext();
        SqliteTestDatabase.SeedPlans(context);

        var expired = NewOverride(SqliteTestDatabase.UserId, SqliteTestDatabase.ProPlanId);
        expired.EndsAt = DateTime.UtcNow.AddHours(-1);
        context.UserPlanOverrides.Add(expired);
        await context.SaveChangesAsync();

        var resolved = await ResolveAsync(context, SqliteTestDatabase.UserId);

        Assert.Equal("free", resolved.EffectivePlanCode);
        Assert.Equal(EntitlementSource.FreePlan, resolved.Source);
    }

    // Mirrors the safety net in EntitlementService: switching a plan off in the admin panel must
    // never leave anyone holding it, or deactivating Pro would silently promote its users.
    [Fact]
    public async Task DeactivatedOverridePlan_FallsBackToFree()
    {
        using var database = new SqliteTestDatabase();
        using var context = database.CreateContext();
        SqliteTestDatabase.SeedPlans(context);

        var proPlan = await context.Plans.FirstAsync(x => x.Id == SqliteTestDatabase.ProPlanId);
        proPlan.IsActive = false;
        context.UserPlanOverrides.Add(
            NewOverride(SqliteTestDatabase.UserId, SqliteTestDatabase.ProPlanId));
        await context.SaveChangesAsync();

        var resolved = await ResolveAsync(context, SqliteTestDatabase.UserId);

        Assert.Equal("free", resolved.EffectivePlanCode);
        Assert.Equal(EntitlementSource.FreePlan, resolved.Source);
    }

    [Fact]
    public async Task ResolvesEveryRequestedUserInOneCall()
    {
        using var database = new SqliteTestDatabase();
        using var context = database.CreateContext();
        SqliteTestDatabase.SeedPlans(context);
        context.UserPlanOverrides.Add(
            NewOverride(SqliteTestDatabase.UserId, SqliteTestDatabase.ProPlanId));
        context.UserSubscriptions.Add(
            NewSubscription(SqliteTestDatabase.OtherUserId, SqliteTestDatabase.PlusPlanId));
        await context.SaveChangesAsync();

        var resolved = await new EffectivePlanResolver(context).ResolveManyAsync(
            [SqliteTestDatabase.UserId, SqliteTestDatabase.OtherUserId, SqliteTestDatabase.AdminUserId]);

        Assert.Equal(3, resolved.Count);
        Assert.Equal(EntitlementSource.AdminOverride, resolved[SqliteTestDatabase.UserId].Source);
        Assert.Equal(EntitlementSource.Subscription, resolved[SqliteTestDatabase.OtherUserId].Source);
        Assert.Equal(EntitlementSource.FreePlan, resolved[SqliteTestDatabase.AdminUserId].Source);
    }

    [Fact]
    public async Task EmptyUserList_ReturnsEmptyWithoutQuerying()
    {
        using var database = new SqliteTestDatabase();
        using var context = database.CreateContext();

        var resolved = await new EffectivePlanResolver(context).ResolveManyAsync([]);

        Assert.Empty(resolved);
    }
}
