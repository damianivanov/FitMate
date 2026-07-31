using FitMate.Services.ProgramPlans.Plans;

namespace FitMate.Services.AI.Tools.ReadOnly;

public class GetActiveProgramToolHandler : IAIToolHandler
{
    private readonly IProgramPlanService programPlanService;

    public GetActiveProgramToolHandler(IProgramPlanService programPlanService)
    {
        this.programPlanService = programPlanService;
    }

    public string Name => "get_active_program";

    public AIToolDefinition Definition => new()
    {
        Name = Name,
        Description =
            "The user's active program plan with its schedule rules, plus what is planned for today, "
            + "the next planned workout and any missed workout.",
    };

    public bool IsAvailable(AIToolContext context) => true;

    public async Task<AIToolExecutionResult> ExecuteAsync(
        string argumentsJson,
        AIToolContext context,
        CancellationToken cancellationToken)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var active = await programPlanService.GetActiveAsync(context.UserId);
        var todayModel = await programPlanService.GetTodayAsync(context.UserId, today);

        return AIToolExecutionResult.Ok(new
        {
            hasActiveProgram = active != null,
            program = active,
            today = todayModel,
        });
    }
}
