using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.ProgramPlans;
using FitMate.DB.Enums;

namespace FitMate.Services.ProgramPlans;

public static class ProgramPlanValidator
{
    public static void Validate(SaveProgramPlanRequest request, IReadOnlyList<long> visibleTemplateIds)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            throw new FitMateException("Program name is required.");
        }

        if (request.EndDate.HasValue && request.EndDate.Value < request.StartDate)
        {
            throw new FitMateException("The end date must be on or after the start date.");
        }

        if (request.TargetWorkoutsPerWeek is < 1 or > 7)
        {
            throw new FitMateException("Target workouts per week must be between 1 and 7.");
        }

        if (request.ScheduleType == ProgramScheduleType.CustomCalendar && request.EndDate == null)
        {
            throw new FitMateException("A custom calendar program needs an end date.");
        }

        var rules = request.ScheduleRules;

        if (request.ScheduleType == ProgramScheduleType.FixedWeekdays)
        {
            if (rules.Any(r => r.DayOfWeek == null || r.RotationDayIndex != null))
            {
                throw new FitMateException("Fixed-weekday rules must set a weekday and no rotation index.");
            }

            if (rules.Select(r => r.DayOfWeek).Distinct().Count() != rules.Count)
            {
                throw new FitMateException("Each weekday can only be used once.");
            }
        }

        if (request.ScheduleType == ProgramScheduleType.Rotation)
        {
            if (rules.Any(r => r.RotationDayIndex == null || r.DayOfWeek != null))
            {
                throw new FitMateException("Rotation rules must set a rotation index and no weekday.");
            }

            var indexes = rules.Select(r => r.RotationDayIndex!.Value).OrderBy(index => index).ToList();
            if (indexes.Where((index, position) => index != position + 1).Any())
            {
                throw new FitMateException("Rotation day indexes must be sequential starting at 1.");
            }
        }

        if (rules.Any(r => r.DayType == ProgramPlanDayType.Workout && r.WorkoutTemplateId == null))
        {
            throw new FitMateException("Every workout day needs a workout template.");
        }

        var referencedTemplateIds = rules
            .Where(r => r.WorkoutTemplateId.HasValue)
            .Select(r => r.WorkoutTemplateId!.Value)
            .Concat(request.CustomDays.Where(d => d.WorkoutTemplateId.HasValue).Select(d => d.WorkoutTemplateId!.Value))
            .Distinct();

        if (referencedTemplateIds.Any(id => !visibleTemplateIds.Contains(id)))
        {
            throw new FitMateException("One of the selected workout templates is not available.");
        }

        if (request.ScheduleType == ProgramScheduleType.CustomCalendar)
        {
            if (request.CustomDays.Count == 0)
            {
                throw new FitMateException("Add at least one day to the custom calendar.");
            }

            if (request.CustomDays.Any(d => d.Date < request.StartDate || d.Date > request.EndDate))
            {
                throw new FitMateException("Custom days must fall between the start and end dates.");
            }

            var distinctDays = request.CustomDays
                .Select(d => (d.Date, d.DayType, d.WorkoutTemplateId))
                .Distinct()
                .Count();
            if (distinctDays != request.CustomDays.Count)
            {
                throw new FitMateException("The custom calendar contains duplicate days.");
            }

            if (request.CustomDays.Any(d => d.DayType == ProgramPlanDayType.Workout && d.WorkoutTemplateId == null))
            {
                throw new FitMateException("Every workout day needs a workout template.");
            }
        }
        else if (rules.All(r => r.DayType == ProgramPlanDayType.Rest))
        {
            throw new FitMateException("The schedule needs at least one training day.");
        }
    }
}
