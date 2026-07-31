using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.ProgramPlans;
using FitMate.Core.JsonModels.WorkoutTemplates;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.ProgramPlans.Days;
using FitMate.Services.ProgramPlans.Plans;
using FitMate.Services.ProgramPlans.Schedules;
using FitMate.Services.Subscriptions;
using FitMate.Services.WorkoutTemplates;
using FitMate.Services.Workouts;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace FitMate.Tests.Unit.Services;

/// <summary>
/// Limits come from the seeded plans through the real EntitlementService, so these tests prove the
/// numbers are database-driven rather than hardcoded in the domain services.
/// </summary>
public class SubscriptionLimitIntegrationTests
{
    private static EntitlementService CreateEntitlements(AppDbContext context) =>
        new(context, new MemoryCache(new MemoryCacheOptions()));

    private static ProgramPlanService CreateProgramPlanService(SqliteTestDatabase db)
    {
        using (var seedContext = db.CreateContext())
        {
            SqliteTestDatabase.SeedPlans(seedContext);
        }

        var context = db.CreateContext();
        var entitlements = CreateEntitlements(context);
        var workoutService = new WorkoutService(context, new FakePhotoUrlResolver(), entitlements);
        var dayService = new ProgramPlanDayService(context, workoutService, new ProgramPlanScheduleService());

        return new ProgramPlanService(context, new ProgramPlanScheduleService(), dayService, entitlements);
    }

    private static async Task<long> SeedTemplateAsync(SqliteTestDatabase db, long userId, string name)
    {
        await using var context = db.CreateContext();
        var template = new WorkoutTemplate { UserId = userId, Name = name, IsPublic = false };
        context.WorkoutTemplates.Add(template);
        await context.SaveChangesAsync();
        return template.Id;
    }

    private static SaveProgramPlanRequest PlanRequest(long templateId, DateOnly start, DateOnly? end) => new()
    {
        Name = "Limit test",
        Goal = TrainingGoal.Hypertrophy,
        ScheduleType = ProgramScheduleType.FixedWeekdays,
        StartDate = start,
        EndDate = end,
        TargetWorkoutsPerWeek = 1,
        ScheduleRules =
        [
            new ProgramScheduleRuleRequest
            {
                DayOfWeek = DayOfWeek.Monday,
                DayType = ProgramPlanDayType.Workout,
                WorkoutTemplateId = templateId,
                OrderIndex = 0,
            },
        ],
    };

    // Free планът позволява само един активен план
    [Fact]
    public async Task Activate_SecondPlanOnFreePlan_ThrowsLimitException()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var service = CreateProgramPlanService(db);
        var start = new DateOnly(2026, 8, 3);

        var first = await service.CreateDraftAsync(PlanRequest(templateId, start, start.AddDays(21)), SqliteTestDatabase.UserId);
        await service.ActivateAsync(first.Id, SqliteTestDatabase.UserId);
        var second = await service.CreateDraftAsync(PlanRequest(templateId, start, start.AddDays(21)), SqliteTestDatabase.UserId);

