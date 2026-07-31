using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.AIActions;
using FitMate.Core.JsonModels.ProgramPlans;
using FitMate.Core.JsonModels.WorkoutTemplates;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Integrations.AI.Serialization;
using FitMate.Services.ProgramPlans.Plans;
using FitMate.Services.Subscriptions;
using FitMate.Services.WorkoutTemplates;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.AIActions.Executors;

/// <summary>
/// Creates any proposed templates, resolves the schedule's client keys to the resulting ids, then
/// creates a DRAFT program. Activation stays a separate, explicit user action (spec §33).
/// </summary>
public class CreateProgramPlanActionExecutor : IAIActionExecutor
{
    private readonly AppDbContext dbContext;
    private readonly IWorkoutTemplateService workoutTemplateService;
    private readonly IProgramPlanService programPlanService;
    private readonly IEntitlementService entitlementService;

    public CreateProgramPlanActionExecutor(
        AppDbContext dbContext,
        IWorkoutTemplateService workoutTemplateService,
        IProgramPlanService programPlanService,
        IEntitlementService entitlementService)
    {
        this.dbContext = dbContext;
        this.workoutTemplateService = workoutTemplateService;
        this.programPlanService = programPlanService;
        this.entitlementService = entitlementService;
    }

    public AIActionType ActionType => AIActionType.CreateProgramPlan;

    public async Task<AIActionResultModel> ExecuteAsync(
        AIAction action,
        long userId,
        CancellationToken cancellationToken)
    {
        var payload = AIJsonSerializer.Deserialize<ProposeProgramPlanPayload>(action.PayloadJson)
            ?? throw new FitMateException("The suggestion payload is empty.");

        await RevalidateAsync(payload, userId, cancellationToken);

        // Templates first: the schedule cannot be built until their real ids exist.
        var templateIdsByKey = new Dictionary<string, long>(StringComparer.OrdinalIgnoreCase);
        foreach (var template in payload.NewTemplates)
        {
            var created = await workoutTemplateService.CreateAsync(
                new CreateWorkoutTemplateRequest
                {
                    Name = template.Name.Trim(),
                    Description = template.Description,
                    EstimatedDurationMinutes = template.EstimatedDurationMinutes,
                    IsPublic = false,
                    Exercises = ProposedExerciseReader.ToTemplateExercises(template.Exercises),
                },
                userId);

            templateIdsByKey[template.ClientKey] = created.Id;
        }

        var draft = await programPlanService.CreateDraftAsync(
            ProgramPlanRequestBuilder.Build(payload, templateIdsByKey),
            userId);

        return new AIActionResultModel
        {
            CreatedEntityId = draft.Id,
            CreatedEntityName = draft.Name,
            EntityKind = "program",
        };
    }

    private async Task RevalidateAsync(
        ProposeProgramPlanPayload payload,
        long userId,
        CancellationToken cancellationToken)
    {
        var templateIds = payload.Schedule
            .Where(x => x.ExistingWorkoutTemplateId is > 0)
            .Select(x => x.ExistingWorkoutTemplateId!.Value)
            .Distinct()
            .ToList();

        var visibleTemplateIds = await dbContext.WorkoutTemplates
            .AsNoTracking()
            .Where(x => templateIds.Contains(x.Id) && (x.UserId == userId || x.IsPublic))
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);

        var visibleExerciseIds = await ProposedExerciseReader.GetVisibleExerciseIdsAsync(
            dbContext,
            payload.NewTemplates.SelectMany(x => x.Exercises).Select(x => x.ExerciseId),
            userId);

        var durationEntitlement = await entitlementService.GetEntitlementAsync(
            userId,
            SubscriptionFeature.ProgramPlanDurationMonths);

        var validation = ProgramPlanProposalValidator.Validate(
            payload,
            visibleTemplateIds,
            visibleExerciseIds,
            durationEntitlement?.HardLimit);

        if (validation.Errors.Count > 0)
        {
            throw new FitMateException(string.Join(" ", validation.Errors));
        }
    }

}
