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
              "exerciseId": { "type": "integer", "description": "An existing exercise, from get_workout_creation_context or search_exercises. Omit when using newExerciseClientKey." },
              "newExerciseClientKey": { "type": "string", "description": "The clientKey of one of the newExercises below, when the exercise does not exist yet. Use this or exerciseId, never both." },
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
            "required": ["sets"]
          }
        }
        """;

    /// <summary>
    /// Exercises created by the same confirmation as the workout or template that uses them, so a
    /// missing exercise never costs the user a second round of confirming.
    /// </summary>
    private const string NewExercisesSchemaFragment = """
        "newExercises": {
          "type": "array",
          "description": "Only for exercises that genuinely do not exist yet. Check the candidates you were given first.",
          "items": {
            "type": "object",
            "properties": {
              "clientKey": { "type": "string", "description": "A short handle, e.g. 'skull-crusher', referenced by exercises above." },
              "name": { "type": "string" },
              "description": { "type": "string" },
              "primaryMuscleGroupId": { "type": "integer" },
              "secondaryMuscleGroupId": { "type": "integer" },
              "equipment": { "type": "string", "enum": ["Barbell","Dumbbell","Kettlebell","Cable","Machine","Bodyweight","ResistanceBand","MedicineBall","Other"] },
              "movementPattern": { "type": "string", "enum": ["HorizontalPush","HorizontalPull","VerticalPush","VerticalPull","Squat","Hinge","Lunge","Carry","Rotation","Isolation","Other"] },
              "difficulty": { "type": "string", "enum": ["Beginner","Intermediate","Advanced"] },
              "category": { "type": "string", "enum": ["Strength","Cardio","Mobility","Plyometric","Olympic","Other"] },
              "aliases": { "type": "array", "items": { "type": "string" } }
            },
            "required": ["clientKey", "name", "primaryMuscleGroupId"]
          }
        }
        """;

    internal static readonly string WorkoutSchema = $$"""
        {
          "type": "object",
          "properties": {
            "title": { "type": "string" },
            "notes": { "type": "string" },
            {{ExercisesSchemaFragment}},
            {{NewExercisesSchemaFragment}}
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
            {{ExercisesSchemaFragment}},
            {{NewExercisesSchemaFragment}}
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
        CancellationToken cancellationToken,
        IReadOnlyList<ProposedNewExercise>? newExercises = null)
    {
        var ids = exercises.Select(x => x.ExerciseId).Distinct().ToList();

        // Exercises that do not exist yet have no row to read a name from, so their name comes from
        // the proposal itself and is marked, letting the user see what confirming will create.
        var newNamesByKey = (newExercises ?? [])
            .GroupBy(x => x.ClientKey, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First().Name, StringComparer.OrdinalIgnoreCase);

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

                var key = exercise.NewExerciseClientKey;
                var label = !string.IsNullOrWhiteSpace(key)
                    ? $"{newNamesByKey.GetValueOrDefault(key, key)} (new)"
                    : names.GetValueOrDefault(exercise.ExerciseId, $"Exercise {exercise.ExerciseId}");

                return new AIActionPreviewLineModel
                {
                    Label = label,
                    Value = repLabel,
                };
            })
            .ToList();
    }
}
