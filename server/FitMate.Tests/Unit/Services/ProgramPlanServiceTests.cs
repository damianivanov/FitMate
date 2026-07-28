using FitMate.Core.JsonModels.ProgramPlans;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.ProgramPlans;
using FitMate.Services.ProgramPlans.Days;
using FitMate.Services.ProgramPlans.Plans;
using FitMate.Services.ProgramPlans.Schedules;
using FitMate.Services.Workouts;
using FitMate.Tests.TestInfrastructure;

namespace FitMate.Tests.Unit.Services;

public class ProgramPlanServiceTests
{
    private static async Task<long> SeedTemplateAsync(SqliteTestDatabase db, long userId, string name)
    {
        await using var context = db.CreateContext();
        var template = new WorkoutTemplate { UserId = userId, Name = name, IsPublic = false };
        context.WorkoutTemplates.Add(template);
        await context.SaveChangesAsync();
        return template.Id;
    }

    private static SaveProgramPlanRequest FixedWeekdayRequest(long templateId) => new()
    {
        Name = "August Upper Lower",
        Goal = TrainingGoal.Hypertrophy,
        ScheduleType = ProgramScheduleType.FixedWeekdays,
        StartDate = new DateOnly(2026, 8, 3),
        EndDate = new DateOnly(2026, 8, 30),
        TargetWorkoutsPerWeek = 4,
        ScheduleRules =
        [
            new ProgramScheduleRuleRequest { DayOfWeek = DayOfWeek.Monday, DayType = ProgramPlanDayType.Workout, WorkoutTemplateId = templateId, OrderIndex = 0 },
            new ProgramScheduleRuleRequest { DayOfWeek = DayOfWeek.Thursday, DayType = ProgramPlanDayType.Workout, WorkoutTemplateId = templateId, OrderIndex = 1 },
        ],
    };

    private static ProgramPlanService CreateService(SqliteTestDatabase db)
    {
        var context = db.CreateContext();
        var dayService = new ProgramPlanDayService(context, new WorkoutService(context, new FakePhotoUrlResolver()), new ProgramPlanScheduleService());
        return new ProgramPlanService(context, new ProgramPlanScheduleService(), dayService);
    }

    [Fact]
    public async Task CreateDraft_PersistsPlanWithRules()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var service = CreateService(db);

        var model = await service.CreateDraftAsync(FixedWeekdayRequest(templateId), SqliteTestDatabase.UserId);

