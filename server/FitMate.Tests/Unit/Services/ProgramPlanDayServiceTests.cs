using FitMate.Core.JsonModels.ProgramPlans;
using FitMate.Core.JsonModels.Workouts;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.ProgramPlans;
using FitMate.Services.ProgramPlans.Days;
using FitMate.Services.ProgramPlans.Schedules;
using FitMate.Services.Workouts;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Tests.Unit.Services;

public class ProgramPlanDayServiceTests
{
    // Seeds an Active plan with one Workout day on `date` and returns (planId, dayId, templateId).
    private static async Task<(long PlanId, long DayId, long TemplateId)> SeedActivePlanWithDayAsync(
        SqliteTestDatabase db,
        long userId,
        DateOnly date,
        ProgramPlanDayStatus status = ProgramPlanDayStatus.Scheduled)
    {
        await using var context = db.CreateContext();
        var template = new WorkoutTemplate { UserId = userId, Name = "Upper A", IsPublic = false };
        context.WorkoutTemplates.Add(template);
        await context.SaveChangesAsync();

        var plan = new ProgramPlan
        {
            UserId = userId,
            Name = "Test plan",
            Status = ProgramPlanStatus.Active,
            ScheduleType = ProgramScheduleType.FixedWeekdays,
            StartDate = date.AddDays(-7),
            EndDate = date.AddDays(21),
            TargetWorkoutsPerWeek = 3,
        };
        context.ProgramPlans.Add(plan);
        await context.SaveChangesAsync();

        var day = new ProgramPlanDay
        {
            ProgramPlanId = plan.Id,
            ScheduledDate = date,
            DayType = ProgramPlanDayType.Workout,
            Status = status,
            WorkoutTemplateId = template.Id,
        };
        context.ProgramPlanDays.Add(day);
        await context.SaveChangesAsync();
        return (plan.Id, day.Id, template.Id);
    }

    private static (ProgramPlanDayService DayService, AppDbContext Context) CreateService(SqliteTestDatabase db)
    {
        var context = db.CreateContext();
        var workoutService = new WorkoutService(context, new FakePhotoUrlResolver());
        return (new ProgramPlanDayService(context, workoutService, new ProgramPlanScheduleService()), context);
    }

    [Fact]
    public async Task StartWorkout_CreatesWorkoutAndLinksDay()
    {
        using var db = new SqliteTestDatabase();
        var (_, dayId, _) = await SeedActivePlanWithDayAsync(db, SqliteTestDatabase.UserId, new DateOnly(2026, 8, 5));
        var (service, context) = CreateService(db);

        var workoutId = await service.StartWorkoutAsync(dayId, SqliteTestDatabase.UserId);

        var day = await context.ProgramPlanDays.AsNoTracking().SingleAsync(d => d.Id == dayId);
        Assert.Equal(ProgramPlanDayStatus.Started, day.Status);
        Assert.Equal(workoutId, day.StartedWorkoutId);
        Assert.NotNull(day.StartedAt);
        var workout = await context.Workouts.AsNoTracking().SingleAsync(w => w.Id == workoutId);
        Assert.Equal(dayId, workout.ProgramPlanDayId);
    }

    [Fact]
    public async Task StartWorkout_SecondCall_ReturnsSameWorkout()
    {
        using var db = new SqliteTestDatabase();
        var (_, dayId, _) = await SeedActivePlanWithDayAsync(db, SqliteTestDatabase.UserId, new DateOnly(2026, 8, 5));
        var (service, context) = CreateService(db);

        var first = await service.StartWorkoutAsync(dayId, SqliteTestDatabase.UserId);
        var second = await service.StartWorkoutAsync(dayId, SqliteTestDatabase.UserId);

        Assert.Equal(first, second);
        Assert.Equal(1, await context.Workouts.CountAsync());
    }

    [Fact]
    public async Task StartWorkout_OtherUsersDay_Throws()
    {
        using var db = new SqliteTestDatabase();
        var (_, dayId, _) = await SeedActivePlanWithDayAsync(db, SqliteTestDatabase.OtherUserId, new DateOnly(2026, 8, 5));
        var (service, _) = CreateService(db);

        await Assert.ThrowsAnyAsync<Exception>(() => service.StartWorkoutAsync(dayId, SqliteTestDatabase.UserId));
    }

