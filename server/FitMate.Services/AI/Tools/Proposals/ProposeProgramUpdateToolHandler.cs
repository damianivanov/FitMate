using FitMate.Core.JsonModels.AIActions;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Integrations.AI.Serialization;
using FitMate.Services.AIActions;
using FitMate.Services.AIActions.Executors;
using FitMate.Services.Subscriptions;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.AI.Tools.Proposals;

/// <summary>
/// Proposes a new weekly shape for an already active program. Only future days are affected; the
/// plan's dates, goal and schedule type stay as they are.
/// </summary>
public class ProposeProgramUpdateToolHandler : IAIToolHandler
{
    private readonly AppDbContext dbContext;
    private readonly IAIActionService actionService;
    private readonly IEntitlementService entitlementService;
    private readonly IUsageService usageService;

    public ProposeProgramUpdateToolHandler(
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

    public string Name => "propose_program_update";

    public AIToolDefinition Definition => new()
    {
        Name = Name,
        Description =
            "Change the weekly schedule of an active program from tomorrow onwards. Days the user "
            + "has already trained, started or moved are never touched. Call get_active_program first.",
        ParametersJsonSchema = ProgramPlanSchemas.ProgramUpdateSchema,
    };

    public bool IsAvailable(AIToolContext context) => true;

    public async Task<AIToolExecutionResult> ExecuteAsync(
        string argumentsJson,
        AIToolContext context,
        CancellationToken cancellationToken)
    {
        var payload = AIJsonSerializer.Deserialize<ProposeProgramUpdatePayload>(argumentsJson);
        if (payload == null)
        {
            return AIToolExecutionResult.Fail("invalid_arguments", "The arguments could not be read.");
        }

        var plan = await dbContext.ProgramPlans
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.Id == payload.ProgramPlanId && x.UserId == context.UserId,
                cancellationToken);

        if (plan == null)
        {
            return AIToolExecutionResult.Fail("not_found", "That program does not exist.");
        }

        if (plan.Status != ProgramPlanStatus.Active)
        {
            return AIToolExecutionResult.Fail("validation_failed", "Only an active program can be rescheduled.");
        }

        var proposal = ProgramUpdateProposal.ToProposal(plan, payload);

        var templateNames = await ProgramPlanSchemas.GetVisibleTemplateNamesAsync(
            dbContext,
            proposal,
            context.UserId,
            cancellationToken);

        var visibleExerciseIds = await ProposedExerciseReader.GetVisibleExerciseIdsAsync(
            dbContext,
            proposal.NewTemplates.SelectMany(x => x.Exercises).Select(x => x.ExerciseId),
            context.UserId);

        // The plan's own dates are unchanged, so the duration entitlement is not re-checked here:
        // a downgraded user should still be able to reshape a program they already own.
        var validation = ProgramPlanProposalValidator.Validate(
            proposal,
            templateNames.Keys.ToList(),
            visibleExerciseIds,
            maximumDurationMonths: null);

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
            var lines = ProgramPlanSchemas.BuildPreviewLines(proposal, templateNames);
            if (!string.IsNullOrWhiteSpace(payload.Reason))
            {
                lines.Insert(0, new AIActionPreviewLineModel { Label = "Why", Value = payload.Reason });
            }

            var action = await actionService.CreatePendingAsync(
                new CreateAIActionRequest
                {
                    ConversationId = context.ConversationId,
                    AIRunId = context.AIRunId,
                    ActionType = AIActionType.UpdateProgramPlan,
                    PayloadJson = AIJsonSerializer.Serialize(payload),
                    Preview = new AIActionPreviewModel
                    {
                        Title = plan.Name,
                        Subtitle = "Change this program from tomorrow",
                        Lines = lines,
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
                    programPlanId = plan.Id,
                    trainingDays = payload.Schedule.Count(x => x.DayType != ProgramPlanDayType.Rest),
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
