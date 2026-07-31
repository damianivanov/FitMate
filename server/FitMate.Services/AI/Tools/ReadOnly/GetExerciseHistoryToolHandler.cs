using FitMate.Integrations.AI.Serialization;
using FitMate.Services.Workouts;

namespace FitMate.Services.AI.Tools.ReadOnly;

public sealed class GetExerciseHistoryArguments
{
    public List<long> ExerciseIds { get; set; } = [];
    public int? Take { get; set; }
}

public class GetExerciseHistoryToolHandler : IAIToolHandler
{
    private const int MaxSessions = 10;

    private readonly IWorkoutService workoutService;

    public GetExerciseHistoryToolHandler(IWorkoutService workoutService)
    {
        this.workoutService = workoutService;
    }

    public string Name => "get_exercise_history";

    public AIToolDefinition Definition => new()
    {
        Name = Name,
        Description =
            "Recent logged sessions for specific exercises, so weights and reps can build on what the "
            + "user actually did. How far back this reaches depends on the user's plan.",
        ParametersJsonSchema = """
        {
          "type": "object",
          "properties": {
            "exerciseIds": { "type": "array", "items": { "type": "integer" } },
            "take": { "type": "integer", "minimum": 1, "maximum": 10, "description": "Sessions per exercise, defaults to 3." }
          },
          "required": ["exerciseIds"]
        }
        """,
    };

    public bool IsAvailable(AIToolContext context) => true;

    public async Task<AIToolExecutionResult> ExecuteAsync(
        string argumentsJson,
        AIToolContext context,
        CancellationToken cancellationToken)
    {
        var arguments = AIJsonSerializer.Deserialize<GetExerciseHistoryArguments>(argumentsJson)
            ?? new GetExerciseHistoryArguments();

        if (arguments.ExerciseIds.Count == 0)
        {
            return AIToolExecutionResult.Fail("invalid_arguments", "exerciseIds is required.");
        }

        var take = Math.Clamp(arguments.Take ?? 3, 1, MaxSessions);
        var history = await workoutService.GetExerciseHistoryAsync(context.UserId, arguments.ExerciseIds, take);

        return AIToolExecutionResult.Ok(history);
    }
}
