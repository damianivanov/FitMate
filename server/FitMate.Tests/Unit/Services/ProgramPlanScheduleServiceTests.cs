using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.ProgramPlans;
using FitMate.Services.ProgramPlans.Schedules;

namespace FitMate.Tests.Unit.Services;

public class ProgramPlanScheduleServiceTests
{
    private static ProgramPlan FixedWeekdayPlan() => new()
    {
        Id = 1,
        UserId = 1,
        ScheduleType = ProgramScheduleType.FixedWeekdays,
        StartDate = new DateOnly(2026, 8, 3),  // a Monday
        EndDate = new DateOnly(2026, 8, 30),
        ScheduleRules =
        [
            new ProgramPlanScheduleRule { DayOfWeek = DayOfWeek.Monday, DayType = ProgramPlanDayType.Workout, WorkoutTemplateId = 10, OrderIndex = 0 },
            new ProgramPlanScheduleRule { DayOfWeek = DayOfWeek.Tuesday, DayType = ProgramPlanDayType.Workout, WorkoutTemplateId = 11, OrderIndex = 1 },
            new ProgramPlanScheduleRule { DayOfWeek = DayOfWeek.Thursday, DayType = ProgramPlanDayType.Workout, WorkoutTemplateId = 12, OrderIndex = 2 },
            new ProgramPlanScheduleRule { DayOfWeek = DayOfWeek.Saturday, DayType = ProgramPlanDayType.Workout, WorkoutTemplateId = 13, OrderIndex = 3 },
        ],
    };

    [Fact]
    public void FixedWeekdays_FourWeeks_Generates16Workouts()
    {
        var plan = FixedWeekdayPlan();
        var service = new ProgramPlanScheduleService();

        var days = service.GenerateDays(plan, plan.StartDate, plan.EndDate!.Value);

        Assert.Equal(16, days.Count);
        Assert.All(days, d => Assert.Equal(ProgramPlanDayStatus.Scheduled, d.Status));
        Assert.All(days, d => Assert.Equal(ProgramPlanDayType.Workout, d.DayType));
        // first week
        Assert.Contains(days, d => d.ScheduledDate == new DateOnly(2026, 8, 3) && d.WorkoutTemplateId == 10);
        Assert.Contains(days, d => d.ScheduledDate == new DateOnly(2026, 8, 4) && d.WorkoutTemplateId == 11);
        Assert.Contains(days, d => d.ScheduledDate == new DateOnly(2026, 8, 6) && d.WorkoutTemplateId == 12);
        Assert.Contains(days, d => d.ScheduledDate == new DateOnly(2026, 8, 8) && d.WorkoutTemplateId == 13);
    }

    [Fact]
    public void FixedWeekdays_PartialRange_OnlyGeneratesInsideRange()
    {
        var plan = FixedWeekdayPlan();
        var service = new ProgramPlanScheduleService();

        var days = service.GenerateDays(plan, new DateOnly(2026, 8, 10), new DateOnly(2026, 8, 16));

        Assert.Equal(4, days.Count);
        Assert.All(days, d => Assert.InRange(d.ScheduledDate, new DateOnly(2026, 8, 10), new DateOnly(2026, 8, 16)));
    }

    [Fact]
    public void FixedWeekdays_WeekInterval2_SkipsAlternateWeeks()
    {
        var plan = FixedWeekdayPlan();
        plan.ScheduleRules = [new ProgramPlanScheduleRule
        {
            DayOfWeek = DayOfWeek.Monday,
            DayType = ProgramPlanDayType.Deload,
            WeekInterval = 2,
            OrderIndex = 0,
        }];
        var service = new ProgramPlanScheduleService();

        var days = service.GenerateDays(plan, plan.StartDate, plan.EndDate!.Value);

        Assert.Equal(2, days.Count); // Aug 3 and Aug 17
        Assert.Contains(days, d => d.ScheduledDate == new DateOnly(2026, 8, 3));
        Assert.Contains(days, d => d.ScheduledDate == new DateOnly(2026, 8, 17));
    }

