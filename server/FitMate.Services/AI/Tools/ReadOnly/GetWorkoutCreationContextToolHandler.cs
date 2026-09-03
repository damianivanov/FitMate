using FitMate.Integrations.AI.Serialization;
using FitMate.Services.AI.Context;
using FitMate.Services.MuscleGroups;
using FitMate.Services.ProgramPlans.Plans;
using FitMate.Services.TrainingProfiles;
using FitMate.Services.Workouts;

namespace FitMate.Services.AI.Tools.ReadOnly;

public sealed class GetWorkoutCreationContextArguments
{
    public List<string>? Focus { get; set; }
    public List<long>? MuscleGroupIds { get; set; }
    public string? Date { get; set; }
    public int? ExerciseLimit { get; set; }
    public bool? IncludeExerciseHistory { get; set; }
}

/// <summary>
/// Everything needed to draft a workout, in one audited read. Replaces the profile / program /
/// templates / repeated-search / history sequence that used to cost five or six model round trips
/// for a single "make me an arms workout".
/// </summary>
public class GetWorkoutCreationContextToolHandler : IAIToolHandler
{
    private const int DefaultExerciseLimit = 12;
    private const int MaxExerciseLimit = 24;
    private const int MatchingTemplateLimit = 10;

    /// <summary>Recent workouts scanned to work out when the focus muscles were last hit.</summary>
    private const int RecentWorkoutsScanned = 12;

    private readonly ITrainingProfileService trainingProfileService;
    private readonly IMuscleGroupService muscleGroupService;
    private readonly IProgramPlanService programPlanService;
    private readonly IAITrainingContextQuery contextQuery;
    private readonly IWorkoutService workoutService;

    public GetWorkoutCreationContextToolHandler(
        ITrainingProfileService trainingProfileService,
        IMuscleGroupService muscleGroupService,
        IProgramPlanService programPlanService,
        IAITrainingContextQuery contextQuery,
        IWorkoutService workoutService)
    {
        this.trainingProfileService = trainingProfileService;
        this.muscleGroupService = muscleGroupService;
        this.programPlanService = programPlanService;
        this.contextQuery = contextQuery;
        this.workoutService = workoutService;
    }

    public string Name => "get_workout_creation_context";

