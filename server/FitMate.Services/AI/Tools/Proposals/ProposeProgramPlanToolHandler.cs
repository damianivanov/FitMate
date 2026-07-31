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
/// Proposes a whole program: a weekly schedule plus, optionally, the templates it needs. Confirming
/// creates a DRAFT — the user still activates it themselves.
/// </summary>
public class ProposeProgramPlanToolHandler : IAIToolHandler
{
    private readonly AppDbContext dbContext;
    private readonly IAIActionService actionService;
    private readonly IEntitlementService entitlementService;
    private readonly IUsageService usageService;

    public ProposeProgramPlanToolHandler(
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

    public string Name => "propose_program_plan";

    public AIToolDefinition Definition => new()
    {
        Name = Name,
        Description =
            "Propose a training program: a repeating schedule of training and rest days, plus any "
            + "new workout templates it needs. Call get_workout_templates first and reuse existing "
            + "templates where they fit. Confirming creates a draft the user activates separately.",
        ParametersJsonSchema = ProgramPlanSchemas.ProgramPlanSchema,
    };

    public bool IsAvailable(AIToolContext context) => true;

    public async Task<AIToolExecutionResult> ExecuteAsync(
        string argumentsJson,
        AIToolContext context,
        CancellationToken cancellationToken)
    {
        var payload = AIJsonSerializer.Deserialize<ProposeProgramPlanPayload>(argumentsJson);
        if (payload == null)
        {
            return AIToolExecutionResult.Fail("invalid_arguments", "The arguments could not be read.");
        }

        var templateNames = await ProgramPlanSchemas.GetVisibleTemplateNamesAsync(
            dbContext,
            payload,
            context.UserId,
            cancellationToken);


        var visibleExerciseIds = await ProposedExerciseReader.GetVisibleExerciseIdsAsync(
            dbContext,
            payload.NewTemplates.SelectMany(x => x.Exercises).Select(x => x.ExerciseId),
            context.UserId);

        var durationEntitlement = await entitlementService.GetEntitlementAsync(
            context.UserId,
            SubscriptionFeature.ProgramPlanDurationMonths);

        var validation = ProgramPlanProposalValidator.Validate(
            payload,
            templateNames.Keys.ToList(),
            visibleExerciseIds,
            durationEntitlement?.HardLimit);

        if (validation.Errors.Count > 0)
        {
            return AIToolExecutionResult.Fail("validation_failed", string.Join(" ", validation.Errors));
        }

        await entitlementService.RequireFeatureAsync(context.UserId, SubscriptionFeature.AIProgramGeneration);
        var reservation = await usageService.ReserveAsync(
            context.UserId,
            SubscriptionFeature.AIProgramGeneration,
            1);

        try
        {
            var action = await actionService.CreatePendingAsync(
                new CreateAIActionRequest
                {
                    ConversationId = context.ConversationId,
                    AIRunId = context.AIRunId,
                    ActionType = AIActionType.CreateProgramPlan,
                    PayloadJson = AIJsonSerializer.Serialize(payload),
                    Preview = new AIActionPreviewModel
                    {
                        Title = payload.Name,
                        Subtitle = "New program (saved as a draft)",
                        Lines = ProgramPlanSchemas.BuildPreviewLines(payload, templateNames),
                    },
                    ValidationSummary = new AIActionValidationSummaryModel
                    {
                        Warnings = validation.Warnings,
                    },
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
                    trainingDays = payload.Schedule.Count(x => x.DayType != ProgramPlanDayType.Rest),
                    newTemplates = payload.NewTemplates.Count,
                    warnings = validation.Warnings,
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