    [Fact]
    public void Rotation_PushPullLegsRest_CyclesAndSkipsRestDays()
    {
        var plan = new ProgramPlan
        {
            ScheduleType = ProgramScheduleType.Rotation,
            StartDate = new DateOnly(2026, 8, 3),
            EndDate = new DateOnly(2026, 8, 10),
            ScheduleRules =
            [
                new ProgramPlanScheduleRule { RotationDayIndex = 1, DayType = ProgramPlanDayType.Workout, WorkoutTemplateId = 21, OrderIndex = 0 },
                new ProgramPlanScheduleRule { RotationDayIndex = 2, DayType = ProgramPlanDayType.Workout, WorkoutTemplateId = 22, OrderIndex = 1 },
                new ProgramPlanScheduleRule { RotationDayIndex = 3, DayType = ProgramPlanDayType.Workout, WorkoutTemplateId = 23, OrderIndex = 2 },
                new ProgramPlanScheduleRule { RotationDayIndex = 4, DayType = ProgramPlanDayType.Rest, OrderIndex = 3 },
            ],
        };
        var service = new ProgramPlanScheduleService();

        var days = service.GenerateDays(plan, plan.StartDate, plan.EndDate.Value);

        // 8 dates, cycle of 4 → 2 full cycles → 6 workout days (rest emits nothing)
        Assert.Equal(6, days.Count);
        Assert.Equal(21, days.Single(d => d.ScheduledDate == new DateOnly(2026, 8, 3)).WorkoutTemplateId);
        Assert.Equal(22, days.Single(d => d.ScheduledDate == new DateOnly(2026, 8, 4)).WorkoutTemplateId);
        Assert.Equal(23, days.Single(d => d.ScheduledDate == new DateOnly(2026, 8, 5)).WorkoutTemplateId);
        Assert.DoesNotContain(days, d => d.ScheduledDate == new DateOnly(2026, 8, 6));   // rest
        Assert.Equal(21, days.Single(d => d.ScheduledDate == new DateOnly(2026, 8, 7)).WorkoutTemplateId);
    }

    [Fact]
    public void Rotation_ContinuationRange_KeepsCyclePhase()
    {
        var plan = new ProgramPlan
        {
            ScheduleType = ProgramScheduleType.Rotation,
            StartDate = new DateOnly(2026, 8, 3),
            EndDate = null, // open-ended
            ScheduleRules =
            [
                new ProgramPlanScheduleRule { RotationDayIndex = 1, DayType = ProgramPlanDayType.Workout, WorkoutTemplateId = 21, OrderIndex = 0 },
                new ProgramPlanScheduleRule { RotationDayIndex = 2, DayType = ProgramPlanDayType.Rest, OrderIndex = 1 },
            ],
        };
        var service = new ProgramPlanScheduleService();

        // generating a later window must stay in phase: Aug 3 = index 1, so Aug 13 = index 1 too
        var days = service.GenerateDays(plan, new DateOnly(2026, 8, 13), new DateOnly(2026, 8, 16));

        Assert.Equal(2, days.Count);
        Assert.Contains(days, d => d.ScheduledDate == new DateOnly(2026, 8, 13));
        Assert.Contains(days, d => d.ScheduledDate == new DateOnly(2026, 8, 15));
    }

    [Fact]
    public void OptionalWorkoutRule_EmitsOptionalWorkoutDayType()
    {
        var plan = FixedWeekdayPlan();
        plan.ScheduleRules = [new ProgramPlanScheduleRule
        {
            DayOfWeek = DayOfWeek.Sunday,
            DayType = ProgramPlanDayType.Workout,
            IsOptional = true,
            WorkoutTemplateId = 10,
            OrderIndex = 0,
        }];
        var service = new ProgramPlanScheduleService();

        var days = service.GenerateDays(plan, plan.StartDate, plan.EndDate!.Value);

        Assert.All(days, d => Assert.Equal(ProgramPlanDayType.OptionalWorkout, d.DayType));
    }

    [Fact]
    public void CustomCalendar_GeneratesNothing()
    {
        var plan = new ProgramPlan
        {
            ScheduleType = ProgramScheduleType.CustomCalendar,
            StartDate = new DateOnly(2026, 8, 3),
            EndDate = new DateOnly(2026, 8, 30),
        };
        var service = new ProgramPlanScheduleService();

        Assert.Empty(service.GenerateDays(plan, plan.StartDate, plan.EndDate.Value));
    }
}