    [Fact]
    public async Task StartWorkout_PausedPlan_Throws()
    {
        using var db = new SqliteTestDatabase();
        var (planId, dayId, _) = await SeedActivePlanWithDayAsync(db, SqliteTestDatabase.UserId, new DateOnly(2026, 8, 5));
        await using (var arrange = db.CreateContext())
        {
            var plan = await arrange.ProgramPlans.SingleAsync(p => p.Id == planId);
            plan.Status = ProgramPlanStatus.Paused;
            await arrange.SaveChangesAsync();
        }
        var (service, _) = CreateService(db);

        await Assert.ThrowsAnyAsync<Exception>(() => service.StartWorkoutAsync(dayId, SqliteTestDatabase.UserId));
    }

    [Fact]
    public async Task FinishWorkout_CompletesLinkedProgramDay()
    {
        using var db = new SqliteTestDatabase();
        var (_, dayId, _) = await SeedActivePlanWithDayAsync(db, SqliteTestDatabase.UserId, new DateOnly(2026, 8, 5));
        var exerciseId = await SeedExerciseAsync(db);
        var (service, context) = CreateService(db);
        var workoutId = await service.StartWorkoutAsync(dayId, SqliteTestDatabase.UserId);

        var workoutService = new WorkoutService(context, new FakePhotoUrlResolver());
        await workoutService.FinishAsync(workoutId, MinimalFinishRequest(exerciseId), SqliteTestDatabase.UserId);

        var day = await context.ProgramPlanDays.AsNoTracking().SingleAsync(d => d.Id == dayId);
        Assert.Equal(ProgramPlanDayStatus.Completed, day.Status);
        Assert.Equal(workoutId, day.CompletedWorkoutId);
        Assert.NotNull(day.CompletedAt);
    }

    // Стартиране на най-старата пропусната мести цялата опашка напред по ритъма на плана
    [Fact]
    public async Task StartWorkout_OnMissedDay_SlidesRemainingQueueForward()
    {
        using var db = new SqliteTestDatabase();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Пн/Чт план: A и B пропуснати, C и D още предстоят.
        var (planId, aId, templateId) = await SeedShiftablePlanAsync(db, today);
        long bId, cId, dId;
        await using (var arrange = db.CreateContext())
        {
            var ids = await arrange.ProgramPlanDays
                .Where(d => d.ProgramPlanId == planId)
                .OrderBy(d => d.ScheduledDate)
                .Select(d => d.Id)
                .ToListAsync();
            bId = ids[1];
            cId = ids[2];
            dId = ids[3];
        }

        var (service, context) = CreateService(db);

        await service.StartWorkoutAsync(aId, SqliteTestDatabase.UserId);

        var days = await context.ProgramPlanDays.AsNoTracking()
            .Where(d => d.ProgramPlanId == planId)
            .ToDictionaryAsync(d => d.Id);

        // A заема днешния слот и се стартира.
        Assert.Equal(today, days[aId].ScheduledDate);
        Assert.Equal(ProgramPlanDayStatus.Started, days[aId].Status);

        // B, C, D се изместват напред, в същия ред, и вече не са пропуснати.
        Assert.True(days[bId].ScheduledDate > today);
        Assert.True(days[cId].ScheduledDate > days[bId].ScheduledDate);
        Assert.True(days[dId].ScheduledDate > days[cId].ScheduledDate);
        Assert.Equal(ProgramPlanDayStatus.Rescheduled, days[bId].Status);
        Assert.Equal(ProgramPlanDayStatus.Rescheduled, days[cId].Status);

        // Всички изместени дни лягат на дни от графика (понеделник или четвъртък).
        foreach (var day in days.Values)
        {
            Assert.Contains(day.ScheduledDate.DayOfWeek, new[] { DayOfWeek.Monday, DayOfWeek.Thursday, today.DayOfWeek });
        }

        // Оригиналната дата се пази за история.
        Assert.NotNull(days[bId].OriginalScheduledDate);
    }

