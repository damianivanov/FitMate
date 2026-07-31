using FitMate.Core.JsonModels.AdminAI;
using FitMate.Integrations.AI.Serialization;
using FitMate.Services.AI.Tools;

namespace FitMate.Services.AI.Unsupported;

/// <summary>
/// Records demand for something FitMate cannot do. It writes only to the product backlog, so it is
/// safe to run without confirmation and costs the user no quota.
/// </summary>
public class ReportUnsupportedRequestToolHandler : IAIToolHandler
{
    private readonly IUnsupportedRequestService unsupportedRequestService;

    public ReportUnsupportedRequestToolHandler(IUnsupportedRequestService unsupportedRequestService)
    {
        this.unsupportedRequestService = unsupportedRequestService;
    }

    public string Name => "report_unsupported_request";

    public AIToolDefinition Definition => new()
    {
        Name = Name,
        Description =
            "Record that the user asked for something FitMate cannot do, before you explain the "
            + "limitation. Never call this when an existing tool can satisfy the request.",
        ParametersJsonSchema = """
            {
              "type": "object",
              "properties": {
                "category": {
                  "type": "string",
                  "description": "A short area label, e.g. 'integration', 'nutrition', 'cardio', 'social'."
                },
                "requestedFunctionality": {
                  "type": "string",
                  "description": "One sentence naming the missing capability, phrased the same way every time."
                },
                "userIntentSummary": { "type": "string", "description": "What the user was ultimately trying to achieve." },
                "suggestedFallback": { "type": "string", "description": "What they can do in FitMate today instead." }
              },
              "required": ["category", "requestedFunctionality"]
            }
            """,
    };

    public bool IsAvailable(AIToolContext context) => true;

    public async Task<AIToolExecutionResult> ExecuteAsync(
        string argumentsJson,
        AIToolContext context,
        CancellationToken cancellationToken)
    {
        var request = AIJsonSerializer.Deserialize<RecordUnsupportedRequestRequest>(argumentsJson);
        if (request == null || string.IsNullOrWhiteSpace(request.RequestedFunctionality))
        {
            return AIToolExecutionResult.Fail(
                "invalid_arguments",
                "requestedFunctionality is required.");
        }

        // The conversation comes from the caller's context, never from the model's arguments.
        request.ConversationId = context.ConversationId;
        request.MessageId = null;

        await unsupportedRequestService.RecordAsync(request, context.UserId);

        return AIToolExecutionResult.Ok(new
        {
            status = "recorded",
            note = "The request was logged for the product team. Now explain the limitation to the user.",
        });
    }
}
