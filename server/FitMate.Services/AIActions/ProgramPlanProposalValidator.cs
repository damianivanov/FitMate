using FitMate.Core.JsonModels.AIActions;
using FitMate.DB.Enums;

namespace FitMate.Services.AIActions;

/// <summary>
/// Everything wrong with a proposed program, split into errors (block confirmation) and warnings
/// (the user may confirm anyway). Pure, so it runs identically at proposal and confirmation time.
/// </summary>
public sealed class ProgramPlanProposalValidation
{
    public List<string> Errors { get; } = [];
    public List<string> Warnings { get; } = [];
}

public static class ProgramPlanProposalValidator
{
    private const int MaxProgramWeeks = 26;

    public static ProgramPlanProposalValidation Validate(
        ProposeProgramPlanPayload payload,
        IReadOnlyCollection<long> visibleTemplateIds,
        IReadOnlyCollection<long> visibleExerciseIds,
        int? maximumDurationMonths)
    {
        var result = new ProgramPlanProposalValidation();

        if (string.IsNullOrWhiteSpace(payload.Name))
        {
            result.Errors.Add("The program needs a name.");
        }

        if (payload.EndDate is { } endDate && endDate < payload.StartDate)
        {
            result.Errors.Add("The end date cannot be before the start date.");
        }

        if (payload.WorkoutsPerWeek is < 1 or > 7)
        {
            result.Errors.Add("Workouts per week must be between 1 and 7.");
        }

        // The model has no per-date field, so it cannot express a custom calendar.
        if (payload.ScheduleType == ProgramScheduleType.CustomCalendar)
        {
            result.Errors.Add("Custom calendars cannot be proposed; use fixed weekdays or a rotation.");
        }

        if (payload.EndDate is { } end && maximumDurationMonths is { } maxMonths
            && end > payload.StartDate.AddMonths(maxMonths))
        {
            result.Errors.Add($"Your plan allows programs of at most {maxMonths} month(s).");
        }

        ValidateSchedule(payload, result);
        ValidateTemplates(payload, visibleTemplateIds, visibleExerciseIds, result);
        AddWarnings(payload, result);

        return result;
    }

    private static void ValidateSchedule(ProposeProgramPlanPayload payload, ProgramPlanProposalValidation result)
    {
        var trainingItems = payload.Schedule
            .Where(x => x.DayType != ProgramPlanDayType.Rest)
            .ToList();

        if (trainingItems.Count == 0)
        {
            result.Errors.Add("The program has no training days.");
            return;
        }

        switch (payload.ScheduleType)
        {
            case ProgramScheduleType.FixedWeekdays:
                if (payload.Schedule.Any(x => x.DayOfWeek == null))
                {
                    result.Errors.Add("Every fixed-weekday item needs a day of the week.");
                }

                if (payload.Schedule.Any(x => x.RotationDayIndex != null))
                {
                    result.Errors.Add("Fixed-weekday items must not carry a rotation index.");
                }

                var duplicateDays = payload.Schedule
                    .Where(x => x.DayOfWeek != null)
                    .GroupBy(x => x.DayOfWeek)
                    .Where(group => group.Count() > 1)
                    .Select(group => group.Key!.Value.ToString())
                    .ToList();

                if (duplicateDays.Count > 0)
                {
                    result.Errors.Add($"Duplicate weekday(s): {string.Join(", ", duplicateDays)}.");
                }

                break;

            case ProgramScheduleType.Rotation:
                if (payload.Schedule.Any(x => x.RotationDayIndex == null))
                {
                    result.Errors.Add("Every rotation item needs a rotation day index.");
                    break;
                }

                if (payload.Schedule.Any(x => x.DayOfWeek != null))
                {
                    result.Errors.Add("Rotation items must not carry a weekday.");
                }

                var indexes = payload.Schedule
                    .Select(x => x.RotationDayIndex!.Value)
                    .OrderBy(x => x)
                    .ToList();

                var expected = Enumerable.Range(1, indexes.Count).ToList();
                if (!indexes.SequenceEqual(expected))
                {
                    result.Errors.Add("Rotation day indexes must run 1..N with no gaps or duplicates.");
                }

                break;
        }

        foreach (var item in trainingItems)
        {
            var hasExisting = item.ExistingWorkoutTemplateId is > 0;
            var hasNew = !string.IsNullOrWhiteSpace(item.NewWorkoutTemplateClientKey);

            if (!hasExisting && !hasNew)
            {
                result.Errors.Add("Every training day needs a workout template.");
                break;
            }

            if (hasExisting && hasNew)
            {
                result.Errors.Add("A training day cannot use both an existing and a new template.");
                break;
            }
        }
    }

