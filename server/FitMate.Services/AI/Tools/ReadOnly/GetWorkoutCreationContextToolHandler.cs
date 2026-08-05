using FitMate.Core.JsonModels.Exercises;
using FitMate.Integrations.AI.Serialization;
using FitMate.Services.Exercises;
using FitMate.Services.MuscleGroups;
using FitMate.Services.ProgramPlans.Plans;
using FitMate.Services.TrainingProfiles;
using FitMate.Services.WorkoutTemplates;
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

    /// <summary>Recent workouts scanned to work out when the focus muscles were last hit.</summary>
    private const int RecentWorkoutsScanned = 12;

    private readonly ITrainingProfileService trainingProfileService;
    private readonly IMuscleGroupService muscleGroupService;
    private readonly IExerciseService exerciseService;
    private readonly IWorkoutService workoutService;
    private readonly IWorkoutTemplateService workoutTemplateService;
    private readonly IProgramPlanService programPlanService;

    public GetWorkoutCreationContextToolHandler(
        ITrainingProfileService trainingProfileService,
        IMuscleGroupService muscleGroupService,
        IExerciseService exerciseService,
        IWorkoutService workoutService,
        IWorkoutTemplateService workoutTemplateService,
        IProgramPlanService programPlanService)
    {
        this.trainingProfileService = trainingProfileService;
        this.muscleGroupService = muscleGroupService;
        this.exerciseService = exerciseService;
        this.workoutService = workoutService;
        this.workoutTemplateService = workoutTemplateService;
        this.programPlanService = programPlanService;
    }

    public string Name => "get_workout_creation_context";

    public AIToolDefinition Definition => new()
    {
        Name = Name,
        Description =
            "Everything needed to draft a workout in one call: the user's training profile, whether "
            + "today already has a scheduled session, when the focus muscles were last trained, "
            + "matching templates, and ranked exercise candidates with their latest performance. "
            + "Call this once when the user asks for a workout, then call propose_workout. Do not "
            + "call get_training_profile, get_active_program, get_workout_templates, search_exercises "
            + "or get_exercise_history as well — this already covers them.",
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

        // Pull more than we return so previously-performed exercises can be ranked to the top.
        var candidates = await exerciseService.GetAllAsync(new ExerciseLookupRequest
        {
            MuscleGroupIds = focusIds.Count > 0 ? focusIds : null,
            Take = Math.Max(limit * 3, limit),
        });

        var previousSets = candidates.Count == 0
            ? []
            : (await workoutService.GetPreviousSetsAsync(
                context.UserId,
                candidates.Select(x => x.Id).ToList())).Items;

        var lastPerformed = previousSets.ToDictionary(x => x.ExerciseId, x => x);

        var ranked = candidates
            .OrderByDescending(x => lastPerformed.ContainsKey(x.Id))
            .ThenByDescending(x => lastPerformed.TryGetValue(x.Id, out var previous)
                ? previous.WorkoutStartedAt
                : DateTime.MinValue)
            .ThenBy(x => x.Name, StringComparer.OrdinalIgnoreCase)
            .Take(limit)
            .ToList();

        var workouts = await workoutService.ListAsync(context.UserId);
        var recentExposure = BuildRecentExposure(workouts, candidates, muscleGroups, focusIds);

        var templates = await workoutTemplateService.ListAsync(context.UserId);
        var candidateIds = candidates.Select(x => x.Id).ToHashSet();

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
            },
            recentMuscleExposure = recentExposure,
            matchingTemplates = templates
                .Where(template => template.Groups
                    .SelectMany(group => group.Exercises)
                    .Any(exercise => candidateIds.Contains(exercise.ExerciseId)))
                .Select(template => new { template.Id, template.Name, template.ExerciseCount })
                .ToList(),
            exercises = ranked.Select(exercise => new
            {
                exercise.Id,
                exercise.Name,
                primaryMuscle = exercise.PrimaryMuscleGroupName,
                secondaryMuscle = exercise.SecondaryMuscleGroupName,
                equipment = exercise.Equipment?.ToString(),
                movementPattern = exercise.MovementPattern?.ToString(),
                lastPerformance = includeHistory && lastPerformed.TryGetValue(exercise.Id, out var previous)
                    ? BuildLastPerformance(previous)
                    : null,
            }).ToList(),
        });
    }

    private static object BuildLastPerformance(Core.JsonModels.Workouts.PreviousExerciseSetsModel previous) => new
    {
        performedAt = previous.WorkoutStartedAt.ToString("yyyy-MM-dd"),
        weightKg = previous.Sets.Select(set => set.WeightKg).FirstOrDefault(weight => weight != null),
        reps = previous.Sets.Where(set => set.Reps != null).Select(set => set.Reps!.Value).ToList(),
    };

    /// <summary>
    /// When each focus muscle was last trained, derived from the candidate exercises that appear in
    /// recent workouts. Enough to stop the model programming a muscle it hit yesterday.
    /// </summary>
    private static List<object> BuildRecentExposure(
        IReadOnlyList<Core.JsonModels.Workouts.WorkoutModel> workouts,
        IReadOnlyList<ExerciseLookupModel> candidates,
        IReadOnlyList<Core.JsonModels.MuscleGroups.MuscleGroupModel> muscleGroups,
        IReadOnlyCollection<long> focusIds)
    {
        var exerciseMuscles = candidates.ToDictionary(x => x.Id, x => x.PrimaryMuscleGroupId);
        var lastTrained = new Dictionary<long, DateTime>();

        foreach (var workout in workouts
            .Where(x => x.StartedAt != null)
            .OrderByDescending(x => x.StartedAt)
            .Take(RecentWorkoutsScanned))
        {
            foreach (var exercise in workout.Groups.SelectMany(group => group.Exercises))
            {
                if (!exerciseMuscles.TryGetValue(exercise.ExerciseId, out var muscleGroupId))
                {
                    continue;
                }

                var startedAt = workout.StartedAt!.Value;
                if (!lastTrained.TryGetValue(muscleGroupId, out var existing) || startedAt > existing)
                {
                    lastTrained[muscleGroupId] = startedAt;
                }
            }
        }

        return lastTrained
            .Where(entry => focusIds.Count == 0 || focusIds.Contains(entry.Key))
            .OrderByDescending(entry => entry.Value)
            .Select(entry => (object)new
            {
                muscleGroup = muscleGroups.FirstOrDefault(group => group.Id == entry.Key)?.Name ?? "Unknown",
                lastTrainedAt = entry.Value.ToString("yyyy-MM-dd"),
                daysAgo = (int)Math.Floor((DateTime.UtcNow - entry.Value).TotalDays),
            })
            .ToList();
    }

    private static DateTime ParseDate(string? value) =>
        DateTime.TryParse(value, out var parsed) ? parsed.Date : DateTime.UtcNow.Date;
}
