using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.AIActions;
using FitMate.Core.JsonModels.ProgramPlans;
using FitMate.Core.JsonModels.WorkoutTemplates;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Integrations.AI.Serialization;
using FitMate.Services.ProgramPlans.Plans;
using FitMate.Services.WorkoutTemplates;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.AIActions.Executors;

/// <summary>
/// Reshapes an active program from tomorrow onwards. Today is left alone on purpose: the user may
/// already have started, or planned around, the workout that was scheduled when they asked.
/// </summary>
public class UpdateProgramPlanActionExecutor : IAIActionExecutor
{
    private readonly AppDbContext dbContext;
    private readonly IWorkoutTemplateService workoutTemplateService;
    private readonly IProgramPlanService programPlanService;

    public UpdateProgramPlanActionExecutor(
        AppDbContext dbContext,
        IWorkoutTemplateService workoutTemplateService,
        IProgramPlanService programPlanService)
    {
        this.dbContext = dbContext;
        this.workoutTemplateService = workoutTemplateService;
        this.programPlanService = programPlanService;
    }

    public AIActionType ActionType => AIActionType.UpdateProgramPlan;

    public async Task<AIActionResultModel> ExecuteAsync(
        AIAction action,
        long userId,
        CancellationToken cancellationToken)
    {
        var payload = AIJsonSerializer.Deserialize<ProposeProgramUpdatePayload>(action.PayloadJson)
            ?? throw new FitMateException("The suggestion payload is empty.");

        var plan = await dbContext.ProgramPlans
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == payload.ProgramPlanId && x.UserId == userId, cancellationToken)
            ?? throw new FitMateException("Program plan not found.");

        if (plan.Status != ProgramPlanStatus.Active)
        {
            throw new FitMateException("Only an active program can be rescheduled.");
        }

        var proposal = ProgramUpdateProposal.ToProposal(plan, payload);
        await RevalidateAsync(proposal, userId, cancellationToken);

        var templateIdsByKey = new Dictionary<string, long>(StringComparer.OrdinalIgnoreCase);
        foreach (var template in proposal.NewTemplates)
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

        var effectiveFrom = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1);
        var updated = await programPlanService.UpdateActiveScheduleAsync(
            plan.Id,
            ProgramPlanRequestBuilder.Build(proposal, templateIdsByKey),
            effectiveFrom,
            userId);

        return new AIActionResultModel
        {
            CreatedEntityId = updated.Id,
            CreatedEntityName = updated.Name,
            EntityKind = "program",
        };
    }

    private async Task RevalidateAsync(
        ProposeProgramPlanPayload proposal,
        long userId,
        CancellationToken cancellationToken)
    {
        var templateIds = proposal.Schedule
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
            proposal.NewTemplates.SelectMany(x => x.Exercises).Select(x => x.ExerciseId),
            userId);

        var validation = ProgramPlanProposalValidator.Validate(
            proposal,
            visibleTemplateIds,
            visibleExerciseIds,
            maximumDurationMonths: null);

        if (validation.Errors.Count > 0)
        {
            throw new FitMateException(string.Join(" ", validation.Errors));
        }
    }
}
