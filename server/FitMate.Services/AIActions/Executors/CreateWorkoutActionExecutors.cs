using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.AIActions;
using FitMate.Core.JsonModels.WorkoutTemplates;
using FitMate.Core.JsonModels.Workouts;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Integrations.AI.Serialization;
using FitMate.Services.WorkoutTemplates;
using FitMate.Services.Workouts;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.AIActions.Executors;

/// <summary>
/// Revalidation shared by the workout and template executors. Exercise visibility is re-resolved
/// from the database: a proposal made yesterday must not be able to reference something the user
/// has since lost access to.
/// </summary>
internal static class ProposedExerciseReader
{
    internal static async Task<IReadOnlyList<long>> GetVisibleExerciseIdsAsync(
        AppDbContext dbContext,
        IEnumerable<long> exerciseIds,
        long userId)
    {
        var ids = exerciseIds.Distinct().ToList();

        return await dbContext.Exercises
            .AsNoTracking()
            .Where(x => ids.Contains(x.Id) && (x.UserId == null || x.UserId == userId || x.IsPublic))
            .Select(x => x.Id)
            .ToListAsync();
    }

    internal static async Task ValidateAsync(
        AppDbContext dbContext,
        IReadOnlyList<ProposedExercise> exercises,
        long userId)
    {
        var visibleIds = await GetVisibleExerciseIdsAsync(
            dbContext,
            exercises.Select(x => x.ExerciseId),
            userId);

        var errors = AIProposalValidator.ValidateExercises(exercises, visibleIds);
        if (errors.Count > 0)
        {
            throw new FitMateException(string.Join(" ", errors));
        }
    }

    internal static List<CreateWorkoutExerciseRequest> ToWorkoutExercises(
        IReadOnlyList<ProposedExercise> exercises) =>
        exercises
            .Select((exercise, index) => new CreateWorkoutExerciseRequest
            {
                GroupType = ExerciseGroupType.Straight,
                OrderIndex = index,
                ExerciseId = exercise.ExerciseId,
                Sets = exercise.Sets
                    .Select(set => new CreateWorkoutSetRequest
                    {
                        SetType = set.SetType,
                        Reps = set.Reps,
                        WeightKg = set.WeightKg,
                        Rpe = set.Rpe,
                        IsCompleted = false,
                    })
                    .ToList(),
            })
            .ToList();

    internal static List<CreateWorkoutTemplateExerciseRequest> ToTemplateExercises(
        IReadOnlyList<ProposedExercise> exercises) =>
        exercises
            .Select(exercise => new CreateWorkoutTemplateExerciseRequest
            {
                GroupType = ExerciseGroupType.Straight,
                ExerciseId = exercise.ExerciseId,
                Sets = exercise.Sets
                    .Select(set => new CreateWorkoutTemplateExerciseSetRequest
                    {
                        SetType = set.SetType,
                        Reps = set.Reps,
                        WeightKg = set.WeightKg,
                    })
                    .ToList(),
            })
            .ToList();
}

public class CreateWorkoutActionExecutor : IAIActionExecutor
{
    private readonly AppDbContext dbContext;
    private readonly IWorkoutService workoutService;

    public CreateWorkoutActionExecutor(AppDbContext dbContext, IWorkoutService workoutService)
    {
        this.dbContext = dbContext;
        this.workoutService = workoutService;
    }

    public AIActionType ActionType => AIActionType.CreateWorkout;

    public async Task<AIActionResultModel> ExecuteAsync(
        AIAction action,
        long userId,
        CancellationToken cancellationToken)
    {
        var payload = AIJsonSerializer.Deserialize<ProposeWorkoutPayload>(action.PayloadJson)
            ?? throw new FitMateException("The suggestion payload is empty.");

        await ProposedExerciseReader.ValidateAsync(dbContext, payload.Exercises, userId);

        var created = await workoutService.CreateAsync(
            new SaveWorkoutRequest
            {
                Title = string.IsNullOrWhiteSpace(payload.Title) ? "AI workout" : payload.Title.Trim(),
                Notes = payload.Notes,
                Exercises = ProposedExerciseReader.ToWorkoutExercises(payload.Exercises),
            },
            userId);

        return new AIActionResultModel
        {
            CreatedEntityId = created.WorkoutId,
            CreatedEntityName = payload.Title,
            EntityKind = "workouts",
        };
    }
}

public class CreateWorkoutTemplateActionExecutor : IAIActionExecutor
{
    private readonly AppDbContext dbContext;
    private readonly IWorkoutTemplateService workoutTemplateService;

    public CreateWorkoutTemplateActionExecutor(
        AppDbContext dbContext,
        IWorkoutTemplateService workoutTemplateService)
    {
        this.dbContext = dbContext;
        this.workoutTemplateService = workoutTemplateService;
    }

    public AIActionType ActionType => AIActionType.CreateWorkoutTemplate;

    public async Task<AIActionResultModel> ExecuteAsync(
        AIAction action,
        long userId,
        CancellationToken cancellationToken)
    {
        var payload = AIJsonSerializer.Deserialize<ProposeWorkoutTemplatePayload>(action.PayloadJson)
            ?? throw new FitMateException("The suggestion payload is empty.");

        await ProposedExerciseReader.ValidateAsync(dbContext, payload.Exercises, userId);

        // The template service enforces the CustomWorkoutTemplates quota, so a user who has hit
        // their plan limit since the proposal gets a clean 429 instead of a silent extra template.
        var created = await workoutTemplateService.CreateAsync(
            new CreateWorkoutTemplateRequest
            {
                Name = string.IsNullOrWhiteSpace(payload.Name) ? "AI template" : payload.Name.Trim(),
                Description = payload.Description,
                EstimatedDurationMinutes = payload.EstimatedDurationMinutes,
                IsPublic = payload.IsPublic,
                Exercises = ProposedExerciseReader.ToTemplateExercises(payload.Exercises),
            },
            userId);

        return new AIActionResultModel
        {
            CreatedEntityId = created.Id,
            CreatedEntityName = created.Name,
            EntityKind = "templates",
        };
    }
}
