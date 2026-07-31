using FitMate.Core.JsonModels.AIActions;
using FitMate.DB;
using FitMate.DB.Enums;
using FitMate.Integrations.AI.Serialization;
using FitMate.Services.AIActions;
using FitMate.Services.AIActions.Executors;
using FitMate.Services.Subscriptions;

namespace FitMate.Services.AI.Tools.Proposals;

/// <summary>
/// Proposes a reusable workout template. Charged against AIWorkoutGeneration at proposal time, the
/// same as propose_workout.
/// </summary>
public class ProposeWorkoutTemplateToolHandler : IAIToolHandler
{
    private readonly AppDbContext dbContext;
    private readonly IAIActionService actionService;
    private readonly IEntitlementService entitlementService;
    private readonly IUsageService usageService;

    public ProposeWorkoutTemplateToolHandler(
        AppDbContext dbContext,
        IAIActionService actionService,
        IEntitlementService entitlementService,
        IUsageService usageService)
    {
        this.dbContext = dbContext;
        this.actionService = actionService;
        this.entitlementService = entitlementService;
        this.usageService = usageService;
    }

    public string Name => "propose_workout_template";

    public AIToolDefinition Definition => new()
    {
        Name = Name,
        Description =
            "Propose a reusable workout template the user can start sessions from. Check "
            + "get_workout_templates first and prefer an existing template when one fits.",
        ParametersJsonSchema = ProposalSchemas.TemplateSchema,
    };

    public bool IsAvailable(AIToolContext context) => true;

    public async Task<AIToolExecutionResult> ExecuteAsync(
        string argumentsJson,
        AIToolContext context,
        CancellationToken cancellationToken)
    {
        var payload = AIJsonSerializer.Deserialize<ProposeWorkoutTemplatePayload>(argumentsJson);
        if (payload == null)
        {
            return AIToolExecutionResult.Fail("invalid_arguments", "The arguments could not be read.");
        }

        var visibleIds = await ProposedExerciseReader.GetVisibleExerciseIdsAsync(
            dbContext,
            payload.Exercises.Select(x => x.ExerciseId),
            context.UserId);

        var errors = AIProposalValidator.ValidateExercises(payload.Exercises, visibleIds);
        if (string.IsNullOrWhiteSpace(payload.Name))
        {
            errors.Add("The template needs a name.");
        }

        if (errors.Count > 0)
        {
            return AIToolExecutionResult.Fail("validation_failed", string.Join(" ", errors));
        }

        await entitlementService.RequireFeatureAsync(context.UserId, SubscriptionFeature.AIWorkoutGeneration);
        var reservation = await usageService.ReserveAsync(
            context.UserId,
            SubscriptionFeature.AIWorkoutGeneration,
            1);

        try
        {
            var estimatedMinutes = payload.EstimatedDurationMinutes
                ?? AIProposalValidator.EstimateDurationMinutes(payload.Exercises);

            var lines = await ProposalSchemas.BuildExerciseLinesAsync(
                dbContext,
                payload.Exercises,
                cancellationToken);

            lines.Add(new AIActionPreviewLineModel
            {
                Label = "Estimated",
                Value = $"about {estimatedMinutes} min",
            });

            var action = await actionService.CreatePendingAsync(
                new CreateAIActionRequest
                {
                    ConversationId = context.ConversationId,
                    AIRunId = context.AIRunId,
                    ActionType = AIActionType.CreateWorkoutTemplate,
                    PayloadJson = AIJsonSerializer.Serialize(payload),
                    Preview = new AIActionPreviewModel
                    {
                        Title = payload.Name,
                        Subtitle = "New workout template",
                        Lines = lines,
                    },
                    ValidationSummary = new AIActionValidationSummaryModel(),
                },
                context.UserId);

            await usageService.CommitAsync(reservation.Id);

            return new AIToolExecutionResult
            {
                Success = true,
                RequiresConfirmation = true,
                AIActionId = action.Id,
                Data = new
                {
                    status = "pending_confirmation",
                    name = payload.Name,
                    exerciseCount = payload.Exercises.Count,
                    estimatedDurationMinutes = estimatedMinutes,
                },
            };
        }
        catch
        {
            await usageService.ReleaseAsync(reservation.Id);
            throw;
        }
    }
}
