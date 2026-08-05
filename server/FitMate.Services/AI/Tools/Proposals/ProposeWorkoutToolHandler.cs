using FitMate.Core.JsonModels.AIActions;
using FitMate.DB;
using FitMate.DB.Enums;
using FitMate.Integrations.AI.Serialization;
using FitMate.Services.AIActions;
using FitMate.Services.AIActions.Executors;
using FitMate.Services.Subscriptions;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.AI.Tools.Proposals;

/// <summary>
/// Proposes a workout for the user to confirm. Generation is charged here, not at confirmation:
/// producing the plan is what costs, and confirming it must never charge twice.
/// </summary>
public class ProposeWorkoutToolHandler : IAIToolHandler
{
    private readonly AppDbContext dbContext;
    private readonly IAIActionService actionService;
    private readonly IEntitlementService entitlementService;
    private readonly IUsageService usageService;

    public ProposeWorkoutToolHandler(
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

    public string Name => "propose_workout";

    public AIToolDefinition Definition => new()
    {
        Name = Name,
        Description =
            "Propose a workout for the user to confirm. Use search_exercises and get_exercise_history "
            + "first so the exercise ids are real and the loads follow what the user actually lifts.",
        ParametersJsonSchema = ProposalSchemas.WorkoutSchema,
    };

    public bool IsAvailable(AIToolContext context) => true;

    public async Task<AIToolExecutionResult> ExecuteAsync(
        string argumentsJson,
        AIToolContext context,
        CancellationToken cancellationToken)
    {
        var payload = AIJsonSerializer.Deserialize<ProposeWorkoutPayload>(argumentsJson);
        if (payload == null)
        {
            return AIToolExecutionResult.Fail("invalid_arguments", "The arguments could not be read.");
        }

        var visibleIds = await ProposedExerciseReader.GetVisibleExerciseIdsAsync(
            dbContext,
            payload.Exercises.Where(x => string.IsNullOrWhiteSpace(x.NewExerciseClientKey)).Select(x => x.ExerciseId),
            context.UserId);

        var errors = AIProposalValidator.ValidateNewExercises(payload.NewExercises);
        errors.AddRange(AIProposalValidator.ValidateExercises(
            payload.Exercises,
            visibleIds,
            payload.NewExercises.Select(x => x.ClientKey).ToList()));
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
            var estimatedMinutes = AIProposalValidator.EstimateDurationMinutes(payload.Exercises);
            var warnings = new List<string>();

            if (estimatedMinutes > 120)
            {
                warnings.Add($"This session is estimated at about {estimatedMinutes} minutes.");
            }

            var action = await actionService.CreatePendingAsync(
                new CreateAIActionRequest
                {
                    ConversationId = context.ConversationId,
                    AIRunId = context.AIRunId,
                    ActionType = AIActionType.CreateWorkout,
                    PayloadJson = AIJsonSerializer.Serialize(payload),
                    Preview = await BuildPreviewAsync(payload, estimatedMinutes, cancellationToken),
                    ValidationSummary = new AIActionValidationSummaryModel { Warnings = warnings },
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
                    title = payload.Title,
                    exerciseCount = payload.Exercises.Count,
                    estimatedDurationMinutes = estimatedMinutes,
                    warnings,
                },
            };
        }
        catch
        {
            await usageService.ReleaseAsync(reservation.Id);
            throw;
        }
    }

    private async Task<AIActionPreviewModel> BuildPreviewAsync(
        ProposeWorkoutPayload payload,
        int estimatedMinutes,
        CancellationToken cancellationToken)
    {
        var lines = await ProposalSchemas.BuildExerciseLinesAsync(
            dbContext,
            payload.Exercises,
            cancellationToken,
            payload.NewExercises);

        lines.Add(new AIActionPreviewLineModel
        {
            Label = "Estimated",
            Value = $"about {estimatedMinutes} min",
        });

        return new AIActionPreviewModel
        {
            Title = string.IsNullOrWhiteSpace(payload.Title) ? "AI workout" : payload.Title,
            Subtitle = "New workout",
            Lines = lines,
        };
    }
}
