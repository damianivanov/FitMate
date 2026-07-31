using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.ProgramPlans;
using FitMate.Core.JsonModels.Subscriptions;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.ProgramPlans;
using FitMate.Services.ProgramPlans.Days;
using FitMate.Services.ProgramPlans.Schedules;
using FitMate.Services.Subscriptions;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.ProgramPlans.Plans;

public class ProgramPlanService : IProgramPlanService
{
    /// <summary>How far ahead open-ended plans keep concrete days generated (roadmap D1).</summary>
    public const int OpenEndedHorizonDays = 28;

    private readonly AppDbContext dbContext;
    private readonly IProgramPlanScheduleService scheduleService;
    private readonly IProgramPlanDayService dayService;
    private readonly IEntitlementService entitlementService;

    public ProgramPlanService(
        AppDbContext dbContext,
        IProgramPlanScheduleService scheduleService,
        IProgramPlanDayService dayService,
        IEntitlementService entitlementService)
    {
        this.dbContext = dbContext;
        this.scheduleService = scheduleService;
        this.dayService = dayService;
        this.entitlementService = entitlementService;
    }

    /// <summary>
    /// How many plans a user may keep active and how long a fixed-length plan may run both come
    /// from the subscription plan. Open-ended plans have no duration to compare, so only the
    /// active-plan ceiling applies to them.
    /// </summary>
    private async Task RequireActivationEntitlementsAsync(ProgramPlan plan, long planId, long userId)
    {
        var activePlans = await entitlementService.GetEntitlementAsync(
            userId,
            SubscriptionFeature.ActiveProgramPlans);

        if (activePlans is not { IsEnabled: true })
        {
            throw new SubscriptionFeatureDisabledException(SubscriptionFeature.ActiveProgramPlans);
        }

        if (activePlans.HardLimit is { } maxActivePlans)
        {
            var activeCount = await dbContext.ProgramPlans
                .CountAsync(p => p.UserId == userId && p.Status == ProgramPlanStatus.Active && p.Id != planId);

            if (activeCount >= maxActivePlans)
            {
                throw new SubscriptionLimitExceededException(new SubscriptionLimitErrorModel
                {
                    Feature = SubscriptionFeature.ActiveProgramPlans,
                    Limit = maxActivePlans,
                    Used = activeCount,
                    UpgradeAvailable = true,
                });
            }
        }

        if (plan.EndDate is not { } endDate)
        {
            return;
        }

        var duration = await entitlementService.GetEntitlementAsync(
            userId,
            SubscriptionFeature.ProgramPlanDurationMonths);

        if (duration?.HardLimit is { } maxMonths && endDate > plan.StartDate.AddMonths(maxMonths))
        {
            throw new SubscriptionLimitExceededException(new SubscriptionLimitErrorModel
            {
                Feature = SubscriptionFeature.ProgramPlanDurationMonths,
                Limit = maxMonths,
                Used = maxMonths,
                UpgradeAvailable = true,
            });
        }
    }

    public async Task<IReadOnlyList<ProgramPlanModel>> ListAsync(long userId)
    {
        var plans = await dbContext.ProgramPlans
            .AsNoTracking()
            .Include(p => p.ScheduleRules).ThenInclude(r => r.WorkoutTemplate)
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.DateCreated)
            .ThenByDescending(p => p.Id)
            .ToListAsync();