    // Нищо не се губи: броят предстоящи тренировки е същият след изместването
    [Fact]
    public async Task StartWorkout_OnMissedDay_KeepsEveryPendingWorkout()
    {
        using var db = new SqliteTestDatabase();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var (planId, aId, _) = await SeedShiftablePlanAsync(db, today);
        var (service, context) = CreateService(db);

        await service.StartWorkoutAsync(aId, SqliteTestDatabase.UserId);

        var days = await context.ProgramPlanDays.AsNoTracking()
            .Where(d => d.ProgramPlanId == planId)
            .ToListAsync();
        Assert.Equal(4, days.Count);
        Assert.DoesNotContain(days, d => d.Status == ProgramPlanDayStatus.Missed);
        Assert.DoesNotContain(days, d => d.Status == ProgramPlanDayStatus.Skipped);
    }

    // Стартиране на редовен (непропуснат) ден не пипа графика
    [Fact]
    public async Task StartWorkout_OnScheduledDay_DoesNotShiftAnything()
    {
        using var db = new SqliteTestDatabase();
        var future = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(3);
        var (planId, dayId, _) = await SeedActivePlanWithDayAsync(db, SqliteTestDatabase.UserId, future);
        var (service, context) = CreateService(db);

        await service.StartWorkoutAsync(dayId, SqliteTestDatabase.UserId);

        var day = await context.ProgramPlanDays.AsNoTracking().SingleAsync(d => d.ProgramPlanId == planId);
        Assert.Equal(future, day.ScheduledDate);
        Assert.Null(day.OriginalScheduledDate);
    }

    /// Пн/Чт план с 2 пропуснати (A, B) и 2 предстоящи (C, D) дни.
    private static async Task<(long PlanId, long FirstMissedDayId, long TemplateId)> SeedShiftablePlanAsync(
        SqliteTestDatabase db,
        DateOnly today)
    {
        await using var context = db.CreateContext();
        var template = new WorkoutTemplate { UserId = SqliteTestDatabase.UserId, Name = "Upper A", IsPublic = false };
        context.WorkoutTemplates.Add(template);
        await context.SaveChangesAsync();

        var plan = new ProgramPlan
        {
            UserId = SqliteTestDatabase.UserId,
            Name = "Shiftable",
            Status = ProgramPlanStatus.Active,
            ScheduleType = ProgramScheduleType.FixedWeekdays,
            StartDate = today.AddDays(-28),
            EndDate = today.AddDays(28),
            TargetWorkoutsPerWeek = 2,
            ScheduleRules =
            [
                new ProgramPlanScheduleRule { DayOfWeek = DayOfWeek.Monday, DayType = ProgramPlanDayType.Workout, WorkoutTemplateId = template.Id, OrderIndex = 0 },
                new ProgramPlanScheduleRule { DayOfWeek = DayOfWeek.Thursday, DayType = ProgramPlanDayType.Workout, WorkoutTemplateId = template.Id, OrderIndex = 1 },
            ],
        };
        context.ProgramPlans.Add(plan);
        await context.SaveChangesAsync();

        var dates = new[]
        {
            (Date: today.AddDays(-14), Status: ProgramPlanDayStatus.Missed),
            (Date: today.AddDays(-7), Status: ProgramPlanDayStatus.Missed),
            (Date: today.AddDays(7), Status: ProgramPlanDayStatus.Scheduled),
            (Date: today.AddDays(14), Status: ProgramPlanDayStatus.Scheduled),
        };

        var created = new List<ProgramPlanDay>();
        foreach (var (date, status) in dates)
        {
            var day = new ProgramPlanDay
            {
                ProgramPlanId = plan.Id,
                ScheduledDate = date,
                DayType = ProgramPlanDayType.Workout,
                Status = status,
                WorkoutTemplateId = template.Id,
                OrderIndex = 0,
            };
            context.ProgramPlanDays.Add(day);
            created.Add(day);
        }

        await context.SaveChangesAsync();
        return (plan.Id, created[0].Id, template.Id);
    }

