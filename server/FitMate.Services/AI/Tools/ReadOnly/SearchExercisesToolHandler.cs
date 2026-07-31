using FitMate.Core.JsonModels.Exercises;
using FitMate.Integrations.AI.Serialization;
using FitMate.Services.Exercises;

namespace FitMate.Services.AI.Tools.ReadOnly;

public sealed class SearchExercisesArguments
{
    public string? Search { get; set; }
    public List<long>? MuscleGroupIds { get; set; }
}

public class SearchExercisesToolHandler : IAIToolHandler
{
    /// <summary>Result cap so a search can never flood the context window.</summary>
    private const int MaxResults = 30;

    private readonly IExerciseService exerciseService;

    public SearchExercisesToolHandler(IExerciseService exerciseService)
    {
        this.exerciseService = exerciseService;
    }

    public string Name => "search_exercises";

    public AIToolDefinition Definition => new()
    {
        Name = Name,
        Description =
            "Search exercises the user can use (their own plus the shared catalogue). Matches names "
            + "and aliases. Always use the returned ids; never invent one.",
        ParametersJsonSchema = """
        {
          "type": "object",
          "properties": {
            "search": { "type": "string", "description": "Name or alias fragment." },
            "muscleGroupIds": { "type": "array", "items": { "type": "integer" } }
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
        var arguments = AIJsonSerializer.Deserialize<SearchExercisesArguments>(argumentsJson)
            ?? new SearchExercisesArguments();

        var results = await exerciseService.GetAllAsync(new ExerciseLookupRequest
        {
            Search = arguments.Search,
            MuscleGroupIds = arguments.MuscleGroupIds,
            Take = MaxResults,
        });

        return AIToolExecutionResult.Ok(new
        {
            count = results.Count,
            exercises = results
                .Take(MaxResults)
                .Select(x => new
                {
                    x.Id,
                    x.Name,
                    x.PrimaryMuscleGroupId,
                    x.SecondaryMuscleGroupId,
                })
                .ToList(),
        });
    }
}
