using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.ProgramPlans;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.ProgramPlans.Days;
using FitMate.Services.ProgramPlans.Plans;
using FitMate.Services.ProgramPlans.Schedules;
using FitMate.Services.Workouts;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Tests.Unit.Services;

public class ProgramPlanUpdateScheduleTests
{
    private static readonly DateOnly EffectiveFrom = new(2026, 8, 10);

    private static async Task<long> SeedTemplateAsync(SqliteTestDatabase db, string name)
    {
        await using var context = db.CreateContext();
        var template = new WorkoutTemplate { UserId = SqliteTestDatabase.UserId, Name = name };
        context.WorkoutTemplates.Add(template);
        await context.SaveChangesAsync();
        return template.Id;
    }

    private static SaveProgramPlanRequest MonThuRequest(long templateId) => new()
    {
        Name = "August Upper Lower",
        Goal = TrainingGoal.Hypertrophy,
        ScheduleType = ProgramScheduleType.FixedWeekdays,
        StartDate = new DateOnly(2026, 8, 3),
        EndDate = new DateOnly(2026, 8, 30),
        TargetWorkoutsPerWeek = 2,
        ScheduleRules =
        [
            new ProgramScheduleRuleRequest { DayOfWeek = DayOfWeek.Monday, DayType = ProgramPlanDayType.Workout, WorkoutTemplateId = templateId, OrderIndex = 0 },
            new ProgramScheduleRuleRequest { DayOfWeek = DayOfWeek.Thursday, DayType = ProgramPlanDayType.Workout, WorkoutTemplateId = templateId, OrderIndex = 1 },
        ],
    };

    private static SaveProgramPlanRequest TueOnlyRequest(long templateId)
    {
        var request = MonThuRequest(templateId);
        request.TargetWorkoutsPerWeek = 1;
        request.ScheduleRules =
        [
            new ProgramScheduleRuleRequest { DayOfWeek = DayOfWeek.Tuesday, DayType = ProgramPlanDayType.Workout, WorkoutTemplateId = templateId, OrderIndex = 0 },
        ];
        return request;
    }

    private static ProgramPlanService CreateService(SqliteTestDatabase db)
    {
        var context = db.CreateContext();
        var entitlements = new FakeEntitlementService();
        var dayService = new ProgramPlanDayService(
            context,
            new WorkoutService(context, new FakePhotoUrlResolver(), entitlements),
            new ProgramPlanScheduleService());
        return new ProgramPlanService(context, new ProgramPlanScheduleService(), dayService, entitlements);
    }

    private static async Task<long> SeedActivePlanAsync(SqliteTestDatabase db, long templateId)
    {
        var service = CreateService(db);
        var created = await service.CreateDraftAsync(MonThuRequest(templateId), SqliteTestDatabase.UserId);
        await service.ActivateAsync(created.Id, SqliteTestDatabase.UserId);
        return created.Id;
    }