    public AIToolDefinition Definition => new()
    {
        Name = Name,
        Description =
            "Everything needed to draft a workout in one call: the user's training profile, whether "
            + "today already has a scheduled session, any workout they are part-way through, when the "
            + "focus muscles were last trained, matching templates, and ranked exercise candidates "
            + "with their latest performance. Call this once when the user asks for a workout, then "
            + "call propose_workout. Do not call get_training_profile, get_active_program, "
            + "get_workout_templates, search_exercises or get_exercise_history as well — this already "
            + "covers them. When today.activeWorkout is present the user is mid-session: say so, and "
            + "tell them they can add the suggestion to that session instead of starting a new one.",
        ParametersJsonSchema = """
        {
          "type": "object",
          "properties": {
            "focus": {
              "type": "array",
              "items": { "type": "string" },
              "description": "Body areas or muscles, e.g. [\"arms\"] or [\"biceps\",\"triceps\"]. Groups like arms, legs, push and pull are expanded for you."
            },
            "muscleGroupIds": { "type": "array", "items": { "type": "integer" } },
            "date": { "type": "string", "description": "Target day as YYYY-MM-DD. Defaults to today." },
            "exerciseLimit": { "type": "integer", "minimum": 1, "maximum": 24, "description": "Candidates to return, defaults to 12." },
            "includeExerciseHistory": { "type": "boolean", "description": "Attach latest performance per candidate. Defaults to true." }
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
        var arguments = AIJsonSerializer.Deserialize<GetWorkoutCreationContextArguments>(argumentsJson)
            ?? new GetWorkoutCreationContextArguments();

        var limit = Math.Clamp(arguments.ExerciseLimit ?? DefaultExerciseLimit, 1, MaxExerciseLimit);
        var includeHistory = arguments.IncludeExerciseHistory ?? true;
        var date = ParseDate(arguments.Date);

        var muscleGroups = await muscleGroupService.GetAllForLookupAsync();
        var focusIds = MuscleGroupResolver.Resolve(muscleGroups, arguments.Focus, arguments.MuscleGroupIds);

        var profile = await trainingProfileService.GetAsync(context.UserId);
        var today = await programPlanService.GetTodayAsync(context.UserId, DateOnly.FromDateTime(date));
        var activeWorkout = await workoutService.GetActiveAsync(context.UserId, cancellationToken);

        // Pull more than we return so previously-performed exercises can be ranked to the top.
        var candidates = await contextQuery.GetExerciseCandidatesAsync(
            context.UserId, focusIds, Math.Max(limit * 3, limit), cancellationToken);

        var candidateIds = candidates.Select(x => x.Id).ToList();

        // Skipped entirely when history is not wanted. The old path ran this query regardless and
        // merely suppressed the field, which meant paying for it either way. The trade-off is that
        // ranking then loses its "performed before" signal and falls back to alphabetical.
        var lastPerformed = includeHistory
            ? await contextQuery.GetLatestPerformanceAsync(context.UserId, candidateIds, cancellationToken)
            : new Dictionary<long, AILatestExercisePerformanceModel>();

        var ranked = candidates
            .OrderByDescending(x => lastPerformed.ContainsKey(x.Id))
            .ThenByDescending(x => lastPerformed.TryGetValue(x.Id, out var previous)
                ? previous.PerformedAt
                : DateTime.MinValue)
            .ThenBy(x => x.Name, StringComparer.OrdinalIgnoreCase)
            .Take(limit)
            .ToList();

        var exposure = await contextQuery.GetRecentMuscleExposureAsync(
            context.UserId, focusIds, RecentWorkoutsScanned, cancellationToken);

        var templates = await contextQuery.GetMatchingTemplatesAsync(
            context.UserId, candidateIds, MatchingTemplateLimit, cancellationToken);

        return AIToolExecutionResult.Ok(new
        {
            date = date.ToString("yyyy-MM-dd"),
            focusMuscleGroups = muscleGroups
                .Where(group => focusIds.Contains(group.Id))
                .Select(group => new { group.Id, group.Name })
                .ToList(),
            hasProfile = profile != null,
            profile,
            today = new
            {
                hasScheduledWorkout = today != null,
                scheduled = today,
                activeWorkout = activeWorkout == null
                    ? null
                    : new
                    {
                        activeWorkout.Id,
                        activeWorkout.Title,
                        activeWorkout.ExerciseCount,
                        startedAt = activeWorkout.StartedAt?.ToString("yyyy-MM-ddTHH:mm:ssZ"),
                    },
            },
            recentMuscleExposure = exposure
                .Select(entry => new
                {
                    muscleGroup = muscleGroups.FirstOrDefault(group => group.Id == entry.MuscleGroupId)?.Name
                        ?? "Unknown",
                    lastTrainedAt = entry.LastTrainedAt.ToString("yyyy-MM-dd"),
                    daysAgo = (int)Math.Floor((DateTime.UtcNow - entry.LastTrainedAt).TotalDays),
                })
                .ToList(),
            matchingTemplates = templates
                .Select(template => new { template.Id, template.Name, template.ExerciseCount })
                .ToList(),
            exercises = ranked.Select(exercise => new
            {
                exercise.Id,
                exercise.Name,
                primaryMuscle = exercise.PrimaryMuscleGroupName,
                secondaryMuscle = exercise.SecondaryMuscleGroupName,
                equipment = exercise.Equipment,
                movementPattern = exercise.MovementPattern,
                lastPerformance = lastPerformed.TryGetValue(exercise.Id, out var previous)
                    ? BuildLastPerformance(previous)
                    : null,
            }).ToList(),
        });
    }

    private static object BuildLastPerformance(AILatestExercisePerformanceModel previous) => new
    {
        performedAt = previous.PerformedAt.ToString("yyyy-MM-dd"),
        weightKg = previous.WeightKg,
        reps = previous.Reps,
    };

    private static DateTime ParseDate(string? value) =>
        DateTime.TryParse(value, out var parsed) ? parsed.Date : DateTime.UtcNow.Date;
}
