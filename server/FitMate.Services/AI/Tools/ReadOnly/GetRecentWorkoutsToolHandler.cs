using FitMate.Integrations.AI.Serialization;
using FitMate.Services.Workouts;

namespace FitMate.Services.AI.Tools.ReadOnly;

public sealed class GetRecentWorkoutsArguments
{
    public int? Take { get; set; }
}

public class GetRecentWorkoutsToolHandler : IAIToolHandler
{
    private const int MaxResults = 20;

    private readonly IWorkoutService workoutService;

    public GetRecentWorkoutsToolHandler(IWorkoutService workoutService)
    {
        this.workoutService = workoutService;
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
        var workouts = await workoutService.ListAsync(context.UserId);

        // Compact projection: shape and volume are useful, every set row is not.
        var recent = workouts
            .OrderByDescending(x => x.StartedAt ?? x.FinishedAt ?? DateTime.MinValue)
            .Take(take)
            .Select(x => new
            {
                x.Id,
                x.Title,
                x.StartedAt,
                x.FinishedAt,
                x.TotalVolumeKg,
                x.DurationSeconds,
                exercises = x.Groups
                    .SelectMany(group => group.Exercises)
                    .Select(exercise => new
                    {
                        exercise.ExerciseId,
                        exercise.ExerciseName,
                        setCount = exercise.Sets.Count,
                    })
                    .ToList(),
            })
            .ToList();

        return AIToolExecutionResult.Ok(new { count = recent.Count, workouts = recent });
    }
}