        await Assert.ThrowsAsync<SubscriptionLimitExceededException>(() =>
            service.ActivateAsync(second.Id, SqliteTestDatabase.UserId));
    }

    // Free планът ограничава продължителността до 1 месец
    [Fact]
    public async Task Activate_ThreeMonthPlanOnFreePlan_ThrowsLimitException()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var service = CreateProgramPlanService(db);
        var start = new DateOnly(2026, 8, 3);

        var plan = await service.CreateDraftAsync(PlanRequest(templateId, start, start.AddMonths(3)), SqliteTestDatabase.UserId);

        var exception = await Assert.ThrowsAsync<SubscriptionLimitExceededException>(() =>
            service.ActivateAsync(plan.Id, SqliteTestDatabase.UserId));
        Assert.Equal(SubscriptionFeature.ProgramPlanDurationMonths, exception.Details.Feature);
    }

    // Plus планът позволява 3-месечен план
    [Fact]
    public async Task Activate_ThreeMonthPlanOnPlusPlan_Succeeds()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        await using (var context = db.CreateContext())
        {
            SqliteTestDatabase.SeedPlans(context);
            context.UserSubscriptions.Add(new UserSubscription
            {
                UserId = SqliteTestDatabase.UserId,
                PlanId = SqliteTestDatabase.PlusPlanId,
                Status = SubscriptionStatus.Active,
            });
            await context.SaveChangesAsync();
        }

        var service = CreateProgramPlanService(db);
        var start = new DateOnly(2026, 8, 3);

        var plan = await service.CreateDraftAsync(PlanRequest(templateId, start, start.AddMonths(3)), SqliteTestDatabase.UserId);
        var activated = await service.ActivateAsync(plan.Id, SqliteTestDatabase.UserId);

        Assert.Equal(ProgramPlanStatus.Active, activated.Status);
    }

    // Безсрочният план няма продължителност за проверка
    [Fact]
    public async Task Activate_OpenEndedPlan_SkipsDurationCheck()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var service = CreateProgramPlanService(db);

        var plan = await service.CreateDraftAsync(
            PlanRequest(templateId, DateOnly.FromDateTime(DateTime.UtcNow), null),
            SqliteTestDatabase.UserId);
        var activated = await service.ActivateAsync(plan.Id, SqliteTestDatabase.UserId);

        Assert.Equal(ProgramPlanStatus.Active, activated.Status);
    }

    // Free планът спира шестия личен шаблон
    [Fact]
    public async Task CreateTemplate_BeyondFreeLimit_ThrowsLimitException()
    {
        using var db = new SqliteTestDatabase();
        using (var seedContext = db.CreateContext())
        {
            SqliteTestDatabase.SeedPlans(seedContext);
        }

        for (var i = 0; i < 5; i++)
        {
            await SeedTemplateAsync(db, SqliteTestDatabase.UserId, $"Template {i}");
        }

        var context = db.CreateContext();
        var service = new WorkoutTemplateService(context, new FakePhotoUrlResolver(), CreateEntitlements(context));

        var exception = await Assert.ThrowsAsync<SubscriptionLimitExceededException>(() =>
            service.CreateAsync(new CreateWorkoutTemplateRequest { Name = "Sixth" }, SqliteTestDatabase.UserId));

        Assert.Equal(SubscriptionFeature.CustomWorkoutTemplates, exception.Details.Feature);
        Assert.Equal(5, exception.Details.Limit);
    }

    // Под лимита създаването минава
    [Fact]
    public async Task CreateTemplate_UnderFreeLimit_Succeeds()
    {
        using var db = new SqliteTestDatabase();
        using (var seedContext = db.CreateContext())
        {
            SqliteTestDatabase.SeedPlans(seedContext);
        }

        long exerciseId;
        await using (var arrange = db.CreateContext())
        {
            var exercise = new Exercise
            {
                Name = "Bench",
                Slug = "bench-template-limit",
                IsPublic = true,
                PrimaryMuscleGroupId = SqliteTestDatabase.ChestId,
            };
            arrange.Exercises.Add(exercise);
            await arrange.SaveChangesAsync();
            exerciseId = exercise.Id;
        }

        var context = db.CreateContext();
        var service = new WorkoutTemplateService(context, new FakePhotoUrlResolver(), CreateEntitlements(context));

        var created = await service.CreateAsync(
            new CreateWorkoutTemplateRequest
            {
                Name = "First",
                Exercises =
                [
                    new CreateWorkoutTemplateExerciseRequest
                    {
                        GroupType = ExerciseGroupType.Straight,
                        ExerciseId = exerciseId,
                        Sets =
                        [
                            new CreateWorkoutTemplateExerciseSetRequest
                            {
                                SetType = ExerciseSetType.Working,
                                Reps = 8,
                                WeightKg = 60,
                            },
                        ],
                    },
                ],
            },
            SqliteTestDatabase.UserId);

        Assert.Equal("First", created.Name);
    }

    // Историята на упражненията се ограничава до месеците от плана
    [Fact]
    public async Task ExerciseHistory_ClampedToEntitlementWindow()
    {
        using var db = new SqliteTestDatabase();
        using (var seedContext = db.CreateContext())
        {
            SqliteTestDatabase.SeedPlans(seedContext);
        }

        long exerciseId;
        await using (var context = db.CreateContext())
        {
            var exercise = new Exercise
            {
                Name = "Bench",
                Slug = "bench-history",
                IsPublic = true,
                PrimaryMuscleGroupId = SqliteTestDatabase.ChestId,
            };
            context.Exercises.Add(exercise);
            await context.SaveChangesAsync();
            exerciseId = exercise.Id;

            // Едната тренировка е отдавна (извън 1-месечния прозорец на Free), другата е скорошна.
            context.Workouts.AddRange(
                NewFinishedWorkout(exerciseId, DateTime.UtcNow.AddMonths(-6), "Old"),
                NewFinishedWorkout(exerciseId, DateTime.UtcNow.AddDays(-2), "Recent"));
            await context.SaveChangesAsync();
        }

        var context2 = db.CreateContext();
        var service = new WorkoutService(context2, new FakePhotoUrlResolver(), CreateEntitlements(context2));

        var history = await service.GetExerciseHistoryAsync(SqliteTestDatabase.UserId, [exerciseId], take: 10);

        var sessions = history.Items.SelectMany(x => x.Sessions).ToList();
        Assert.Single(sessions);
        Assert.Equal("Recent", sessions[0].WorkoutTitle);
    }

    private static Workout NewFinishedWorkout(long exerciseId, DateTime finishedAt, string title) => new()
    {
        UserId = SqliteTestDatabase.UserId,
        Title = title,
        StartedAt = finishedAt.AddHours(-1),
        FinishedAt = finishedAt,
        ExerciseGroups =
        [
            new WorkoutExerciseGroup
            {
                GroupType = ExerciseGroupType.Straight,
                SortOrder = 0,
                Exercises =
                [
                    new WorkoutExercise
                    {
                        ExerciseId = exerciseId,
                        OrderIndex = 0,
                        Sets =
                        [
                            new ExerciseSet
                            {
                                SetType = ExerciseSetType.Working,
                                OrderIndex = 0,
                                Reps = 8,
                                WeightKg = 60,
                                IsCompleted = true,
                            },
                        ],
                    },
                ],
            },
        ],
    };
}
