using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.ProgramPlans;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.ProgramPlans;
using FitMate.Services.ProgramPlans.Schedules;
using FitMate.Services.Workouts;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.ProgramPlans.Days;

public class ProgramPlanDayService : IProgramPlanDayService
{
    /// <summary>How far ahead to look when the catch-up shift needs slots the plan has not generated yet.</summary>
    private const int SlotGenerationWindowDays = 90;
    private const int MaxSlotGenerationWindows = 6;

    private readonly AppDbContext dbContext;
    private readonly IWorkoutService workoutService;
    private readonly IProgramPlanScheduleService scheduleService;

    public ProgramPlanDayService(
        AppDbContext dbContext,
        IWorkoutService workoutService,
        IProgramPlanScheduleService scheduleService)
    {
        this.dbContext = dbContext;
        this.workoutService = workoutService;
        this.scheduleService = scheduleService;
    }

    public async Task<long> StartWorkoutAsync(long programPlanDayId, long userId)
    {
        await using var transaction = await dbContext.Database.BeginTransactionAsync();

        var day = await LoadOwnedDayAsync(programPlanDayId, userId);

        if (day.ProgramPlan.Status != ProgramPlanStatus.Active)
        {
            throw new FitMateException("The program plan is not active.");
        }

        if (day.DayType == ProgramPlanDayType.Rest)
        {
            throw new FitMateException("Rest days cannot be started.");
        }

        if (day.WorkoutTemplateId == null)
        {
            throw new FitMateException("This day has no workout template.");
        }

        if (day.StartedWorkoutId != null)
        {
            await transaction.CommitAsync();
            return day.StartedWorkoutId.Value;   // idempotent
        }

        // Catching up on a missed day slides the rest of the plan forward instead of dropping it:
        // this day takes today's slot and every still-pending day moves down one training slot.
        if (day.Status == ProgramPlanDayStatus.Missed)
        {
            await ShiftPendingDaysForwardAsync(day, DateOnly.FromDateTime(DateTime.UtcNow));
        }

        var workoutId = await workoutService.StartFromTemplateAsync(day.WorkoutTemplateId.Value, userId, day.Id);
        day.StartedWorkoutId = workoutId;
        day.Status = ProgramPlanDayStatus.Started;
        day.StartedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync();
        await transaction.CommitAsync();
        return workoutId;
    }

    public async Task<ProgramPlanDayModel> MoveAsync(long programPlanDayId, MoveProgramDayRequest request, long userId)
    {
        var day = await LoadOwnedDayAsync(programPlanDayId, userId);

        if (day.Status is ProgramPlanDayStatus.Completed or ProgramPlanDayStatus.Started or ProgramPlanDayStatus.Cancelled)
        {
            throw new FitMateException("This day can no longer be moved.");
        }

        var plan = day.ProgramPlan;
        if (request.NewDate < plan.StartDate || (plan.EndDate.HasValue && request.NewDate > plan.EndDate.Value))
        {
            throw new FitMateException("The new date is outside the program plan range.");
        }

        var conflict = await dbContext.ProgramPlanDays.AnyAsync(d =>
            d.ProgramPlanId == day.ProgramPlanId
            && d.Id != day.Id
            && d.ScheduledDate == request.NewDate
            && d.Status != ProgramPlanDayStatus.Cancelled
            && d.Status != ProgramPlanDayStatus.Skipped
            && (d.DayType == ProgramPlanDayType.Workout || d.DayType == ProgramPlanDayType.OptionalWorkout));
        if (conflict)
        {
            throw new FitMateException("Another workout is already planned on that date.");
        }

        day.OriginalScheduledDate ??= day.ScheduledDate;
        day.ScheduledDate = request.NewDate;
        day.Status = ProgramPlanDayStatus.Rescheduled;
        // OrderIndex is unique per (plan, date); a moved day takes the next free slot on its new date.
        day.OrderIndex = await NextOrderIndexAsync(day.ProgramPlanId, request.NewDate, day.Id);
        await dbContext.SaveChangesAsync();
        return ProgramPlanMapper.ToModel(day);
    }

