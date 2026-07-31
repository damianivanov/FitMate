using FitMate.Services.WorkoutTemplates;

namespace FitMate.Services.AI.Tools.ReadOnly;

public class GetWorkoutTemplatesToolHandler : IAIToolHandler
{
    private const int MaxResults = 50;

    private readonly IWorkoutTemplateService workoutTemplateService;

    public GetWorkoutTemplatesToolHandler(IWorkoutTemplateService workoutTemplateService)
    {
        this.workoutTemplateService = workoutTemplateService;
    }

    public string Name => "get_workout_templates";

    public AIToolDefinition Definition => new()
    {
        Name = Name,
        Description =
            "Workout templates the user can use. Prefer reusing one of these over proposing a new template.",
    };

    public bool IsAvailable(AIToolContext context) => true;

    public async Task<AIToolExecutionResult> ExecuteAsync(
        string argumentsJson,
        AIToolContext context,
        CancellationToken cancellationToken)
    {
        var templates = await workoutTemplateService.ListAsync(context.UserId);

        var compact = templates
            .Take(MaxResults)
            .Select(x => new
            {
                x.Id,
                x.Name,
                x.Description,
                x.EstimatedDurationMinutes,
                x.ExerciseCount,
                x.SetCount,
                isOwn = x.UserId == context.UserId,
            })
            .ToList();

        return AIToolExecutionResult.Ok(new { count = compact.Count, templates = compact });
    }
}
