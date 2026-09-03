using FitMate.Core.JsonModels.Exercises;
using FitMate.Integrations.AI.Serialization;
using FitMate.Services.Exercises;

namespace FitMate.Services.AI.Tools.ReadOnly;

public sealed class SearchExercisesArguments
{
    public string? Search { get; set; }
    public List<string>? Searches { get; set; }
    public List<long>? MuscleGroupIds { get; set; }
}

public class SearchExercisesToolHandler : IAIToolHandler
{
    /// <summary>Result cap so a search can never flood the context window.</summary>
    private const int MaxResults = 30;

    /// <summary>Per-term cap when several terms are batched, so the total stays comparable.</summary>
    private const int MaxResultsPerBatchedTerm = 12;

    /// <summary>Ceiling on terms per call, so one request cannot fan out without bound.</summary>
    private const int MaxTerms = 8;

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
            + "and aliases. Always use the returned ids; never invent one. When you need several "
            + "exercises, pass every term at once in 'searches' — one call for the whole workout, "
            + "not one call per exercise.",
        ParametersJsonSchema = """
        {
          "type": "object",
          "properties": {
            "search": { "type": "string", "description": "A single name or alias fragment." },
            "searches": {
              "type": "array",
              "items": { "type": "string" },
              "description": "Several name or alias fragments looked up in one call. Prefer this over repeated calls; up to 8 terms."
            },
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

        var terms = BuildTerms(arguments);
        var take = terms.Count > 1 ? MaxResultsPerBatchedTerm : MaxResults;
        var groups = new List<object>(terms.Count);

        foreach (var term in terms)
        {
            // The AI loop runs in a background worker with no request principal, so the user id
            // travels explicitly. The ambient overload would throw "Unauthorized." here.
            var matches = await exerciseService.GetAllAsync(
                new ExerciseLookupRequest
                {
                    Search = term,
                    MuscleGroupIds = arguments.MuscleGroupIds,
                    Take = take,
                },
                context.UserId);

            groups.Add(new
            {
                search = term,
                count = matches.Count,
                exercises = matches
                    .Take(take)
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

        return AIToolExecutionResult.Ok(new { results = groups });
    }

    /// <summary>
    /// One call may carry several terms. A missing term list falls back to the single 'search'
    /// value, and no term at all means an unfiltered lookup (optionally by muscle group).
    /// </summary>
    private static List<string?> BuildTerms(SearchExercisesArguments arguments)
    {
        var terms = (arguments.Searches ?? [])
            .Concat([arguments.Search])
            .Where(term => !string.IsNullOrWhiteSpace(term))
            .Select(term => term!.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(MaxTerms)
            .ToList();

        return terms.Count == 0 ? [null] : [.. terms.Cast<string?>()];
    }
}