    [Fact]
    public async Task MarkMissedDays_MarksPastScheduledWorkoutsOnly()
    {
        using var db = new SqliteTestDatabase();
        var (planId, _, templateId) = await SeedActivePlanWithDayAsync(db, SqliteTestDatabase.UserId, new DateOnly(2026, 8, 3));
        await using (var arrange = db.CreateContext())
        {
            arrange.ProgramPlanDays.AddRange(
                new ProgramPlanDay { ProgramPlanId = planId, ScheduledDate = new DateOnly(2026, 8, 4), DayType = ProgramPlanDayType.OptionalWorkout, Status = ProgramPlanDayStatus.Scheduled, WorkoutTemplateId = templateId, OrderIndex = 1 },
                new ProgramPlanDay { ProgramPlanId = planId, ScheduledDate = new DateOnly(2026, 8, 10), DayType = ProgramPlanDayType.Workout, Status = ProgramPlanDayStatus.Scheduled, WorkoutTemplateId = templateId, OrderIndex = 2 });
            await arrange.SaveChangesAsync();
        }
        var (service, context) = CreateService(db);

        await service.MarkMissedDaysAsync(SqliteTestDatabase.UserId, new DateOnly(2026, 8, 6));

        var days = await context.ProgramPlanDays.AsNoTracking().OrderBy(d => d.ScheduledDate).ToListAsync();
        Assert.Equal(ProgramPlanDayStatus.Missed, days[0].Status);    // past mandatory
        Assert.Equal(ProgramPlanDayStatus.Skipped, days[1].Status);   // past optional
        Assert.Equal(ProgramPlanDayStatus.Scheduled, days[2].Status); // future untouched
    }

    [Fact]
    public async Task Move_SetsOriginalDateAndRescheduledStatus()
    {
        using var db = new SqliteTestDatabase();
        var (_, dayId, _) = await SeedActivePlanWithDayAsync(db, SqliteTestDatabase.UserId, new DateOnly(2026, 8, 5));
        var (service, _) = CreateService(db);

        var moved = await service.MoveAsync(dayId, new MoveProgramDayRequest { NewDate = new DateOnly(2026, 8, 6) }, SqliteTestDatabase.UserId);

        Assert.Equal(new DateOnly(2026, 8, 6), moved.ScheduledDate);
        Assert.Equal(new DateOnly(2026, 8, 5), moved.OriginalScheduledDate);
        Assert.Equal(ProgramPlanDayStatus.Rescheduled, moved.Status);
    }

    [Fact]
    public async Task Move_OntoAnotherWorkoutDay_Throws()
    {
        using var db = new SqliteTestDatabase();
        var (planId, dayId, templateId) = await SeedActivePlanWithDayAsync(db, SqliteTestDatabase.UserId, new DateOnly(2026, 8, 5));
        await using (var arrange = db.CreateContext())
        {
            arrange.ProgramPlanDays.Add(new ProgramPlanDay
            {
                ProgramPlanId = planId,
                ScheduledDate = new DateOnly(2026, 8, 6),
                DayType = ProgramPlanDayType.Workout,
                Status = ProgramPlanDayStatus.Scheduled,
                WorkoutTemplateId = templateId,
                OrderIndex = 1,
            });
            await arrange.SaveChangesAsync();
        }
        var (service, _) = CreateService(db);

        await Assert.ThrowsAnyAsync<Exception>(() =>
            service.MoveAsync(dayId, new MoveProgramDayRequest { NewDate = new DateOnly(2026, 8, 6) }, SqliteTestDatabase.UserId));
    }

