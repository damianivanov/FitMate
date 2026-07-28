using FitMate.DB.Entities;
using FitMate.DB.Enums;

namespace FitMate.Services.ProgramPlans.Schedules;

public class ProgramPlanScheduleService : IProgramPlanScheduleService
{
    public IReadOnlyList<ProgramPlanDay> GenerateDays(ProgramPlan plan, DateOnly from, DateOnly toInclusive)
    {
        if (plan.ScheduleType == ProgramScheduleType.CustomCalendar || toInclusive < from)
        {
            return [];
        }

        var result = new List<ProgramPlanDay>();
        var rotationCycleLength = plan.ScheduleType == ProgramScheduleType.Rotation
            ? plan.ScheduleRules.Max(r => r.RotationDayIndex ?? 0)
            : 0;

        for (var date = from; date <= toInclusive; date = date.AddDays(1))
        {
            if (date < plan.StartDate)
            {
                continue;
            }

            var daysSinceStart = date.DayNumber - plan.StartDate.DayNumber;

            IEnumerable<ProgramPlanScheduleRule> matching = plan.ScheduleType switch
            {
                ProgramScheduleType.FixedWeekdays => plan.ScheduleRules.Where(r =>
                    r.DayOfWeek == date.DayOfWeek
                    && (daysSinceStart / 7) % Math.Max(1, r.WeekInterval) == 0),
                ProgramScheduleType.Rotation when rotationCycleLength > 0 => plan.ScheduleRules.Where(r =>
                    r.RotationDayIndex == (daysSinceStart % rotationCycleLength) + 1),
                _ => [],
            };

            foreach (var rule in matching.Where(r => r.DayType != ProgramPlanDayType.Rest))
            {
                result.Add(new ProgramPlanDay
                {
                    ProgramPlanId = plan.Id,
                    ScheduledDate = date,
                    DayType = rule.IsOptional && rule.DayType == ProgramPlanDayType.Workout
                        ? ProgramPlanDayType.OptionalWorkout
                        : rule.DayType,
                    Status = ProgramPlanDayStatus.Scheduled,
                    WorkoutTemplateId = rule.WorkoutTemplateId,
                    OrderIndex = rule.OrderIndex,
                });
            }
        }

        return result;
    }
}
