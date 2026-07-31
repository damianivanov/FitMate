using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.AIActions;
using FitMate.Core.JsonModels.Exercises;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Integrations.AI.Serialization;
using FitMate.Services.Exercises;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.AIActions.Executors;

/// <summary>
/// Shared revalidation for both exercise executors: the stored payload is re-checked against the
/// database before anything is created, because it was written by the model, not by a form.
/// </summary>
internal static class ExercisePayloadReader
{
    internal static async Task<ProposeExercisePayload> ReadAndValidateAsync(
        AppDbContext dbContext,
        AIAction action)
    {
        var payload = AIJsonSerializer.Deserialize<ProposeExercisePayload>(action.PayloadJson)
            ?? throw new FitMateException("The suggestion payload is empty.");

        var errors = AIProposalValidator.ValidateExercise(payload);
        if (errors.Count > 0)
        {
            throw new FitMateException(string.Join(" ", errors));
        }

        var muscleGroupIds = new List<long> { payload.PrimaryMuscleGroupId };
        if (payload.SecondaryMuscleGroupId is { } secondary)
        {
            muscleGroupIds.Add(secondary);
        }

        var knownCount = await dbContext.MuscleGroups
            .CountAsync(x => muscleGroupIds.Contains(x.Id));

        if (knownCount != muscleGroupIds.Distinct().Count())
        {
            throw new FitMateException("The suggestion references a muscle group that no longer exists.");
        }

        return payload;
    }

    internal static CreateExerciseRequest ToRequest(ProposeExercisePayload payload, bool isPublic) => new()
    {
        Name = payload.Name.Trim(),
        Description = payload.Description,
        PrimaryMuscleGroupId = payload.PrimaryMuscleGroupId,
        SecondaryMuscleGroupId = payload.SecondaryMuscleGroupId,
        Equipment = payload.Equipment,
        MovementPattern = payload.MovementPattern,
        Difficulty = payload.Difficulty,
        Category = payload.Category,
        Aliases = payload.Aliases,
        IsPublic = isPublic,
    };
}

public class CreatePersonalExerciseActionExecutor : IAIActionExecutor
{
    private readonly AppDbContext dbContext;
    private readonly IExerciseService exerciseService;

    public CreatePersonalExerciseActionExecutor(AppDbContext dbContext, IExerciseService exerciseService)
    {
        this.dbContext = dbContext;
        this.exerciseService = exerciseService;
    }

    public AIActionType ActionType => AIActionType.CreatePersonalExercise;

    public async Task<AIActionResultModel> ExecuteAsync(
        AIAction action,
        long userId,
        CancellationToken cancellationToken)
    {
        var payload = await ExercisePayloadReader.ReadAndValidateAsync(dbContext, action);
        var created = await exerciseService.CreatePersonalAsync(
            ExercisePayloadReader.ToRequest(payload, payload.IsPublic));

        return new AIActionResultModel
        {
            CreatedEntityId = created.Id,
            CreatedEntityName = created.Name,
            EntityKind = "exercises",
        };
    }
}

public class CreateGlobalExerciseActionExecutor : IAIActionExecutor
{
    private readonly AppDbContext dbContext;
    private readonly IExerciseService exerciseService;

    public CreateGlobalExerciseActionExecutor(AppDbContext dbContext, IExerciseService exerciseService)
    {
        this.dbContext = dbContext;
        this.exerciseService = exerciseService;
    }

    public AIActionType ActionType => AIActionType.CreateGlobalExercise;

    public async Task<AIActionResultModel> ExecuteAsync(
        AIAction action,
        long userId,
        CancellationToken cancellationToken)
    {
        var payload = await ExercisePayloadReader.ReadAndValidateAsync(dbContext, action);

        // CreateGlobalAsync re-checks the admin role itself, so a stale proposal from a demoted
        // administrator cannot slip through.
        var created = await exerciseService.CreateGlobalAsync(
            ExercisePayloadReader.ToRequest(payload, isPublic: true));

        return new AIActionResultModel
        {
            CreatedEntityId = created.Id,
            CreatedEntityName = created.Name,
            EntityKind = "exercises",
        };
    }
}