    public async Task<ProgramPlanDayModel> SkipAsync(long programPlanDayId, long userId)
    {
        var day = await LoadOwnedDayAsync(programPlanDayId, userId);
        if (day.Status is not (ProgramPlanDayStatus.Scheduled or ProgramPlanDayStatus.Missed or ProgramPlanDayStatus.Rescheduled))
        {
            throw new FitMateException("This day cannot be skipped.");
        }

        day.Status = ProgramPlanDayStatus.Skipped;
        await dbContext.SaveChangesAsync();
        return ProgramPlanMapper.ToModel(day);
    }

    public async Task<ProgramPlanDayModel> RestoreAsync(long programPlanDayId, long userId)
    {
        var day = await LoadOwnedDayAsync(programPlanDayId, userId);
        if (day.Status is not (ProgramPlanDayStatus.Skipped or ProgramPlanDayStatus.Missed))
        {
            throw new FitMateException("Only skipped or missed days can be restored.");
        }

        // Restoring a day that is already in the past surfaces it as missed rather than silently
        // scheduling something the user can no longer do on time.
        day.Status = day.ScheduledDate >= DateOnly.FromDateTime(DateTime.UtcNow)
            ? ProgramPlanDayStatus.Scheduled
            : ProgramPlanDayStatus.Missed;
        await dbContext.SaveChangesAsync();
        return ProgramPlanMapper.ToModel(day);
    }

    public async Task MarkMissedDaysAsync(long userId, DateOnly referenceDate)
    {
        var overdue = await dbContext.ProgramPlanDays
            .Where(d => d.ProgramPlan.UserId == userId
                && d.ProgramPlan.Status == ProgramPlanStatus.Active
                && d.ScheduledDate < referenceDate
                && (d.Status == ProgramPlanDayStatus.Scheduled || d.Status == ProgramPlanDayStatus.Rescheduled))
            .ToListAsync();

        foreach (var day in overdue)
        {
            // Optional days carry no adherence penalty, so they retire as Skipped, not Missed.
            day.Status = day.DayType == ProgramPlanDayType.OptionalWorkout
                ? ProgramPlanDayStatus.Skipped
                : ProgramPlanDayStatus.Missed;
        }

        if (overdue.Count > 0)
        {
            await dbContext.SaveChangesAsync();
        }
    }

    /// <summary>
    /// Re-lays every still-pending day of the plan onto the plan's own training slots, starting with
    /// <paramref name="startedDay"/> on <paramref name="today"/>. Nothing is dropped: the queue keeps
    /// its order and simply slides forward, so a missed workout is trained later rather than skipped.
    /// </summary>
    private async Task ShiftPendingDaysForwardAsync(ProgramPlanDay startedDay, DateOnly today)
    {
        var plan = await dbContext.ProgramPlans
            .Include(p => p.ScheduleRules)
            .FirstAsync(p => p.Id == startedDay.ProgramPlanId);

        var pending = await dbContext.ProgramPlanDays
            .Where(d => d.ProgramPlanId == plan.Id
                && (d.Status == ProgramPlanDayStatus.Scheduled
                    || d.Status == ProgramPlanDayStatus.Rescheduled
                    || d.Status == ProgramPlanDayStatus.Missed))
            .OrderBy(d => d.ScheduledDate)
            .ThenBy(d => d.OrderIndex)
            .ToListAsync();

        // Whatever the user chose to start heads the queue; the rest keep their relative order.
        var queue = pending.Where(d => d.Id == startedDay.Id)
            .Concat(pending.Where(d => d.Id != startedDay.Id))
            .ToList();

        var slots = BuildTargetSlots(plan, pending, today, queue.Count);
        var shiftCount = Math.Min(queue.Count, slots.Count);
        if (shiftCount == 0)
        {
            return;
        }

        // Capture the original dates before the parking pass overwrites them.
        var originalDates = queue.Select(d => d.OriginalScheduledDate ?? d.ScheduledDate).ToList();

        // Park every row on a distinct throwaway date first: the unique
        // (ProgramPlanId, ScheduledDate, OrderIndex) index would otherwise trip mid-reshuffle,
        // because EF gives no ordering guarantee between the individual UPDATEs.
        for (var index = 0; index < queue.Count; index++)
        {
            queue[index].ScheduledDate = DateOnly.MaxValue.AddDays(-index);
        }

        await dbContext.SaveChangesAsync();

        for (var index = 0; index < shiftCount; index++)
        {
            var day = queue[index];
            var slot = slots[index];

            day.OriginalScheduledDate = originalDates[index];
            day.ScheduledDate = slot.Date;
            day.OrderIndex = slot.OrderIndex;
            // Rescheduled, not Scheduled: the day genuinely moved, and the calendar already
            // renders that state distinctly. Progress still counts it as remaining, not missed.
            day.Status = ProgramPlanDayStatus.Rescheduled;
        }

        // Anything the plan had no slot for keeps the date it came in with.
        for (var index = shiftCount; index < queue.Count; index++)
        {
            queue[index].ScheduledDate = originalDates[index];
        }

        // A fixed-length plan grows to cover the days it just absorbed.
        var lastDate = slots[shiftCount - 1].Date;
        if (plan.EndDate != null && lastDate > plan.EndDate.Value)
        {
            plan.EndDate = lastDate;
        }

        await dbContext.SaveChangesAsync();
    }

