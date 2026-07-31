using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.ProgramPlans;
using FitMate.Services.ProgramPlans.Days;
using FitMate.Services.ProgramPlans.Plans;
using FitMate.Services.ProgramPlans.Schedules;
using FitMate.Services.Workouts;
using FitMate.Tests.TestInfrastructure;

namespace FitMate.Tests.Unit.Services;

public class ProgramPlanProgressTests
{
    private static async Task<long> SeedPlanWithDaysAsync(
        SqliteTestDatabase db,
        DateOnly? endDate,
        params (DateOnly Date, ProgramPlanDayType Type, ProgramPlanDayStatus Status)[] days)
    {
        await using var context = db.CreateContext();
        var plan = new ProgramPlan
        {
            UserId = SqliteTestDatabase.UserId,
            Name = "P",
            Status = ProgramPlanStatus.Active,
            ScheduleType = ProgramScheduleType.FixedWeekdays,
            StartDate = new DateOnly(2026, 8, 3),
            EndDate = endDate,
            TargetWorkoutsPerWeek = 4,
        };
        context.ProgramPlans.Add(plan);
        await context.SaveChangesAsync();

        var order = 0;
        foreach (var (date, type, status) in days)
        {
            context.ProgramPlanDays.Add(new ProgramPlanDay
            {
                ProgramPlanId = plan.Id,
                ScheduledDate = date,
                DayType = type,
                Status = status,
                OrderIndex = order++,
            });
        }

        await context.SaveChangesAsync();
        return plan.Id;
    }

    private static ProgramPlanService CreateService(SqliteTestDatabase db)
    {
        var context = db.CreateContext();
        var dayService = new ProgramPlanDayService(context, new WorkoutService(context, new FakePhotoUrlResolver(), new FakeEntitlementService()), new ProgramPlanScheduleService());
        return new ProgramPlanService(context, new ProgramPlanScheduleService(), dayService, new FakeEntitlementService());
    }

    [Fact]
    public async Task Progress_MatchesSpecExample()
    {
        using var db = new SqliteTestDatabase();
        var today = new DateOnly(2026, 8, 20);
        // 16 workouts: 11 completed, 1 started, 2 missed, 1 skipped, 1 remaining (future)
        var days = new List<(DateOnly, ProgramPlanDayType, ProgramPlanDayStatus)>();
        var d = new DateOnly(2026, 8, 3);
        for (var i = 0; i < 11; i++) { days.Add((d, ProgramPlanDayType.Workout, ProgramPlanDayStatus.Completed)); d = d.AddDays(1); }
        days.Add((d, ProgramPlanDayType.Workout, ProgramPlanDayStatus.Missed)); d = d.AddDays(1);
        days.Add((d, ProgramPlanDayType.Workout, ProgramPlanDayStatus.Missed)); d = d.AddDays(1);
        days.Add((d, ProgramPlanDayType.Workout, ProgramPlanDayStatus.Skipped));
        days.Add((new DateOnly(2026, 8, 20), ProgramPlanDayType.Workout, ProgramPlanDayStatus.Started));
        days.Add((new DateOnly(2026, 8, 22), ProgramPlanDayType.Workout, ProgramPlanDayStatus.Scheduled));
        var planId = await SeedPlanWithDaysAsync(db, new DateOnly(2026, 8, 30), days.ToArray());
        var service = CreateService(db);

        var progress = await service.GetProgressAsync(planId, SqliteTestDatabase.UserId, today);

        Assert.Equal(16, progress.ScheduledWorkouts);
        Assert.Equal(11, progress.CompletedWorkouts);
        Assert.Equal(1, progress.StartedWorkouts);
        Assert.Equal(2, progress.MissedWorkouts);
        Assert.Equal(1, progress.SkippedWorkouts);
        Assert.Equal(1, progress.RemainingWorkouts);
        Assert.Equal(68.75m, progress.CompletionPercentage);
    }

    [Fact]
    public async Task Progress_OpenEnded_HasNullCompletion()
    {
        using var db = new SqliteTestDatabase();
        var planId = await SeedPlanWithDaysAsync(db, endDate: null,
            (new DateOnly(2026, 8, 3), ProgramPlanDayType.Workout, ProgramPlanDayStatus.Completed));
        var service = CreateService(db);

        var progress = await service.GetProgressAsync(planId, SqliteTestDatabase.UserId, new DateOnly(2026, 8, 4));

        Assert.Null(progress.CompletionPercentage);
        Assert.Equal(100m, progress.AdherencePercentage);
    }

    [Fact]
    public async Task Streak_CountsConsecutiveCompletedDueDays_SkipDoesNotBreakButMissedDoes()
    {
        using var db = new SqliteTestDatabase();
        var planId = await SeedPlanWithDaysAsync(db, new DateOnly(2026, 8, 30),
            (new DateOnly(2026, 8, 3), ProgramPlanDayType.Workout, ProgramPlanDayStatus.Missed),
            (new DateOnly(2026, 8, 5), ProgramPlanDayType.Workout, ProgramPlanDayStatus.Completed),
            (new DateOnly(2026, 8, 7), ProgramPlanDayType.Workout, ProgramPlanDayStatus.Skipped),
            (new DateOnly(2026, 8, 9), ProgramPlanDayType.Workout, ProgramPlanDayStatus.Completed),
            (new DateOnly(2026, 8, 11), ProgramPlanDayType.Workout, ProgramPlanDayStatus.Completed));
        var service = CreateService(db);

        var progress = await service.GetProgressAsync(planId, SqliteTestDatabase.UserId, new DateOnly(2026, 8, 12));

        Assert.Equal(3, progress.CurrentStreak); // 11th, 9th, (skip ignored), 5th; missed on 3rd stops it
    }

    [Fact]
    public async Task Progress_OtherUsersPlan_Throws()
    {
        using var db = new SqliteTestDatabase();
        var planId = await SeedPlanWithDaysAsync(db, new DateOnly(2026, 8, 30),
            (new DateOnly(2026, 8, 3), ProgramPlanDayType.Workout, ProgramPlanDayStatus.Completed));
        var service = CreateService(db);

        await Assert.ThrowsAnyAsync<Exception>(() =>
            service.GetProgressAsync(planId, SqliteTestDatabase.OtherUserId, new DateOnly(2026, 8, 12)));
    }
}
