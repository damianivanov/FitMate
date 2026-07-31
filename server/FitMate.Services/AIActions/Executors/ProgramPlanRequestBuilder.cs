using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.AIActions;
using FitMate.Core.JsonModels.ProgramPlans;

namespace FitMate.Services.AIActions.Executors;

/// <summary>
/// Turns a validated proposal into the domain save request, resolving each schedule item's client
/// key to the id of the template that was just created for it.
/// </summary>
internal static class ProgramPlanRequestBuilder
{
    internal static SaveProgramPlanRequest Build(
        ProposeProgramPlanPayload payload,
        IReadOnlyDictionary<string, long> templateIdsByKey) => new()
    {
        Name = payload.Name.Trim(),
        Description = payload.Description,
        Goal = payload.Goal,
        ScheduleType = payload.ScheduleType,
        StartDate = payload.StartDate,
        EndDate = payload.EndDate,
        TargetWorkoutsPerWeek = payload.WorkoutsPerWeek,
        ScheduleRules = payload.Schedule
            .Select((item, index) => new ProgramScheduleRuleRequest
            {
                DayOfWeek = item.DayOfWeek,
                RotationDayIndex = item.RotationDayIndex,
                DayType = item.DayType,
                WorkoutTemplateId = ResolveTemplateId(item, templateIdsByKey),
                WeekInterval = 1,
                OrderIndex = index,
                IsOptional = item.IsOptional,
            })
            .ToList(),
    };

    private static long? ResolveTemplateId(
        ProposedProgramScheduleItem item,
        IReadOnlyDictionary<string, long> templateIdsByKey)
    {
        if (item.ExistingWorkoutTemplateId is > 0)
        {
            return item.ExistingWorkoutTemplateId;
        }

        if (string.IsNullOrWhiteSpace(item.NewWorkoutTemplateClientKey))
        {
            return null;
        }

        return templateIdsByKey.TryGetValue(item.NewWorkoutTemplateClientKey, out var id)
            ? id
            : throw new FitMateException(
                $"The schedule references template '{item.NewWorkoutTemplateClientKey}', which was not created.");
    }
}