    /// <summary>
    /// The training slots the shifted queue lands on: today, then the plan's already-generated
    /// future slots, then freshly expanded ones in the plan's rhythm when the queue outgrows them.
    /// </summary>
    private List<(DateOnly Date, int OrderIndex)> BuildTargetSlots(
        ProgramPlan plan,
        List<ProgramPlanDay> pending,
        DateOnly today,
        int needed)
    {
        var slots = new List<(DateOnly Date, int OrderIndex)>();
        var seen = new HashSet<(DateOnly, int)>();

        void TryAdd(DateOnly date, int orderIndex)
        {
            if (seen.Add((date, orderIndex)))
            {
                slots.Add((date, orderIndex));
            }
        }

        // Today is the slot the user is standing in — unless the plan already owns one there.
        if (!pending.Any(d => d.ScheduledDate == today))
        {
            TryAdd(today, 0);
        }

        foreach (var day in pending.Where(d => d.ScheduledDate >= today))
        {
            TryAdd(day.ScheduledDate, day.OrderIndex);
        }

        var cursor = slots.Count > 0 ? slots[^1].Date : today;
        for (var window = 0; slots.Count < needed && window < MaxSlotGenerationWindows; window++)
        {
            // CustomCalendar generates nothing — such plans simply stop extending here.
            var generated = scheduleService.GenerateDays(
                plan,
                cursor.AddDays(1),
                cursor.AddDays(SlotGenerationWindowDays));

            foreach (var day in generated.OrderBy(d => d.ScheduledDate).ThenBy(d => d.OrderIndex))
            {
                if (slots.Count >= needed)
                {
                    break;
                }

                TryAdd(day.ScheduledDate, day.OrderIndex);
            }

            if (generated.Count == 0)
            {
                break;
            }

            cursor = cursor.AddDays(SlotGenerationWindowDays);
        }

        return slots;
    }

    private async Task<int> NextOrderIndexAsync(long programPlanId, DateOnly date, long excludedDayId)
    {
        var maxOrderIndex = await dbContext.ProgramPlanDays
            .Where(d => d.ProgramPlanId == programPlanId && d.ScheduledDate == date && d.Id != excludedDayId)
            .MaxAsync(d => (int?)d.OrderIndex);

        return maxOrderIndex.HasValue ? maxOrderIndex.Value + 1 : 0;
    }

    private async Task<ProgramPlanDay> LoadOwnedDayAsync(long dayId, long userId) =>
        await dbContext.ProgramPlanDays
            .Include(d => d.ProgramPlan)
            .FirstOrDefaultAsync(d => d.Id == dayId && d.ProgramPlan.UserId == userId)
        ?? throw new FitMateException("Program day not found.");
}