    // Само бъдещите планирани дни се пренареждат; историята остава
    [Fact]
    public async Task Update_DeletesOnlyFutureScheduledDays_KeepsHistory()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, "Upper A");
        var planId = await SeedActivePlanAsync(db, templateId);

        await using (var context = db.CreateContext())
        {
            var first = await context.ProgramPlanDays.FirstAsync(x => x.ScheduledDate == new DateOnly(2026, 8, 3));
            first.Status = ProgramPlanDayStatus.Completed;
            await context.SaveChangesAsync();
        }

        await CreateService(db).UpdateActiveScheduleAsync(
            planId,
            TueOnlyRequest(templateId),
            EffectiveFrom,
            SqliteTestDatabase.UserId);

        await using var verify = db.CreateContext();
        var dates = await verify.ProgramPlanDays.Select(x => x.ScheduledDate).ToListAsync();

        Assert.Contains(new DateOnly(2026, 8, 3), dates);
        Assert.Contains(new DateOnly(2026, 8, 6), dates);
        Assert.DoesNotContain(new DateOnly(2026, 8, 10), dates);
        Assert.DoesNotContain(new DateOnly(2026, 8, 13), dates);
        Assert.Contains(new DateOnly(2026, 8, 11), dates);
        Assert.Contains(new DateOnly(2026, 8, 18), dates);
        Assert.Contains(new DateOnly(2026, 8, 25), dates);
    }

    // Преместен от потребителя ден оцелява и не се дублира
    [Fact]
    public async Task Update_SurvivingFutureDay_IsKeptWithoutDuplicate()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, "Upper A");
        var planId = await SeedActivePlanAsync(db, templateId);

        await using (var context = db.CreateContext())
        {
            var moved = await context.ProgramPlanDays.FirstAsync(x => x.ScheduledDate == new DateOnly(2026, 8, 10));
            moved.ScheduledDate = new DateOnly(2026, 8, 11);
            moved.Status = ProgramPlanDayStatus.Rescheduled;
            await context.SaveChangesAsync();
        }

        await CreateService(db).UpdateActiveScheduleAsync(
            planId,
            TueOnlyRequest(templateId),
            EffectiveFrom,
            SqliteTestDatabase.UserId);

        await using var verify = db.CreateContext();
        var onEleventh = await verify.ProgramPlanDays
            .Where(x => x.ScheduledDate == new DateOnly(2026, 8, 11))
            .ToListAsync();

        Assert.Equal(ProgramPlanDayStatus.Rescheduled, Assert.Single(onEleventh).Status);
    }

    // Новият график заменя правилата на плана
    [Fact]
    public async Task Update_ReplacesScheduleRules()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, "Upper A");
        var planId = await SeedActivePlanAsync(db, templateId);

        var updated = await CreateService(db).UpdateActiveScheduleAsync(
            planId,
            TueOnlyRequest(templateId),
            EffectiveFrom,
            SqliteTestDatabase.UserId);

        Assert.Equal(DayOfWeek.Tuesday, Assert.Single(updated.ScheduleRules).DayOfWeek);
        Assert.Equal(1, updated.TargetWorkoutsPerWeek);
        Assert.Equal(new DateOnly(2026, 8, 3), updated.StartDate);
    }

    // Чернова не се пренарежда по този път
    [Fact]
    public async Task Update_DraftPlan_Throws()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, "Upper A");
        var service = CreateService(db);
        var draft = await service.CreateDraftAsync(MonThuRequest(templateId), SqliteTestDatabase.UserId);

        await Assert.ThrowsAsync<FitMateException>(() =>
            CreateService(db).UpdateActiveScheduleAsync(
                draft.Id,
                TueOnlyRequest(templateId),
                EffectiveFrom,
                SqliteTestDatabase.UserId));
    }

    // Смяна на типа график на активен план не е позволена
    [Fact]
    public async Task Update_ChangedScheduleType_Throws()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, "Upper A");
        var planId = await SeedActivePlanAsync(db, templateId);

        var request = TueOnlyRequest(templateId);
        request.ScheduleType = ProgramScheduleType.Rotation;
        request.ScheduleRules[0].DayOfWeek = null;
        request.ScheduleRules[0].RotationDayIndex = 1;

        await Assert.ThrowsAsync<FitMateException>(() =>
            CreateService(db).UpdateActiveScheduleAsync(
                planId,
                request,
                EffectiveFrom,
                SqliteTestDatabase.UserId));
    }

    // Чужд план не се пипа
    [Fact]
    public async Task Update_OtherUsersPlan_Throws()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, "Upper A");
        var planId = await SeedActivePlanAsync(db, templateId);

        await Assert.ThrowsAsync<FitMateException>(() =>
            CreateService(db).UpdateActiveScheduleAsync(
                planId,
                TueOnlyRequest(templateId),
                EffectiveFrom,
                SqliteTestDatabase.OtherUserId));
    }
}
