using System.Globalization;
using FitMate.Core.JsonModels.AIActions;
using FitMate.DB;
using FitMate.DB.Enums;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.AI.Tools.Proposals;

/// <summary>
/// Argument schema and preview rendering for program proposals. The preview is a weekday-by-weekday
/// table so the user reads names and days, never template ids or raw JSON.
/// </summary>
internal static class ProgramPlanSchemas
{
    internal static readonly string ProgramPlanSchema = """
        {
          "type": "object",
          "properties": {
            "name": { "type": "string" },
            "description": { "type": "string" },
            "goal": {
              "type": "string",
              "enum": ["GeneralFitness","Hypertrophy","Strength","FatLoss","Endurance","Maintenance"]
            },
            "scheduleType": {
              "type": "string",
              "enum": ["FixedWeekdays","Rotation"],
              "description": "FixedWeekdays repeats every calendar week; Rotation cycles day 1..N regardless of weekday."
            },
            "startDate": { "type": "string", "format": "date" },
            "endDate": {
              "type": "string",
              "format": "date",
              "description": "Omit for a program that keeps running until the user stops it."
            },
            "workoutsPerWeek": { "type": "integer", "minimum": 1, "maximum": 7 },
            "schedule": {
              "type": "array",
              "description": "One entry per day of the week (FixedWeekdays) or per rotation day (Rotation).",
              "items": {
                "type": "object",
                "properties": {
                  "dayOfWeek": {
                    "type": "string",
                    "enum": ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
                    "description": "FixedWeekdays only."
                  },
                  "rotationDayIndex": {
                    "type": "integer",
                    "minimum": 1,
                    "description": "Rotation only; must run 1..N with no gaps."
                  },
                  "dayType": {
                    "type": "string",
                    "enum": ["Workout","Rest","OptionalWorkout","Recovery","Deload"]
                  },
                  "existingWorkoutTemplateId": {
                    "type": "integer",
                    "description": "An id from get_workout_templates. Mutually exclusive with newWorkoutTemplateClientKey."
                  },
                  "newWorkoutTemplateClientKey": {
                    "type": "string",
                    "description": "The clientKey of one of the newTemplates below."
                  },
                  "isOptional": { "type": "boolean" }
                },
                "required": ["dayType"]
              }
            },
            "newTemplates": {
              "type": "array",
              "description": "Templates to create alongside the program. Only add one when no existing template fits.",
              "items": {
                "type": "object",
                "properties": {
                  "clientKey": {
                    "type": "string",
                    "description": "A short handle, e.g. 'push-a', referenced by schedule entries."
                  },
                  "name": { "type": "string" },
                  "description": { "type": "string" },
                  "estimatedDurationMinutes": { "type": "integer", "minimum": 1, "maximum": 600 },
                  "exercises": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "properties": {
                        "exerciseId": { "type": "integer", "description": "Must come from search_exercises." },
                        "sets": {
                          "type": "array",
                          "items": {
                            "type": "object",
                            "properties": {
                              "setType": { "type": "string", "enum": ["Warmup","Working","Failure","Drop"] },
                              "reps": { "type": "integer", "minimum": 1, "maximum": 100 },
                              "weightKg": { "type": "number", "minimum": 0, "maximum": 1000 },
                              "rpe": { "type": "number", "minimum": 1, "maximum": 10 },
                              "restSeconds": { "type": "integer", "minimum": 0, "maximum": 600 }
                            }
                          }
                        }
                      },
                      "required": ["exerciseId", "sets"]
                    }
                  }
                },
                "required": ["clientKey", "name", "exercises"]
              }
            }
          },
          "required": ["name", "goal", "scheduleType", "startDate", "workoutsPerWeek", "schedule"]
        }
        """;

