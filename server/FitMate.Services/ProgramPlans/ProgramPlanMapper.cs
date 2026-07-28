using FitMate.Core.JsonModels.ProgramPlans;
using FitMate.DB.Entities;

namespace FitMate.Services.ProgramPlans;

public static class ProgramPlanMapper
{
    public static ProgramPlanModel ToModel(ProgramPlan plan) => new()
    {
        Id = plan.Id,
        Name = plan.Name,
        Description = plan.Description,
        Goal = plan.Goal,
        Status = plan.Status,
        ScheduleType = plan.ScheduleType,
        StartDate = plan.StartDate,
        EndDate = plan.EndDate,
        TargetWorkoutsPerWeek = plan.TargetWorkoutsPerWeek,
        IsAiGenerated = plan.IsAiGenerated,
        ActivatedAt = plan.ActivatedAt,
        CompletedAt = plan.CompletedAt,
        ScheduleRules = plan.ScheduleRules
            .OrderBy(r => r.OrderIndex)
            .Select(ToModel)
            .ToList(),
    };

    public static ProgramPlanScheduleRuleModel ToModel(ProgramPlanScheduleRule rule) => new()
    {
        Id = rule.Id,
        DayOfWeek = rule.DayOfWeek,
        RotationDayIndex = rule.RotationDayIndex,
        DayType = rule.DayType,
        WorkoutTemplateId = rule.WorkoutTemplateId,
        WorkoutTemplateName = rule.WorkoutTemplate?.Name,
        WeekInterval = rule.WeekInterval,
        OrderIndex = rule.OrderIndex,
        IsOptional = rule.IsOptional,
    };

    public static ProgramPlanDayModel ToModel(ProgramPlanDay day) => new()
    {
        Id = day.Id,
        ProgramPlanId = day.ProgramPlanId,
        ScheduledDate = day.ScheduledDate,
        OriginalScheduledDate = day.OriginalScheduledDate,
        DayType = day.DayType,
        Status = day.Status,
        WorkoutTemplateId = day.WorkoutTemplateId,
        WorkoutTemplateName = day.WorkoutTemplate?.Name,
        EstimatedDurationMinutes = day.WorkoutTemplate?.EstimatedDurationMinutes,
        ExerciseCount = day.WorkoutTemplate?.ExerciseGroups.Sum(group => group.Exercises.Count) ?? 0,
        StartedWorkoutId = day.StartedWorkoutId,
        CompletedWorkoutId = day.CompletedWorkoutId,
        Notes = day.Notes,
    };
}
