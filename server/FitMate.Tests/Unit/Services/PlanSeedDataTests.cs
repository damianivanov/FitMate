using FitMate.DB.Constants;
using FitMate.DB.Enums;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace FitMate.Tests.Unit.Services;

/// <summary>
/// The production seeder reads SeedData/plans.json, but the test host seeds plans directly, so a
/// typo in that file would otherwise only surface at runtime.
/// </summary>
public class PlanSeedDataTests
{
    private sealed class SeedPlan
    {
        public string? Code { get; set; }
        public string? Name { get; set; }
        public bool IsPublic { get; set; }
        public int SortOrder { get; set; }
        public List<SeedEntitlement> Entitlements { get; set; } = [];
    }

    private sealed class SeedEntitlement
    {
        public SubscriptionFeature Feature { get; set; }
        public bool IsEnabled { get; set; }
        public int? MonthlyLimit { get; set; }
        public int? HardLimit { get; set; }
    }

    private static List<SeedPlan> LoadSeedPlans()
    {
        // bin/Debug/net9.0 -> FitMate.Tests -> server
        var path = Path.GetFullPath(Path.Combine(
            AppContext.BaseDirectory,
            "..", "..", "..", "..",
            "FitMate.Web", "SeedData", "plans.json"));

        Assert.True(File.Exists(path), $"Seed file not found at {path}");

        var options = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            Converters = { new JsonStringEnumConverter() },
        };

        return JsonSerializer.Deserialize<List<SeedPlan>>(File.ReadAllText(path), options) ?? [];
    }

    // Файлът се десериализира и съдържа точно трите плана
    [Fact]
    public void PlansJson_ContainsFreePlusAndPro()
    {
        var plans = LoadSeedPlans();

        Assert.Equal(3, plans.Count);
        Assert.Contains(plans, x => x.Code == PlanCodes.Free);
        Assert.Contains(plans, x => x.Code == PlanCodes.Plus);
        Assert.Contains(plans, x => x.Code == PlanCodes.Pro);
    }

    // Всеки план описва всяка функция: липсваща означава мълчаливо забранена
    [Fact]
    public void PlansJson_EveryPlanCoversEverySubscriptionFeature()
    {
        var plans = LoadSeedPlans();
        var allFeatures = Enum.GetValues<SubscriptionFeature>();

        foreach (var plan in plans)
        {
            var features = plan.Entitlements.Select(x => x.Feature).ToList();
            Assert.Equal(features.Count, features.Distinct().Count());

            foreach (var feature in allFeatures)
            {
                Assert.Contains(feature, features);
            }
        }
    }

    // Кодовете и имената са попълнени, а лимитите не са отрицателни
    [Fact]
    public void PlansJson_HasValidCodesAndLimits()
    {
        var plans = LoadSeedPlans();

        foreach (var plan in plans)
        {
            Assert.False(string.IsNullOrWhiteSpace(plan.Code));
            Assert.False(string.IsNullOrWhiteSpace(plan.Name));
            Assert.Equal(plan.Code, plan.Code!.ToLowerInvariant());

            foreach (var entitlement in plan.Entitlements)
            {
                Assert.True(entitlement.MonthlyLimit is null or >= 0);
                Assert.True(entitlement.HardLimit is null or >= 0);

                // A disabled feature must not also carry a limit: that reads as contradictory.
                if (!entitlement.IsEnabled)
                {
                    Assert.Null(entitlement.MonthlyLimit);
                    Assert.Null(entitlement.HardLimit);
                }
            }
        }
    }

    // Free е по-ограничен от Plus, а Plus от Pro
    [Fact]
    public void PlansJson_TiersIncreaseInGenerosity()
    {
        var plans = LoadSeedPlans().ToDictionary(x => x.Code!, x => x);

        foreach (var feature in Enum.GetValues<SubscriptionFeature>())
        {
            var free = Limit(plans[PlanCodes.Free], feature);
            var plus = Limit(plans[PlanCodes.Plus], feature);
            var pro = Limit(plans[PlanCodes.Pro], feature);

            // null means unlimited, so it sorts above every number.
            Assert.True(IsAtLeast(plus, free), $"Plus must not be stingier than Free for {feature}.");
            Assert.True(IsAtLeast(pro, plus), $"Pro must not be stingier than Plus for {feature}.");
        }

        static int? Limit(SeedPlan plan, SubscriptionFeature feature)
        {
            var entitlement = plan.Entitlements.Single(x => x.Feature == feature);
            return entitlement.IsEnabled ? entitlement.MonthlyLimit ?? entitlement.HardLimit : 0;
        }

        static bool IsAtLeast(int? candidate, int? baseline) =>
            candidate is null || (baseline is not null && candidate >= baseline);
    }
}
