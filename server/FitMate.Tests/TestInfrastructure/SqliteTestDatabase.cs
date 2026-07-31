using FitMate.DB;
using FitMate.DB.Constants;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Tests.TestInfrastructure;

public sealed class SqliteTestDatabase : IDisposable
{
    public const long UserId = 1;
    public const long OtherUserId = 2;
    public const long AdminUserId = 3;

    public const long FreePlanId = 101;
    public const long PlusPlanId = 102;
    public const long ProPlanId = 103;

    public const long ChestId = 1;
    public const long BackId = 2;
    public const long LegsId = 3;

    private readonly SqliteConnection connection;
    private readonly DbContextOptions<AppDbContext> options;

    public SqliteTestDatabase()
    {
        connection = new SqliteConnection("DataSource=:memory:");
        connection.Open();

        options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(connection)
            .Options;

        using var context = new AppDbContext(options);
        context.Database.EnsureCreated();
        Seed(context);
    }

    public AppDbContext CreateContext() => new(options);

    private static void Seed(AppDbContext context)
    {
        context.Users.AddRange(
            NewUser(UserId, "user@test.local"),
            NewUser(OtherUserId, "other@test.local"),
            NewUser(AdminUserId, "admin@test.local"));

        context.MuscleGroups.AddRange(
            new MuscleGroup { Id = ChestId, Name = "Chest" },
            new MuscleGroup { Id = BackId, Name = "Back" },
            new MuscleGroup { Id = LegsId, Name = "Legs" });

        context.SaveChanges();
    }

    private static User NewUser(long id, string email) => new()
    {
        Id = id,
        Email = email,
        NormalizedEmail = email.ToUpperInvariant(),
        UserName = email,
        NormalizedUserName = email.ToUpperInvariant(),
        FirstName = "Test",
        LastName = $"User{id}",
    };

    /// <summary>
    /// Seeds Free/Plus/Pro with the same entitlement values as SeedData/plans.json. Call explicitly
    /// from tests that need subscription resolution; the default seed stays plan-free.
    /// </summary>
    public static void SeedPlans(AppDbContext context)
    {
        if (context.Plans.Any())
        {
            return;
        }

        context.Plans.AddRange(
            NewPlan(FreePlanId, PlanCodes.Free, "Free", 1,
                (SubscriptionFeature.AIChat, true, 10, null),
                (SubscriptionFeature.AIWorkoutGeneration, true, 2, null),
                (SubscriptionFeature.AIProgramGeneration, false, null, null),
                (SubscriptionFeature.AIExerciseRecognition, false, null, null),
                (SubscriptionFeature.AIImageGeneration, false, null, null),
                (SubscriptionFeature.AITrainingAnalysis, true, 1, null),
                (SubscriptionFeature.ActiveProgramPlans, true, null, 1),
                (SubscriptionFeature.ProgramPlanDurationMonths, true, null, 1),
                (SubscriptionFeature.CustomWorkoutTemplates, true, null, 5),
                (SubscriptionFeature.ExerciseHistoryMonths, true, null, 1)),
            NewPlan(PlusPlanId, PlanCodes.Plus, "Plus", 2,
                (SubscriptionFeature.AIChat, true, 100, null),
                (SubscriptionFeature.AIWorkoutGeneration, true, 15, null),
                (SubscriptionFeature.AIProgramGeneration, true, 2, null),
                (SubscriptionFeature.AIExerciseRecognition, true, 10, null),
                (SubscriptionFeature.AIImageGeneration, true, 5, null),
                (SubscriptionFeature.AITrainingAnalysis, true, 10, null),
                (SubscriptionFeature.ActiveProgramPlans, true, null, 3),
                (SubscriptionFeature.ProgramPlanDurationMonths, true, null, 6),
                (SubscriptionFeature.CustomWorkoutTemplates, true, null, 50),
                (SubscriptionFeature.ExerciseHistoryMonths, true, null, 12)),
            NewPlan(ProPlanId, PlanCodes.Pro, "Pro", 3,
                (SubscriptionFeature.AIChat, true, 500, null),
                (SubscriptionFeature.AIWorkoutGeneration, true, 60, null),
                (SubscriptionFeature.AIProgramGeneration, true, 10, null),
                (SubscriptionFeature.AIExerciseRecognition, true, 50, null),
                (SubscriptionFeature.AIImageGeneration, true, 25, null),
                (SubscriptionFeature.AITrainingAnalysis, true, 50, null),
                (SubscriptionFeature.ActiveProgramPlans, true, null, 10),
                (SubscriptionFeature.ProgramPlanDurationMonths, true, null, 12),
                (SubscriptionFeature.CustomWorkoutTemplates, true, null, null),
                (SubscriptionFeature.ExerciseHistoryMonths, true, null, null)));

        context.SaveChanges();
    }

    /// <summary>Gives the user an active subscription, so entitlement resolution stops at Free.</summary>
    public static void SeedActiveSubscription(AppDbContext context, long userId, long planId)
    {
        context.UserSubscriptions.Add(new UserSubscription
        {
            UserId = userId,
            PlanId = planId,
            Status = SubscriptionStatus.Active,
            CurrentPeriodStart = DateTime.UtcNow.AddDays(-1),
            CurrentPeriodEnd = DateTime.UtcNow.AddDays(29),
        });

        context.SaveChanges();
    }

    private static Plan NewPlan(
        long id,
        string code,
        string name,
        int sortOrder,
        params (SubscriptionFeature Feature, bool IsEnabled, int? MonthlyLimit, int? HardLimit)[] entitlements) => new()
    {
        Id = id,
        Code = code,
        Name = name,
        IsActive = true,
        IsPublic = true,
        SortOrder = sortOrder,
        Entitlements = entitlements
            .Select(x => new PlanEntitlement
            {
                Feature = x.Feature,
                IsEnabled = x.IsEnabled,
                MonthlyLimit = x.MonthlyLimit,
                HardLimit = x.HardLimit,
            })
            .ToList(),
    };

    public void Dispose() => connection.Dispose();
}
