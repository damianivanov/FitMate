using FitMate.Core.JsonModels.AIActions;
using FitMate.DB;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.AI.Tools.Proposals;

/// <summary>
/// Shared argument schema and preview rendering for the proposals that carry a list of exercises.
/// </summary>
internal static class ProposalSchemas
{
    private const string ExercisesSchemaFragment = """
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
        """;

    internal static readonly string WorkoutSchema = $$"""
        {
          "type": "object",
          "properties": {
            "title": { "type": "string" },
            "notes": { "type": "string" },
            {{ExercisesSchemaFragment}}
          },
          "required": ["title", "exercises"]
        }
        """;

    internal static readonly string TemplateSchema = $$"""
        {
          "type": "object",
          "properties": {
            "name": { "type": "string" },
            "description": { "type": "string" },
            "estimatedDurationMinutes": { "type": "integer", "minimum": 1, "maximum": 600 },
            "isPublic": { "type": "boolean" },
            {{ExercisesSchemaFragment}}
          },
          "required": ["name", "exercises"]
        }
        """;

    /// <summary>
    /// Renders "Bench press — 3 x 8" lines using real exercise names, so the confirmation card
    /// never shows the user a raw id.
    /// </summary>
    internal static async Task<List<AIActionPreviewLineModel>> BuildExerciseLinesAsync(
        AppDbContext dbContext,
        IReadOnlyList<ProposedExercise> exercises,
        CancellationToken cancellationToken)
    {
        var ids = exercises.Select(x => x.ExerciseId).Distinct().ToList();

        var names = await dbContext.Exercises
            .AsNoTracking()
            .Where(x => ids.Contains(x.Id))
            .Select(x => new { x.Id, x.Name })
            .ToDictionaryAsync(x => x.Id, x => x.Name, cancellationToken);

        return exercises
            .Select(exercise =>
            {
                var setCount = exercise.Sets.Count;
                var reps = exercise.Sets
                    .Select(set => set.Reps)
                    .Where(rep => rep.HasValue)
                    .Select(rep => rep!.Value)
                    .ToList();

                var repLabel = reps.Count == 0
                    ? $"{setCount} sets"
                    : reps.Distinct().Count() == 1
                        ? $"{setCount} x {reps[0]}"
                        : $"{setCount} x {reps.Min()}-{reps.Max()}";

                return new AIActionPreviewLineModel
                {
                    Label = names.GetValueOrDefault(exercise.ExerciseId, $"Exercise {exercise.ExerciseId}"),
                    Value = repLabel,
                };
            })
            .ToList();
    }
}
