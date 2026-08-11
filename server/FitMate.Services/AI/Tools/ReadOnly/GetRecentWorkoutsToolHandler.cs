using FitMate.Integrations.AI.Serialization;
using FitMate.Services.AI.Context;

namespace FitMate.Services.AI.Tools.ReadOnly;

public sealed class GetRecentWorkoutsArguments
{
    public int? Take { get; set; }
}

public class GetRecentWorkoutsToolHandler : IAIToolHandler
{
    private const int MaxResults = 20;

    private readonly IAITrainingContextQuery contextQuery;

    public GetRecentWorkoutsToolHandler(IAITrainingContextQuery contextQuery)
    {
        this.contextQuery = contextQuery;
    }

    public string Name => "get_recent_workouts";

    public AIToolDefinition Definition => new()
    {
        Name = Name,
        Description = "The most recent workouts the user logged, with their exercises and set counts.",
        ParametersJsonSchema = """
        {
          "type": "object",
          "properties": {
            "take": { "type": "integer", "minimum": 1, "maximum": 20, "description": "Defaults to 10." }
          }
        }
        """,
    };

    public bool IsAvailable(AIToolContext context) => true;

    public async Task<AIToolExecutionResult> ExecuteAsync(
        string argumentsJson,
        AIToolContext context,
        CancellationToken cancellationToken)
    {
        var arguments = AIJsonSerializer.Deserialize<GetRecentWorkoutsArguments>(argumentsJson)
            ?? new GetRecentWorkoutsArguments();

        var take = Math.Clamp(arguments.Take ?? 10, 1, MaxResults);

        // Ordering and limiting happen in SQL: the old path loaded the user's whole workout graph
        // and then took ten of them in memory.
        var recent = await contextQuery.GetRecentWorkoutsAsync(context.UserId, take, cancellationToken);

        return AIToolExecutionResult.Ok(new
        {
            count = recent.Count,
            workouts = recent.Select(workout => new
            {
                workout.Id,
                workout.Title,
                workout.StartedAt,
                workout.FinishedAt,
                workout.TotalVolumeKg,
                workout.DurationSeconds,
                exercises = workout.Exercises.Select(exercise => new
                {
                    exercise.ExerciseId,
                    exercise.ExerciseName,
                    setCount = exercise.SetCount,
                }).ToList(),
            }).ToList(),
        });
    }
}
