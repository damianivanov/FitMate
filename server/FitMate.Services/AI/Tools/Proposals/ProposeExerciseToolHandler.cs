using FitMate.Core.JsonModels.AIActions;
using FitMate.DB;
using FitMate.DB.Enums;
using FitMate.Integrations.AI.Serialization;
using FitMate.Services.AIActions;
using FitMate.Services.Exercises;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.AI.Tools.Proposals;

/// <summary>
/// Proposes a new exercise. Creates nothing: it records a pending action the user must confirm.
/// </summary>
public class ProposeExerciseToolHandler : IAIToolHandler
{
    private const int MaxDuplicateCandidates = 5;

    private readonly AppDbContext dbContext;
    private readonly IAIActionService actionService;

    public ProposeExerciseToolHandler(AppDbContext dbContext, IAIActionService actionService)
    {
        this.dbContext = dbContext;
        this.actionService = actionService;
    }

    public string Name => "propose_exercise";

    public AIToolDefinition Definition => new()
    {
        Name = Name,
        Description =
            "Propose creating a new exercise for the user. Search first: only propose one when "
            + "nothing suitable already exists. The user must confirm before it is created.",
        ParametersJsonSchema = """
        {
          "type": "object",
          "properties": {
            "name": { "type": "string" },
            "description": { "type": "string" },
            "primaryMuscleGroupId": { "type": "integer" },
            "secondaryMuscleGroupId": { "type": "integer" },
            "equipment": { "type": "string", "enum": ["Barbell","Dumbbell","Kettlebell","Cable","Machine","Bodyweight","ResistanceBand","MedicineBall","Other"] },
            "movementPattern": { "type": "string", "enum": ["HorizontalPush","HorizontalPull","VerticalPush","VerticalPull","Squat","Hinge","Lunge","Carry","Rotation","Isolation","Other"] },
            "difficulty": { "type": "string", "enum": ["Beginner","Intermediate","Advanced"] },
            "category": { "type": "string", "enum": ["Strength","Cardio","Mobility","Plyometric","Olympic","Other"] },
            "isPublic": { "type": "boolean", "description": "Share this personal exercise with other users." },
            "aliases": { "type": "array", "items": { "type": "string" } }
          },
          "required": ["name", "primaryMuscleGroupId"]
        }
        """,
    };

    public bool IsAvailable(AIToolContext context) => true;

    public async Task<AIToolExecutionResult> ExecuteAsync(
        string argumentsJson,
        AIToolContext context,
        CancellationToken cancellationToken)
    {
        var payload = AIJsonSerializer.Deserialize<ProposeExercisePayload>(argumentsJson);
        if (payload == null)
        {
            return AIToolExecutionResult.Fail("invalid_arguments", "The arguments could not be read.");
        }

        // The model never gets to decide scope: only the admin-only endpoint creates global entries.
        payload.IsGlobal = false;

        var errors = AIProposalValidator.ValidateExercise(payload);

        var muscleGroupIds = new List<long> { payload.PrimaryMuscleGroupId };
        if (payload.SecondaryMuscleGroupId is { } secondary)
        {
            muscleGroupIds.Add(secondary);
        }

        var knownMuscleGroups = await dbContext.MuscleGroups
            .CountAsync(x => muscleGroupIds.Contains(x.Id), cancellationToken);

        if (knownMuscleGroups != muscleGroupIds.Distinct().Count())
        {
            errors.Add("One of the muscle group ids does not exist.");
        }

        if (errors.Count > 0)
        {
            return AIToolExecutionResult.Fail("validation_failed", string.Join(" ", errors));
        }

        var duplicates = await FindDuplicateCandidatesAsync(payload.Name, context.UserId, cancellationToken);

        var warnings = new List<string>();
        if (duplicates.Count > 0)
        {
            warnings.Add("Similar exercises already exist — confirm only if this is genuinely new.");
        }

        var action = await actionService.CreatePendingAsync(
            new CreateAIActionRequest
            {
                ConversationId = context.ConversationId,
                AIRunId = context.AIRunId,
                ActionType = AIActionType.CreatePersonalExercise,
                PayloadJson = AIJsonSerializer.Serialize(payload),
                Preview = BuildPreview(payload),
                ValidationSummary = new AIActionValidationSummaryModel
                {
                    Warnings = warnings,
                    DuplicateCandidates = duplicates,
                },
            },
            context.UserId);

        return new AIToolExecutionResult
        {
            Success = true,
            RequiresConfirmation = true,
            AIActionId = action.Id,
            Data = new
            {
                status = "pending_confirmation",
                name = payload.Name,
                duplicateCandidates = duplicates.Select(x => new { x.Id, x.Name }).ToList(),
            },
        };
    }

    private async Task<List<DuplicateCandidateModel>> FindDuplicateCandidatesAsync(
        string name,
        long userId,
        CancellationToken cancellationToken)
    {
        var normalized = ExerciseAliasNormalizer.Normalize(name);
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return [];
        }

        var lowered = name.Trim().ToLowerInvariant();

        return await dbContext.Exercises
            .AsNoTracking()
            .Where(x => x.UserId == null || x.UserId == userId || x.IsPublic)
            .Where(x => x.Name.ToLower().Contains(lowered)
                || x.Aliases.Any(alias => alias.NormalizedAlias == normalized))
            .OrderBy(x => x.Name)
            .Take(MaxDuplicateCandidates)
            .Select(x => new DuplicateCandidateModel
            {
                Id = x.Id,
                Name = x.Name,
                Reason = x.UserId == null ? "Already in the shared catalogue" : "You already have this",
            })
            .ToListAsync(cancellationToken);
    }

    private static AIActionPreviewModel BuildPreview(ProposeExercisePayload payload)
    {
        var lines = new List<AIActionPreviewLineModel>();

        if (payload.Equipment is { } equipment)
        {
            lines.Add(new AIActionPreviewLineModel { Label = "Equipment", Value = equipment.ToString() });
        }

        if (payload.MovementPattern is { } pattern)
        {
            lines.Add(new AIActionPreviewLineModel { Label = "Movement", Value = pattern.ToString() });
        }

        if (payload.Difficulty is { } difficulty)
        {
            lines.Add(new AIActionPreviewLineModel { Label = "Difficulty", Value = difficulty.ToString() });
        }

        lines.Add(new AIActionPreviewLineModel
        {
            Label = "Visibility",
            Value = payload.IsPublic ? "Shared with other users" : "Private to you",
        });

        return new AIActionPreviewModel
        {
            Title = payload.Name,
            Subtitle = "New exercise",
            Lines = lines,
        };
    }
}