    internal static readonly string ProgramUpdateSchema = """
        {
          "type": "object",
          "properties": {
            "programPlanId": { "type": "integer", "description": "The active program's id, from get_active_program." },
            "reason": { "type": "string", "description": "One short sentence the user will read on the confirmation card." },
            "workoutsPerWeek": { "type": "integer", "minimum": 1, "maximum": 7 },
            "schedule": {
              "type": "array",
              "description": "The complete new week; it replaces the current one from tomorrow onwards.",
              "items": {
                "type": "object",
                "properties": {
                  "dayOfWeek": {
                    "type": "string",
                    "enum": ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
                  },
                  "rotationDayIndex": { "type": "integer", "minimum": 1 },
                  "dayType": {
                    "type": "string",
                    "enum": ["Workout","Rest","OptionalWorkout","Recovery","Deload"]
                  },
                  "existingWorkoutTemplateId": { "type": "integer" },
                  "newWorkoutTemplateClientKey": { "type": "string" },
                  "isOptional": { "type": "boolean" }
                },
                "required": ["dayType"]
              }
            },
            "newTemplates": {
              "type": "array",
              "description": "Same shape as propose_program_plan's newTemplates.",
              "items": { "type": "object" }
            }
          },
          "required": ["programPlanId", "reason", "workoutsPerWeek", "schedule"]
        }
        """;

    /// <summary>The referenced templates the user may actually use, keyed by id.</summary>
    internal static async Task<Dictionary<long, string>> GetVisibleTemplateNamesAsync(
        AppDbContext dbContext,
        ProposeProgramPlanPayload payload,
        long userId,
        CancellationToken cancellationToken)
    {
        var ids = payload.Schedule
            .Where(x => x.ExistingWorkoutTemplateId is > 0)
            .Select(x => x.ExistingWorkoutTemplateId!.Value)
            .Distinct()
            .ToList();

        return await dbContext.WorkoutTemplates
            .AsNoTracking()
            .Where(x => ids.Contains(x.Id) && (x.UserId == userId || x.IsPublic))
            .Select(x => new { x.Id, x.Name })
            .ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);
    }

    internal static List<AIActionPreviewLineModel> BuildPreviewLines(
        ProposeProgramPlanPayload payload,
        IReadOnlyDictionary<long, string> existingTemplateNames)
    {
        var newTemplateNames = payload.NewTemplates
            .ToDictionary(x => x.ClientKey, x => x.Name, StringComparer.OrdinalIgnoreCase);

        var lines = payload.Schedule
            .Select(item => new AIActionPreviewLineModel
            {
                Label = DescribeDay(item, payload.ScheduleType),
                Value = DescribeTraining(item, existingTemplateNames, newTemplateNames),
            })
            .ToList();

        lines.Add(new AIActionPreviewLineModel
        {
            Label = "Workouts per week",
            Value = payload.WorkoutsPerWeek.ToString(CultureInfo.InvariantCulture),
        });

        lines.Add(new AIActionPreviewLineModel
        {
            Label = "Runs",
            Value = payload.EndDate is { } end
                ? $"{payload.StartDate:d MMM yyyy} – {end:d MMM yyyy}"
                : $"from {payload.StartDate:d MMM yyyy}, open-ended",
        });

        if (payload.NewTemplates.Count > 0)
        {
            lines.Add(new AIActionPreviewLineModel
            {
                Label = "New templates",
                Value = string.Join(", ", payload.NewTemplates.Select(x => x.Name)),
            });
        }

        return lines;
    }

    private static string DescribeDay(ProposedProgramScheduleItem item, ProgramScheduleType scheduleType) =>
        scheduleType == ProgramScheduleType.Rotation
            ? $"Day {item.RotationDayIndex}"
            : item.DayOfWeek?.ToString() ?? "Day";

    private static string DescribeTraining(
        ProposedProgramScheduleItem item,
        IReadOnlyDictionary<long, string> existingTemplateNames,
        IReadOnlyDictionary<string, string> newTemplateNames)
    {
        if (item.DayType == ProgramPlanDayType.Rest)
        {
            return "Rest";
        }

        var name = item.ExistingWorkoutTemplateId is { } id
            ? existingTemplateNames.GetValueOrDefault(id, $"Template {id}")
            : newTemplateNames.GetValueOrDefault(item.NewWorkoutTemplateClientKey ?? string.Empty, "New template");

        return item.IsOptional || item.DayType == ProgramPlanDayType.OptionalWorkout
            ? $"{name} (optional)"
            : name;
    }
}