    [Fact]
    public async Task Move_OntoDateHoldingASkippedDay_TakesTheNextOrderIndex()
    {
        using var db = new SqliteTestDatabase();
        var (planId, dayId, templateId) = await SeedActivePlanWithDayAsync(db, SqliteTestDatabase.UserId, new DateOnly(2026, 8, 5));
        await using (var arrange = db.CreateContext())
        {
            // Same OrderIndex 0 as the day being moved: only a distinct index keeps the
            // unique (plan, date, orderIndex) constraint satisfied.
            arrange.ProgramPlanDays.Add(new ProgramPlanDay
            {
                ProgramPlanId = planId,
                ScheduledDate = new DateOnly(2026, 8, 6),
                DayType = ProgramPlanDayType.Workout,
                Status = ProgramPlanDayStatus.Skipped,
                WorkoutTemplateId = templateId,
                OrderIndex = 0,
            });
            await arrange.SaveChangesAsync();
        }
        var (service, _) = CreateService(db);

        var moved = await service.MoveAsync(dayId, new MoveProgramDayRequest { NewDate = new DateOnly(2026, 8, 6) }, SqliteTestDatabase.UserId);

        Assert.Equal(new DateOnly(2026, 8, 6), moved.ScheduledDate);
    }

    [Fact]
    public async Task Move_OutsideFixedPlanRange_Throws()
    {
        using var db = new SqliteTestDatabase();
        var (_, dayId, _) = await SeedActivePlanWithDayAsync(db, SqliteTestDatabase.UserId, new DateOnly(2026, 8, 5));
        var (service, _) = CreateService(db);

        await Assert.ThrowsAnyAsync<Exception>(() =>
            service.MoveAsync(dayId, new MoveProgramDayRequest { NewDate = new DateOnly(2026, 9, 30) }, SqliteTestDatabase.UserId));
    }

    [Fact]
    public async Task Move_CompletedDay_Throws()
    {
        using var db = new SqliteTestDatabase();
        var (_, dayId, _) = await SeedActivePlanWithDayAsync(db, SqliteTestDatabase.UserId, new DateOnly(2026, 8, 5), ProgramPlanDayStatus.Completed);
        var (service, _) = CreateService(db);

        await Assert.ThrowsAnyAsync<Exception>(() =>
            service.MoveAsync(dayId, new MoveProgramDayRequest { NewDate = new DateOnly(2026, 8, 7) }, SqliteTestDatabase.UserId));
    }

    [Fact]
    public async Task SkipAndRestore_FutureDay_RoundTripsToScheduled()
    {
        using var db = new SqliteTestDatabase();
        var futureDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(7);
        var (_, dayId, _) = await SeedActivePlanWithDayAsync(db, SqliteTestDatabase.UserId, futureDate);
        var (service, _) = CreateService(db);

        var skipped = await service.SkipAsync(dayId, SqliteTestDatabase.UserId);
        Assert.Equal(ProgramPlanDayStatus.Skipped, skipped.Status);

        var restored = await service.RestoreAsync(dayId, SqliteTestDatabase.UserId);
        Assert.Equal(ProgramPlanDayStatus.Scheduled, restored.Status);
    }

    [Fact]
    public async Task Restore_PastSkippedDay_BecomesMissed()
    {
        using var db = new SqliteTestDatabase();
        var pastDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-3);
        var (_, dayId, _) = await SeedActivePlanWithDayAsync(db, SqliteTestDatabase.UserId, pastDate, ProgramPlanDayStatus.Skipped);
        var (service, _) = CreateService(db);

        var restored = await service.RestoreAsync(dayId, SqliteTestDatabase.UserId);

        Assert.Equal(ProgramPlanDayStatus.Missed, restored.Status);
    }

    private static async Task<long> SeedExerciseAsync(SqliteTestDatabase db)
    {
        await using var context = db.CreateContext();
        var exercise = new Exercise
        {
            Name = "Bench Press",
            Slug = "bench-press",
            PrimaryMuscleGroupId = SqliteTestDatabase.ChestId,
        };
        context.Exercises.Add(exercise);
        await context.SaveChangesAsync();
        return exercise.Id;
    }

    private static SaveWorkoutRequest MinimalFinishRequest(long exerciseId) => new()
    {
        Title = "Upper A",
        Exercises =
        [
            new CreateWorkoutExerciseRequest
            {
                ExerciseId = exerciseId,
                GroupType = ExerciseGroupType.Straight,
                OrderIndex = 1,
                Sets =
                [
                    new CreateWorkoutSetRequest
                    {
                        SetType = ExerciseSetType.Working,
                        IsCompleted = true,
                        WeightKg = 60,
                        Reps = 8,
                    },
                ],
            },
        ],
    };
}
