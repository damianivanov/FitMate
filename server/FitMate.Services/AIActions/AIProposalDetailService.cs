using FitMate.Core.JsonModels.AIActions;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Integrations.AI.Serialization;
using FitMate.Services.Storage.Blobs;
using FitMate.Services.Storage.Urls;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.AIActions;

public interface IAIProposalDetailService
{
    Task<AIActionDetailModel?> GetAsync(long actionId, long userId, CancellationToken cancellationToken = default);

    Task<AIActionDetailModel> BuildAsync(AIAction action, CancellationToken cancellationToken = default);
}

/// <summary>
/// Reads a proposal's stored payload and resolves it into something reviewable: real exercise names,
/// signed image URLs and every prescribed set.
/// </summary>
/// <remarks>
/// Always reads the payload, never the created entity, and the confirming executor writes its
/// resolved payload back. So the same code path serves a pending proposal, one that created a
/// workout, and one that was merged into a session already running.
/// </remarks>
public class AIProposalDetailService : IAIProposalDetailService
{
    private readonly AppDbContext dbContext;
    private readonly IPhotoUrlResolver photoUrlResolver;

    public AIProposalDetailService(AppDbContext dbContext, IPhotoUrlResolver photoUrlResolver)
    {
        this.dbContext = dbContext;
        this.photoUrlResolver = photoUrlResolver;
    }

    public async Task<AIActionDetailModel?> GetAsync(
        long actionId,
        long userId,
        CancellationToken cancellationToken = default)
    {
        var action = await dbContext.AIActions
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == actionId && x.UserId == userId, cancellationToken);

        return action == null ? null : await BuildAsync(action, cancellationToken);
    }

    public async Task<AIActionDetailModel> BuildAsync(
        AIAction action,
        CancellationToken cancellationToken = default)
    {
        var detail = new AIActionDetailModel
        {
            ActionId = action.Id,
            ActionType = action.ActionType,
            Status = action.Status,
        };

        var (exercises, newExercises) = ReadProposal(action, detail);
        if (exercises.Count == 0)
        {
            return detail;
        }

        // A template proposal states its own duration; a workout proposal is estimated from its sets.
        if (detail.EstimatedDurationMinutes <= 0)
        {
            detail.EstimatedDurationMinutes = AIProposalValidator.EstimateDurationMinutes(exercises);
        }

        var known = await ReadExerciseSummariesAsync(exercises, cancellationToken);
        var newByKey = newExercises.ToDictionary(x => x.ClientKey, StringComparer.OrdinalIgnoreCase);

        foreach (var proposed in exercises)
        {
            detail.Exercises.Add(await BuildExerciseAsync(proposed, known, newByKey));
        }

        return detail;
    }

    /// <summary>
    /// Workout and template payloads differ only in their headline fields; every other proposal type
    /// has nothing exercise-shaped to show.
    /// </summary>
    private static (List<ProposedExercise> Exercises, List<ProposedNewExercise> NewExercises) ReadProposal(
        AIAction action,
        AIActionDetailModel detail)
    {
        if (action.ActionType == AIActionType.CreateWorkout)
        {
            var payload = AIJsonSerializer.Deserialize<ProposeWorkoutPayload>(action.PayloadJson);
            if (payload == null)
            {
                return ([], []);
            }

            detail.Title = string.IsNullOrWhiteSpace(payload.Title) ? "AI workout" : payload.Title;
            detail.Notes = payload.Notes;
            return (payload.Exercises, payload.NewExercises);
        }

        if (action.ActionType == AIActionType.CreateWorkoutTemplate)
        {
            var payload = AIJsonSerializer.Deserialize<ProposeWorkoutTemplatePayload>(action.PayloadJson);
            if (payload == null)
            {
                return ([], []);
            }

            detail.Title = string.IsNullOrWhiteSpace(payload.Name) ? "AI template" : payload.Name;
            detail.Notes = payload.Description;
            detail.EstimatedDurationMinutes = payload.EstimatedDurationMinutes ?? 0;
            return (payload.Exercises, payload.NewExercises);
        }

        return ([], []);
    }

    private async Task<Dictionary<long, ExerciseSummary>> ReadExerciseSummariesAsync(
        IReadOnlyList<ProposedExercise> exercises,
        CancellationToken cancellationToken)
    {
        var ids = exercises
            .Where(x => x.ExerciseId > 0)
            .Select(x => x.ExerciseId)
            .Distinct()
            .ToList();

        if (ids.Count == 0)
        {
            return [];
        }

        var rows = await dbContext.Exercises
            .AsNoTracking()
            .Where(x => ids.Contains(x.Id))
            .Select(x => new ExerciseSummary
            {
                Id = x.Id,
                Name = x.Name,
                StoredImage = x.ImageUrl,
                PrimaryMuscleGroupName = x.PrimaryMuscleGroup.Name,
                SecondaryMuscleGroupName = x.SecondaryMuscleGroup != null ? x.SecondaryMuscleGroup.Name : null,
                Equipment = x.Equipment,
            })
            .ToListAsync(cancellationToken);

        return rows.ToDictionary(x => x.Id);
    }

    private async Task<AIProposalExerciseModel> BuildExerciseAsync(
        ProposedExercise proposed,
        IReadOnlyDictionary<long, ExerciseSummary> known,
        IReadOnlyDictionary<string, ProposedNewExercise> newByKey)
    {
        var model = new AIProposalExerciseModel
        {
            ExerciseId = proposed.ExerciseId,
            Sets = [.. proposed.Sets.Select(set => new AIProposalSetModel
            {
                SetType = set.SetType,
                Reps = set.Reps,
                WeightKg = set.WeightKg,
                Rpe = set.Rpe,
                RestSeconds = set.RestSeconds,
            })],
        };

        if (known.TryGetValue(proposed.ExerciseId, out var summary))
        {
            model.Name = summary.Name;
            model.PrimaryMuscleGroupName = summary.PrimaryMuscleGroupName;
            model.SecondaryMuscleGroupName = summary.SecondaryMuscleGroupName;
            model.Equipment = summary.Equipment;
            model.ImageUrl = await photoUrlResolver.ResolveAsync(
                BlobPathBuilder.Compose(StorageModule.Exercises, summary.Id, summary.StoredImage));
            return model;
        }

        // Still unconfirmed: the exercise exists only in the proposal, so its name comes from there.
        if (!string.IsNullOrWhiteSpace(proposed.NewExerciseClientKey)
            && newByKey.TryGetValue(proposed.NewExerciseClientKey, out var candidate))
        {
            model.IsNew = true;
            model.Name = candidate.Name;
            model.Equipment = candidate.Equipment;
            return model;
        }

        model.Name = "Unavailable exercise";
        return model;
    }

    private sealed class ExerciseSummary
    {
        public long Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? StoredImage { get; set; }
        public string? PrimaryMuscleGroupName { get; set; }
        public string? SecondaryMuscleGroupName { get; set; }
        public ExerciseEquipment? Equipment { get; set; }
    }
}