        return plans.Select(ProgramPlanMapper.ToModel).ToList();
    }

    public async Task<ProgramPlanModel?> GetByIdAsync(long planId, long userId)
    {
        var plan = await LoadOwnedAsync(planId, userId, track: false);
        return plan == null ? null : ProgramPlanMapper.ToModel(plan);
    }

    public async Task<ProgramPlanModel> CreateDraftAsync(SaveProgramPlanRequest request, long userId)
    {
        await ValidateAsync(request, userId);

        var plan = new ProgramPlan
        {
            UserId = userId,
            Status = ProgramPlanStatus.Draft,
        };
        ApplyRequest(plan, request);
        dbContext.ProgramPlans.Add(plan);
        await dbContext.SaveChangesAsync();
        return (await GetByIdAsync(plan.Id, userId))!;
    }

    public async Task<ProgramPlanModel> UpdateDraftAsync(long planId, SaveProgramPlanRequest request, long userId)
    {
        var plan = await LoadOwnedAsync(planId, userId, track: true)
            ?? throw new FitMateException("Program plan not found.");

        if (plan.Status != ProgramPlanStatus.Draft)
        {
            throw new FitMateException("Only draft plans can be edited.");
        }

        await ValidateAsync(request, userId);

        // Clear rules and any previously stored custom days first: the unique
        // (ProgramPlanId, ScheduledDate, OrderIndex) index would otherwise collide with the
        // replacements when EF batches the inserts alongside the deletes.
        dbContext.ProgramPlanScheduleRules.RemoveRange(plan.ScheduleRules);
        plan.ScheduleRules.Clear();
        var existingDays = await dbContext.ProgramPlanDays
            .Where(d => d.ProgramPlanId == plan.Id)
            .ToListAsync();
        dbContext.ProgramPlanDays.RemoveRange(existingDays);
        await dbContext.SaveChangesAsync();

        ApplyRequest(plan, request);
        await dbContext.SaveChangesAsync();
        return (await GetByIdAsync(plan.Id, userId))!;
    }

    public async Task<ProgramPlanModel> UpdateActiveScheduleAsync(
        long planId,
        SaveProgramPlanRequest request,
        DateOnly effectiveFrom,
        long userId)
    {
        await using var transaction = await dbContext.Database.BeginTransactionAsync();

        var plan = await LoadOwnedAsync(planId, userId, track: true)
            ?? throw new FitMateException("Program plan not found.");

        if (plan.Status != ProgramPlanStatus.Active)
        {
            throw new FitMateException("Only active plans can be rescheduled.");
        }

        if (plan.ScheduleType == ProgramScheduleType.CustomCalendar)
        {
            throw new FitMateException("Custom calendar plans cannot be rescheduled this way.");
        }

        if (request.ScheduleType != plan.ScheduleType)
        {
            throw new FitMateException("The schedule type of an active plan cannot be changed.");
        }

        await ValidateAsync(request, userId);

        var futureScheduled = await dbContext.ProgramPlanDays
            .Where(d => d.ProgramPlanId == plan.Id
                && d.ScheduledDate >= effectiveFrom
                && d.Status == ProgramPlanDayStatus.Scheduled)
            .ToListAsync();

        dbContext.ProgramPlanDays.RemoveRange(futureScheduled);
        dbContext.ProgramPlanScheduleRules.RemoveRange(plan.ScheduleRules);
        plan.ScheduleRules.Clear();
        await dbContext.SaveChangesAsync();

        // The rotation phase is measured from the original start date, so keep it even though the
        // caller sends a full save request.
        var originalStartDate = plan.StartDate;
        ApplyRequest(plan, request);
        plan.StartDate = originalStartDate;

        var horizonEnd = plan.EndDate ?? effectiveFrom.AddDays(OpenEndedHorizonDays);

        // Days the user already touched stay put; regenerating over them would violate the unique
        // (ProgramPlanId, ScheduledDate, OrderIndex) index.
        var survivingDates = await dbContext.ProgramPlanDays
            .Where(d => d.ProgramPlanId == plan.Id && d.ScheduledDate >= effectiveFrom)
            .Select(d => d.ScheduledDate)
            .ToListAsync();

        var regenerated = scheduleService.GenerateDays(plan, effectiveFrom, horizonEnd)
            .Where(d => !survivingDates.Contains(d.ScheduledDate))
            .ToList();

        dbContext.ProgramPlanDays.AddRange(regenerated);
        await dbContext.SaveChangesAsync();
        await transaction.CommitAsync();

        return (await GetByIdAsync(plan.Id, userId))!;
    }

    public async Task<ProgramPlanModel> ActivateAsync(long planId, long userId)
    {
        await using var transaction = await dbContext.Database.BeginTransactionAsync();

        var plan = await LoadOwnedAsync(planId, userId, track: true)
            ?? throw new FitMateException("Program plan not found.");

        if (plan.Status != ProgramPlanStatus.Draft && plan.Status != ProgramPlanStatus.Paused)
        {
            throw new FitMateException("Only draft or paused plans can be activated.");
        }

        await RequireActivationEntitlementsAsync(plan, planId, userId);

        if (plan.Status == ProgramPlanStatus.Draft)
        {
            if (plan.ScheduleType == ProgramScheduleType.CustomCalendar)
            {
                var outside = await dbContext.ProgramPlanDays.AnyAsync(d =>
                    d.ProgramPlanId == plan.Id
                    && (d.ScheduledDate < plan.StartDate || d.ScheduledDate > plan.EndDate));
                if (outside)
                {
                    throw new FitMateException("Custom days fall outside the plan date range.");
                }
            }
            else
            {
                var today = DateOnly.FromDateTime(DateTime.UtcNow);
                var to = plan.EndDate
                    ?? (plan.StartDate > today ? plan.StartDate : today).AddDays(OpenEndedHorizonDays);
                var days = scheduleService.GenerateDays(plan, plan.StartDate, to);
                dbContext.ProgramPlanDays.AddRange(days);
            }

            plan.ActivatedAt = DateTime.UtcNow;
        }

        plan.Status = ProgramPlanStatus.Active;
        await dbContext.SaveChangesAsync();
        await transaction.CommitAsync();
        return (await GetByIdAsync(plan.Id, userId))!;
    }

    public async Task PauseAsync(long planId, long userId)
    {
        var plan = await RequireOwnedAsync(planId, userId);
        if (plan.Status != ProgramPlanStatus.Active)
        {
            throw new FitMateException("Only active plans can be paused.");
        }

        plan.Status = ProgramPlanStatus.Paused;
        await dbContext.SaveChangesAsync();
    }

    public async Task CompleteAsync(long planId, long userId)
    {
        var plan = await RequireOwnedAsync(planId, userId);
        if (plan.Status != ProgramPlanStatus.Active && plan.Status != ProgramPlanStatus.Paused)
        {
            throw new FitMateException("Only active or paused plans can be completed.");
        }

        plan.Status = ProgramPlanStatus.Completed;
        plan.CompletedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync();
    }

    public async Task CancelAsync(long planId, long userId)
    {
        var plan = await RequireOwnedAsync(planId, userId);
        if (plan.Status is ProgramPlanStatus.Completed or ProgramPlanStatus.Cancelled)
        {
            throw new FitMateException("Plan is already finished.");
        }

        plan.Status = ProgramPlanStatus.Cancelled;
        await dbContext.SaveChangesAsync();
    }

    public async Task<bool> DeleteDraftAsync(long planId, long userId)
    {
        var plan = await dbContext.ProgramPlans
            .FirstOrDefaultAsync(p => p.Id == planId && p.UserId == userId);
        if (plan == null || plan.Status != ProgramPlanStatus.Draft)
        {
            return false;
        }

        dbContext.ProgramPlans.Remove(plan); // cascades to rules and days
        await dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<ProgramPlanModel?> GetActiveAsync(long userId)
    {
        var plan = await LoadActiveAsync(userId);
        return plan == null ? null : ProgramPlanMapper.ToModel(plan);
    }

    public async Task<ProgramTodayModel> GetTodayAsync(long userId, DateOnly date)
    {
        var plan = await dbContext.ProgramPlans
            .Include(p => p.ScheduleRules)
            .FirstOrDefaultAsync(p => p.UserId == userId && p.Status == ProgramPlanStatus.Active);

        if (plan == null)
        {
            return new ProgramTodayModel { Date = date, HasActiveProgram = false };
        }

        await EnsureUpcomingDaysAsync(plan, date);
        await dayService.MarkMissedDaysAsync(userId, date);

        var days = await LoadDayDetailsQuery()
            .Where(d => d.ProgramPlanId == plan.Id && d.Status != ProgramPlanDayStatus.Cancelled)
            .OrderBy(d => d.ScheduledDate).ThenBy(d => d.OrderIndex)
            .ToListAsync();

        var today = days.FirstOrDefault(d => d.ScheduledDate == date
            && d.Status is ProgramPlanDayStatus.Scheduled or ProgramPlanDayStatus.Started
                or ProgramPlanDayStatus.Rescheduled or ProgramPlanDayStatus.Completed);
        var missed = days.FirstOrDefault(d => d.Status == ProgramPlanDayStatus.Missed);
        var next = days.FirstOrDefault(d => d.ScheduledDate > date
            && (d.DayType == ProgramPlanDayType.Workout || d.DayType == ProgramPlanDayType.OptionalWorkout)
            && d.Status is ProgramPlanDayStatus.Scheduled or ProgramPlanDayStatus.Rescheduled);

        return new ProgramTodayModel
        {
            Date = date,
            HasActiveProgram = true,
            ProgramId = plan.Id,
            ProgramName = plan.Name,
            Today = today == null ? null : ProgramPlanMapper.ToModel(today),
            MissedWorkout = missed == null ? null : ProgramPlanMapper.ToModel(missed),
            NextWorkout = next == null ? null : ProgramPlanMapper.ToModel(next),
        };
    }

    public async Task<IReadOnlyList<ProgramPlanDayModel>> GetCalendarAsync(long planId, long userId, int year, int month)
    {
        var plan = await dbContext.ProgramPlans
            .Include(p => p.ScheduleRules)
            .FirstOrDefaultAsync(p => p.Id == planId && p.UserId == userId)
            ?? throw new FitMateException("Program plan not found.");

        var monthStart = new DateOnly(year, month, 1);
        var monthEnd = monthStart.AddMonths(1).AddDays(-1);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Generate far enough ahead that a month browsed beyond the current horizon is populated.
        await EnsureUpcomingDaysAsync(plan, monthEnd > today ? monthEnd : today);
        await dayService.MarkMissedDaysAsync(userId, today);

        var days = await LoadDayDetailsQuery()
            .Where(d => d.ProgramPlanId == plan.Id
                && d.ScheduledDate >= monthStart && d.ScheduledDate <= monthEnd)
            .OrderBy(d => d.ScheduledDate).ThenBy(d => d.OrderIndex)
            .ToListAsync();

        return days.Select(ProgramPlanMapper.ToModel).ToList();
    }

    public async Task<ProgramProgressModel> GetProgressAsync(long planId, long userId, DateOnly today)
    {
        var plan = await dbContext.ProgramPlans
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == planId && p.UserId == userId)
            ?? throw new FitMateException("Program plan not found.");

        var workoutDays = await dbContext.ProgramPlanDays
            .AsNoTracking()
            .Where(d => d.ProgramPlanId == planId
                && d.Status != ProgramPlanDayStatus.Cancelled
                && (d.DayType == ProgramPlanDayType.Workout || d.DayType == ProgramPlanDayType.OptionalWorkout))
            .OrderBy(d => d.ScheduledDate)
            .ToListAsync();

        var completed = workoutDays.Count(d => d.Status == ProgramPlanDayStatus.Completed);
        var due = workoutDays.Count(d => d.ScheduledDate <= today);

        var streak = 0;
        foreach (var day in workoutDays
                     .Where(d => d.DayType == ProgramPlanDayType.Workout && d.ScheduledDate <= today)
                     .OrderByDescending(d => d.ScheduledDate))
        {
            // A skipped day is neutral and today's in-progress workout has not failed yet, so
            // neither breaks the streak; a missed day ends it.
            if (day.Status is ProgramPlanDayStatus.Skipped or ProgramPlanDayStatus.Started)
            {
                continue;
            }

            if (day.Status == ProgramPlanDayStatus.Completed)
            {
                streak++;
                continue;
            }

            break;
        }

        return new ProgramProgressModel
        {
            ScheduledWorkouts = workoutDays.Count,
            CompletedWorkouts = completed,
            StartedWorkouts = workoutDays.Count(d => d.Status == ProgramPlanDayStatus.Started),
            MissedWorkouts = workoutDays.Count(d => d.Status == ProgramPlanDayStatus.Missed),
            SkippedWorkouts = workoutDays.Count(d => d.Status == ProgramPlanDayStatus.Skipped),
            RemainingWorkouts = workoutDays.Count(d => d.ScheduledDate >= today
                && d.Status is ProgramPlanDayStatus.Scheduled or ProgramPlanDayStatus.Rescheduled),
            CompletionPercentage = plan.EndDate == null || workoutDays.Count == 0
                ? null
                : Math.Round(completed * 100m / workoutDays.Count, 2),
            AdherencePercentage = due == 0 ? 100m : Math.Round(completed * 100m / due, 2),
            CurrentStreak = streak,
        };
    }

    /// <summary>
    /// Keeps an open-ended plan's persisted calendar filled to the rolling horizon. Idempotent:
    /// generation always starts after the last persisted day (roadmap D1).
    /// </summary>
    private async Task EnsureUpcomingDaysAsync(ProgramPlan plan, DateOnly referenceDate)
    {
        if (plan.EndDate != null
            || plan.Status != ProgramPlanStatus.Active
            || plan.ScheduleType == ProgramScheduleType.CustomCalendar)
        {
            return;
        }

        var maxGenerated = await dbContext.ProgramPlanDays
            .Where(d => d.ProgramPlanId == plan.Id)
            .MaxAsync(d => (DateOnly?)d.ScheduledDate) ?? plan.StartDate.AddDays(-1);

        var horizonEnd = referenceDate.AddDays(OpenEndedHorizonDays);
        if (maxGenerated >= horizonEnd)
        {
            return;
        }

        var newDays = scheduleService.GenerateDays(plan, maxGenerated.AddDays(1), horizonEnd);
        if (newDays.Count > 0)
        {
            dbContext.ProgramPlanDays.AddRange(newDays);
            await dbContext.SaveChangesAsync();
        }
    }

    private IQueryable<ProgramPlanDay> LoadDayDetailsQuery() =>
        dbContext.ProgramPlanDays
            .AsNoTracking()
            .Include(d => d.WorkoutTemplate!).ThenInclude(t => t.ExerciseGroups).ThenInclude(g => g.Exercises);

    private void ApplyRequest(ProgramPlan plan, SaveProgramPlanRequest request)
    {
        plan.Name = request.Name.Trim();
        plan.Description = request.Description;
        plan.Goal = request.Goal;
        plan.ScheduleType = request.ScheduleType;
        plan.StartDate = request.StartDate;
        plan.EndDate = request.EndDate;
        plan.TargetWorkoutsPerWeek = request.TargetWorkoutsPerWeek;

        foreach (var rule in request.ScheduleRules)
        {
            plan.ScheduleRules.Add(new ProgramPlanScheduleRule
            {
                DayOfWeek = rule.DayOfWeek,
                RotationDayIndex = rule.RotationDayIndex,
                DayType = rule.DayType,
                WorkoutTemplateId = rule.WorkoutTemplateId,
                WeekInterval = rule.WeekInterval,
                OrderIndex = rule.OrderIndex,
                IsOptional = rule.IsOptional,
            });
        }

        // Rule-driven plans generate their calendar at activation. A custom calendar has no rules to
        // expand, so its days ARE the plan and are persisted with the draft.
        if (request.ScheduleType != ProgramScheduleType.CustomCalendar)
        {
            return;
        }

        var orderPerDate = new Dictionary<DateOnly, int>();
        foreach (var day in request.CustomDays.OrderBy(d => d.Date))
        {
            orderPerDate.TryGetValue(day.Date, out var order);
            orderPerDate[day.Date] = order + 1;
            plan.Days.Add(new ProgramPlanDay
            {
                ScheduledDate = day.Date,
                DayType = day.DayType,
                Status = ProgramPlanDayStatus.Scheduled,
                WorkoutTemplateId = day.WorkoutTemplateId,
                Notes = day.Notes,
                OrderIndex = order,
            });
        }
    }

    private async Task ValidateAsync(SaveProgramPlanRequest request, long userId)
    {
        var referencedIds = request.ScheduleRules
            .Where(r => r.WorkoutTemplateId.HasValue)
            .Select(r => r.WorkoutTemplateId!.Value)
            .Concat(request.CustomDays.Where(d => d.WorkoutTemplateId.HasValue).Select(d => d.WorkoutTemplateId!.Value))
            .Distinct()
            .ToList();

        var visibleIds = await dbContext.WorkoutTemplates
            .Where(t => referencedIds.Contains(t.Id) && (t.UserId == userId || t.IsPublic))
            .Select(t => t.Id)
            .ToListAsync();

        ProgramPlanValidator.Validate(request, visibleIds);
    }

    private Task<ProgramPlan?> LoadOwnedAsync(long planId, long userId, bool track)
    {
        var query = dbContext.ProgramPlans
            .Include(p => p.ScheduleRules).ThenInclude(r => r.WorkoutTemplate)
            .Where(p => p.Id == planId && p.UserId == userId);

        return (track ? query : query.AsNoTracking()).FirstOrDefaultAsync();
    }

    private Task<ProgramPlan?> LoadActiveAsync(long userId) =>
        dbContext.ProgramPlans
            .AsNoTracking()
            .Include(p => p.ScheduleRules).ThenInclude(r => r.WorkoutTemplate)
            .FirstOrDefaultAsync(p => p.UserId == userId && p.Status == ProgramPlanStatus.Active);

    private async Task<ProgramPlan> RequireOwnedAsync(long planId, long userId) =>
        await dbContext.ProgramPlans.FirstOrDefaultAsync(p => p.Id == planId && p.UserId == userId)
        ?? throw new FitMateException("Program plan not found.");
}