    private static void ValidateTemplates(
        ProposeProgramPlanPayload payload,
        IReadOnlyCollection<long> visibleTemplateIds,
        IReadOnlyCollection<long> visibleExerciseIds,
        ProgramPlanProposalValidation result)
    {
        var referencedExistingIds = payload.Schedule
            .Where(x => x.ExistingWorkoutTemplateId is > 0)
            .Select(x => x.ExistingWorkoutTemplateId!.Value)
            .Distinct()
            .ToList();

        foreach (var templateId in referencedExistingIds.Where(id => !visibleTemplateIds.Contains(id)))
        {
            result.Errors.Add($"Workout template {templateId} does not exist or is not available to you.");
        }

        var clientKeys = payload.NewTemplates.Select(x => x.ClientKey).ToList();
        if (clientKeys.Any(string.IsNullOrWhiteSpace))
        {
            result.Errors.Add("Every proposed template needs a client key.");
        }

        var duplicateKeys = clientKeys
            .Where(key => !string.IsNullOrWhiteSpace(key))
            .GroupBy(key => key, StringComparer.OrdinalIgnoreCase)
            .Where(group => group.Count() > 1)
            .Select(group => group.Key)
            .ToList();

        if (duplicateKeys.Count > 0)
        {
            result.Errors.Add($"Duplicate template key(s): {string.Join(", ", duplicateKeys)}.");
        }

        var referencedKeys = payload.Schedule
            .Where(x => !string.IsNullOrWhiteSpace(x.NewWorkoutTemplateClientKey))
            .Select(x => x.NewWorkoutTemplateClientKey!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        foreach (var key in referencedKeys.Where(key =>
                     !clientKeys.Contains(key, StringComparer.OrdinalIgnoreCase)))
        {
            result.Errors.Add($"The schedule references template '{key}', which was not proposed.");
        }

        foreach (var template in payload.NewTemplates)
        {
            if (string.IsNullOrWhiteSpace(template.Name))
            {
                result.Errors.Add($"Template '{template.ClientKey}' needs a name.");
            }

            var exerciseErrors = AIProposalValidator.ValidateExercises(template.Exercises, visibleExerciseIds);
            foreach (var error in exerciseErrors)
            {
                result.Errors.Add($"{template.Name}: {error}");
            }
        }

        var unusedKeys = clientKeys
            .Where(key => !string.IsNullOrWhiteSpace(key))
            .Where(key => !referencedKeys.Contains(key, StringComparer.OrdinalIgnoreCase))
            .ToList();

        if (unusedKeys.Count > 0)
        {
            result.Warnings.Add(
                $"Proposed template(s) {string.Join(", ", unusedKeys)} are never scheduled.");
        }
    }

    private static void AddWarnings(ProposeProgramPlanPayload payload, ProgramPlanProposalValidation result)
    {
        var trainingDayCount = payload.Schedule.Count(x => x.DayType != ProgramPlanDayType.Rest);

        if (payload.ScheduleType == ProgramScheduleType.FixedWeekdays
            && trainingDayCount != payload.WorkoutsPerWeek)
        {
            result.Warnings.Add(
                $"The schedule has {trainingDayCount} training day(s) but says {payload.WorkoutsPerWeek} per week.");
        }

        if (payload.ScheduleType == ProgramScheduleType.FixedWeekdays)
        {
            var consecutive = CountLongestConsecutiveWeekdays(payload);
            if (consecutive > 3)
            {
                result.Warnings.Add($"The plan contains {consecutive} consecutive training days.");
            }
        }

        if (payload.EndDate is { } end)
        {
            var weeks = (end.DayNumber - payload.StartDate.DayNumber) / 7;
            if (weeks > MaxProgramWeeks)
            {
                result.Warnings.Add($"This program runs for about {weeks} weeks.");
            }
        }
    }

    /// <summary>Counts the longest run of training weekdays, wrapping across the week boundary.</summary>
    private static int CountLongestConsecutiveWeekdays(ProposeProgramPlanPayload payload)
    {
        var trainingDays = payload.Schedule
            .Where(x => x.DayType != ProgramPlanDayType.Rest && x.DayOfWeek != null)
            .Select(x => (int)x.DayOfWeek!.Value)
            .ToHashSet();

        if (trainingDays.Count is 0 or 7)
        {
            return trainingDays.Count;
        }

        var longest = 0;
        var current = 0;

        // Two passes so a run spanning Sunday into Monday is counted.
        for (var i = 0; i < 14; i++)
        {
            if (trainingDays.Contains(i % 7))
            {
                current++;
                longest = Math.Max(longest, current);
            }
            else
            {
                current = 0;
            }
        }

        return Math.Min(longest, trainingDays.Count);
    }
}
