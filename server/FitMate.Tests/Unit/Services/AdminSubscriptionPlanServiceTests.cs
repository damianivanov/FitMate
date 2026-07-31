using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.AdminSubscriptions;
using FitMate.DB.Constants;
using FitMate.DB.Enums;
using FitMate.Services.AdminSubscriptions;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Tests.Unit.Services;

public class AdminSubscriptionPlanServiceTests
{
    private static SavePlanRequest ValidRequest(string code = "coach") => new()
    {
        Code = code,
        Name = "Coach",
        Description = "For trainers.",
        IsActive = true,
        IsPublic = false,
        SortOrder = 4,
        Prices =
        [
            new PlanPriceRequest
            {
                Currency = "eur",
                Amount = 29.99m,
                BillingInterval = BillingInterval.Monthly,
                StripePriceId = "price_coach_monthly",
            },
        ],
        Entitlements =
        [
            new PlanEntitlementRequest
            {
                Feature = SubscriptionFeature.AIChat,
                IsEnabled = true,
                MonthlyLimit = 1000,
            },
            new PlanEntitlementRequest
            {
                Feature = SubscriptionFeature.ActiveProgramPlans,
                IsEnabled = true,
                HardLimit = 25,
            },
        ],
    };

    // Създаването нормализира кода и валутата
    [Fact]
    public async Task Create_NormalizesCodeAndCurrency()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var service = new AdminSubscriptionPlanService(context);

        var request = ValidRequest("  COACH  ");
        var plan = await service.CreateAsync(request);

        Assert.Equal("coach", plan.Code);
        Assert.Equal("EUR", Assert.Single(plan.Prices).Currency);
        Assert.Equal(2, plan.Entitlements.Count);
    }

    // Дублиран код се отхвърля
    [Fact]
    public async Task Create_DuplicateCode_Throws()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        SqliteTestDatabase.SeedPlans(context);
        var service = new AdminSubscriptionPlanService(context);

        await Assert.ThrowsAsync<FitMateException>(() => service.CreateAsync(ValidRequest(PlanCodes.Plus)));
    }

    // Една и съща функция два пъти прави плана двусмислен
    [Fact]
    public async Task Create_DuplicateFeature_Throws()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var service = new AdminSubscriptionPlanService(context);

        var request = ValidRequest();
        request.Entitlements.Add(new PlanEntitlementRequest
        {
            Feature = SubscriptionFeature.AIChat,
            IsEnabled = false,
        });

        await Assert.ThrowsAsync<FitMateException>(() => service.CreateAsync(request));
    }

    // Две активни цени за същия интервал не са допустими
    [Fact]
    public async Task Create_TwoActivePricesForSameInterval_Throws()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var service = new AdminSubscriptionPlanService(context);

        var request = ValidRequest();
        request.Prices.Add(new PlanPriceRequest
        {
            Currency = "EUR",
            Amount = 24.99m,
            BillingInterval = BillingInterval.Monthly,
            StripePriceId = "price_coach_monthly_discounted",
        });

        await Assert.ThrowsAsync<FitMateException>(() => service.CreateAsync(request));
    }

    // Редакцията заменя правата изцяло
    [Fact]
    public async Task Update_ReplacesEntitlements()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var service = new AdminSubscriptionPlanService(context);
        var created = await service.CreateAsync(ValidRequest());

        var request = ValidRequest();
        request.Entitlements =
        [
            new PlanEntitlementRequest
            {
                Feature = SubscriptionFeature.AIImageGeneration,
                IsEnabled = true,
                MonthlyLimit = 5,
            },
        ];

        var updated = await service.UpdateAsync(created.Id, request);

        var entitlement = Assert.Single(updated.Entitlements);
        Assert.Equal(SubscriptionFeature.AIImageGeneration, entitlement.Feature);
        Assert.Equal(1, await context.PlanEntitlements.CountAsync(x => x.PlanId == created.Id));
    }

    // Деактивирането не изтрива плана
    [Fact]
    public async Task SetActive_KeepsThePlanRow()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var service = new AdminSubscriptionPlanService(context);
        var created = await service.CreateAsync(ValidRequest());

        var deactivated = await service.SetActiveAsync(created.Id, false);

        Assert.False(deactivated.IsActive);
        Assert.True(await context.Plans.AnyAsync(x => x.Id == created.Id));
    }

    // Броят абонати идва от активните абонаменти
    [Fact]
    public async Task List_CountsActiveSubscribers()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        SqliteTestDatabase.SeedPlans(context);
        SqliteTestDatabase.SeedActiveSubscription(context, SqliteTestDatabase.UserId, SqliteTestDatabase.PlusPlanId);

        var plans = await new AdminSubscriptionPlanService(context).ListAsync();

        Assert.Equal(1, plans.Single(x => x.Code == PlanCodes.Plus).SubscriberCount);
        Assert.Equal(0, plans.Single(x => x.Code == PlanCodes.Pro).SubscriberCount);
    }
}
