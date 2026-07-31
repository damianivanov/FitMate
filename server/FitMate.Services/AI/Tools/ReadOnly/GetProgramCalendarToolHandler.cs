using FitMate.Integrations.AI.Serialization;
using FitMate.Services.ProgramPlans.Plans;

namespace FitMate.Services.AI.Tools.ReadOnly;

public sealed class GetProgramCalendarArguments
{
    public int? Year { get; set; }
    public int? Month { get; set; }
}

public class GetProgramCalendarToolHandler : IAIToolHandler
{
    private readonly IProgramPlanService programPlanService;

    public GetProgramCalendarToolHandler(IProgramPlanService programPlanService)
    {
        this.programPlanService = programPlanService;
    }

    public string Name => "get_program_calendar";

    public AIToolDefinition Definition => new()
    {
        Name = Name,
        Description = "The planned days of the active program for one month.",
        ParametersJsonSchema = """
        {
          "type": "object",
          "properties": {
            "year": { "type": "integer", "description": "Defaults to the current UTC year." },
            "month": { "type": "integer", "minimum": 1, "maximum": 12, "description": "Defaults to the current UTC month." }
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
        var arguments = AIJsonSerializer.Deserialize<GetProgramCalendarArguments>(argumentsJson)
            ?? new GetProgramCalendarArguments();

        var active = await programPlanService.GetActiveAsync(context.UserId);
        if (active == null)
        {
            return AIToolExecutionResult.Ok(new { hasActiveProgram = false, days = Array.Empty<object>() });
        }

        var today = DateTime.UtcNow;
        var year = arguments.Year is >= 2000 and <= 2100 ? arguments.Year.Value : today.Year;
        var month = arguments.Month is >= 1 and <= 12 ? arguments.Month.Value : today.Month;

        var days = await programPlanService.GetCalendarAsync(active.Id, context.UserId, year, month);

        return AIToolExecutionResult.Ok(new
        {
            hasActiveProgram = true,
            programId = active.Id,
            year,
            month,
            days,
        });
    }
}