        Assert.Equal(ProgramPlanStatus.Draft, model.Status);
        Assert.Equal(2, model.ScheduleRules.Count);
        await using var context = db.CreateContext();
        Assert.Equal(1, context.ProgramPlans.Count());
        Assert.Empty(context.ProgramPlanDays); // drafts generate no calendar
    }

    [Fact]
    public async Task CreateDraft_OtherUsersPrivateTemplate_Throws()
    {
        using var db = new SqliteTestDatabase();
        var foreignTemplate = await SeedTemplateAsync(db, SqliteTestDatabase.OtherUserId, "Not yours");
        var service = CreateService(db);

        await Assert.ThrowsAnyAsync<Exception>(() =>
            service.CreateDraftAsync(FixedWeekdayRequest(foreignTemplate), SqliteTestDatabase.UserId));
    }

    [Fact]
    public async Task CreateDraft_EndBeforeStart_Throws()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var request = FixedWeekdayRequest(templateId);
        request.EndDate = request.StartDate.AddDays(-1);
        var service = CreateService(db);

        await Assert.ThrowsAnyAsync<Exception>(() =>
            service.CreateDraftAsync(request, SqliteTestDatabase.UserId));
    }

    [Fact]
    public async Task CreateDraft_RotationWithGappedIndexes_Throws()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Push");
        var request = FixedWeekdayRequest(templateId);
        request.ScheduleType = ProgramScheduleType.Rotation;
        request.ScheduleRules =
        [
            new ProgramScheduleRuleRequest { RotationDayIndex = 1, DayType = ProgramPlanDayType.Workout, WorkoutTemplateId = templateId, OrderIndex = 0 },
            new ProgramScheduleRuleRequest { RotationDayIndex = 3, DayType = ProgramPlanDayType.Workout, WorkoutTemplateId = templateId, OrderIndex = 1 },
        ];
        var service = CreateService(db);

        await Assert.ThrowsAnyAsync<Exception>(() =>
            service.CreateDraftAsync(request, SqliteTestDatabase.UserId));
    }

    [Fact]
    public async Task UpdateDraft_ReplacesRules()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var service = CreateService(db);
        var created = await service.CreateDraftAsync(FixedWeekdayRequest(templateId), SqliteTestDatabase.UserId);

        var update = FixedWeekdayRequest(templateId);
        update.ScheduleRules.RemoveAt(1);
        var updated = await service.UpdateDraftAsync(created.Id, update, SqliteTestDatabase.UserId);

        Assert.Single(updated.ScheduleRules);
    }

    [Fact]
    public async Task UpdateDraft_NonDraft_Throws()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var service = CreateService(db);
        var created = await service.CreateDraftAsync(FixedWeekdayRequest(templateId), SqliteTestDatabase.UserId);
        await service.ActivateAsync(created.Id, SqliteTestDatabase.UserId);

        await Assert.ThrowsAnyAsync<Exception>(() =>
            service.UpdateDraftAsync(created.Id, FixedWeekdayRequest(templateId), SqliteTestDatabase.UserId));
    }

    [Fact]
    public async Task GetById_OtherUsersPlan_ReturnsNull()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var service = CreateService(db);
        var created = await service.CreateDraftAsync(FixedWeekdayRequest(templateId), SqliteTestDatabase.UserId);

        Assert.Null(await service.GetByIdAsync(created.Id, SqliteTestDatabase.OtherUserId));
    }

    [Fact]
    public async Task Activate_FixedLength_GeneratesAllDaysAndSetsActive()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var service = CreateService(db);
        var created = await service.CreateDraftAsync(FixedWeekdayRequest(templateId), SqliteTestDatabase.UserId);

        var activated = await service.ActivateAsync(created.Id, SqliteTestDatabase.UserId);

        Assert.Equal(ProgramPlanStatus.Active, activated.Status);
        Assert.NotNull(activated.ActivatedAt);
        await using var context = db.CreateContext();
        Assert.Equal(8, context.ProgramPlanDays.Count(d => d.ProgramPlanId == created.Id)); // Mon+Thu × 4 weeks
    }

    [Fact]
    public async Task Activate_OpenEnded_GeneratesRollingHorizonOnly()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var service = CreateService(db);
        var request = FixedWeekdayRequest(templateId);
        request.StartDate = DateOnly.FromDateTime(DateTime.UtcNow);
        request.EndDate = null;
        var created = await service.CreateDraftAsync(request, SqliteTestDatabase.UserId);

        await service.ActivateAsync(created.Id, SqliteTestDatabase.UserId);

        await using var context = db.CreateContext();
        var maxDate = context.ProgramPlanDays
            .Where(d => d.ProgramPlanId == created.Id)
            .Max(d => d.ScheduledDate);
        Assert.True(maxDate <= request.StartDate.AddDays(ProgramPlanService.OpenEndedHorizonDays));
        Assert.True(context.ProgramPlanDays.Any(d => d.ProgramPlanId == created.Id));
    }

    [Fact]
    public async Task Activate_SecondActivePlan_Throws()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var service = CreateService(db);
        var first = await service.CreateDraftAsync(FixedWeekdayRequest(templateId), SqliteTestDatabase.UserId);
        await service.ActivateAsync(first.Id, SqliteTestDatabase.UserId);
        var second = await service.CreateDraftAsync(FixedWeekdayRequest(templateId), SqliteTestDatabase.UserId);

        await Assert.ThrowsAnyAsync<Exception>(() => service.ActivateAsync(second.Id, SqliteTestDatabase.UserId));
    }

    [Fact]
    public async Task Activate_PausedPlan_DoesNotDuplicateDays()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var service = CreateService(db);
        var created = await service.CreateDraftAsync(FixedWeekdayRequest(templateId), SqliteTestDatabase.UserId);
        await service.ActivateAsync(created.Id, SqliteTestDatabase.UserId);
        await service.PauseAsync(created.Id, SqliteTestDatabase.UserId);

        await service.ActivateAsync(created.Id, SqliteTestDatabase.UserId);

        await using var context = db.CreateContext();
        Assert.Equal(8, context.ProgramPlanDays.Count(d => d.ProgramPlanId == created.Id));
    }

    [Fact]
    public async Task DeleteDraft_ActivePlan_ReturnsFalse()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var service = CreateService(db);
        var created = await service.CreateDraftAsync(FixedWeekdayRequest(templateId), SqliteTestDatabase.UserId);
        await service.ActivateAsync(created.Id, SqliteTestDatabase.UserId);

        Assert.False(await service.DeleteDraftAsync(created.Id, SqliteTestDatabase.UserId));
        await using var context = db.CreateContext();
        Assert.Equal(1, context.ProgramPlans.Count());
    }

    [Fact]
    public async Task GetActive_ReturnsOnlyOwnActivePlan()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var service = CreateService(db);
        var created = await service.CreateDraftAsync(FixedWeekdayRequest(templateId), SqliteTestDatabase.UserId);
        await service.ActivateAsync(created.Id, SqliteTestDatabase.UserId);

        Assert.NotNull(await service.GetActiveAsync(SqliteTestDatabase.UserId));
        Assert.Null(await service.GetActiveAsync(SqliteTestDatabase.OtherUserId));
    }

    [Fact]
    public async Task Activate_CustomCalendar_KeepsDraftDaysAndFlipsStatus()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var service = CreateService(db);
        var request = FixedWeekdayRequest(templateId);
        request.ScheduleType = ProgramScheduleType.CustomCalendar;
        request.ScheduleRules = [];
        request.CustomDays =
        [
            new CustomProgramDayRequest { Date = new DateOnly(2026, 8, 5), DayType = ProgramPlanDayType.Workout, WorkoutTemplateId = templateId },
            new CustomProgramDayRequest { Date = new DateOnly(2026, 8, 9), DayType = ProgramPlanDayType.Workout, WorkoutTemplateId = templateId },
        ];
        var created = await service.CreateDraftAsync(request, SqliteTestDatabase.UserId);

        var activated = await service.ActivateAsync(created.Id, SqliteTestDatabase.UserId);

        Assert.Equal(ProgramPlanStatus.Active, activated.Status);
        await using var context = db.CreateContext();
        Assert.Equal(2, context.ProgramPlanDays.Count(d => d.ProgramPlanId == created.Id));
    }

    [Fact]
    public async Task GetToday_ReturnsTodayMissedAndNext()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var service = CreateService(db);
        var request = FixedWeekdayRequest(templateId); // Mon + Thu, Aug 3–30
        var created = await service.CreateDraftAsync(request, SqliteTestDatabase.UserId);
        await service.ActivateAsync(created.Id, SqliteTestDatabase.UserId);

        var today = await service.GetTodayAsync(SqliteTestDatabase.UserId, new DateOnly(2026, 8, 6)); // a Thursday

        Assert.True(today.HasActiveProgram);
        Assert.Equal(created.Id, today.ProgramId);
        Assert.NotNull(today.Today);
        Assert.Equal(new DateOnly(2026, 8, 6), today.Today!.ScheduledDate);
        Assert.NotNull(today.MissedWorkout);                       // Monday Aug 3 became Missed
        Assert.Equal(new DateOnly(2026, 8, 3), today.MissedWorkout!.ScheduledDate);
        Assert.NotNull(today.NextWorkout);
        Assert.Equal(new DateOnly(2026, 8, 10), today.NextWorkout!.ScheduledDate);
    }

    [Fact]
    public async Task GetToday_NoActivePlan_ReturnsHasActiveProgramFalse()
    {
        using var db = new SqliteTestDatabase();
        var service = CreateService(db);

        var today = await service.GetTodayAsync(SqliteTestDatabase.UserId, new DateOnly(2026, 8, 6));

        Assert.False(today.HasActiveProgram);
        Assert.Null(today.Today);
    }

    [Fact]
    public async Task GetToday_OpenEnded_TopsUpHorizon()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var service = CreateService(db);
        var request = FixedWeekdayRequest(templateId);
        request.StartDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-60);
        request.EndDate = null;
        var created = await service.CreateDraftAsync(request, SqliteTestDatabase.UserId);
        await service.ActivateAsync(created.Id, SqliteTestDatabase.UserId);
        var queryDate = DateOnly.FromDateTime(DateTime.UtcNow);

        await service.GetTodayAsync(SqliteTestDatabase.UserId, queryDate);

        await using var context = db.CreateContext();
        var maxDate = context.ProgramPlanDays
            .Where(d => d.ProgramPlanId == created.Id)
            .Max(d => d.ScheduledDate);
        Assert.True(maxDate > queryDate.AddDays(14)); // horizon extended well past today
    }

    [Fact]
    public async Task GetCalendar_ReturnsOnlyRequestedMonth()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var service = CreateService(db);
        var created = await service.CreateDraftAsync(FixedWeekdayRequest(templateId), SqliteTestDatabase.UserId);
        await service.ActivateAsync(created.Id, SqliteTestDatabase.UserId);

        var august = await service.GetCalendarAsync(created.Id, SqliteTestDatabase.UserId, 2026, 8);
        var september = await service.GetCalendarAsync(created.Id, SqliteTestDatabase.UserId, 2026, 9);

        Assert.Equal(8, august.Count);
        Assert.All(august, day => Assert.Equal(8, day.ScheduledDate.Month));
        Assert.Empty(september);
    }

    [Fact]
    public async Task GetCalendar_OtherUsersPlan_Throws()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var service = CreateService(db);
        var created = await service.CreateDraftAsync(FixedWeekdayRequest(templateId), SqliteTestDatabase.UserId);

        await Assert.ThrowsAnyAsync<Exception>(() =>
            service.GetCalendarAsync(created.Id, SqliteTestDatabase.OtherUserId, 2026, 8));
    }
}
