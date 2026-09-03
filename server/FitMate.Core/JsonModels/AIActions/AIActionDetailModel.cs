using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.AIActions;

/// <summary>
/// The full, resolved view of a workout or template proposal: every exercise with its image and
/// every prescribed set. The card preview carries only label/value lines, which is deliberately too
/// little to review a session against.
/// </summary>
public class AIActionDetailModel
{
    public long ActionId { get; set; }
    public AIActionType ActionType { get; set; }
    public AIActionStatus Status { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public int EstimatedDurationMinutes { get; set; }
    public List<AIProposalExerciseModel> Exercises { get; set; } = [];
}

public class AIProposalExerciseModel
{
    /// <summary>Zero while the proposal still carries the exercise as one it wants to create.</summary>
    public long ExerciseId { get; set; }

    public string Name { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public string? PrimaryMuscleGroupName { get; set; }
    public string? SecondaryMuscleGroupName { get; set; }
    public ExerciseEquipment? Equipment { get; set; }

    /// <summary>True when confirming this proposal would also create the exercise itself.</summary>
    public bool IsNew { get; set; }

    public List<AIProposalSetModel> Sets { get; set; } = [];
}

public class AIProposalSetModel
{
    public ExerciseSetType SetType { get; set; }
    public int? Reps { get; set; }
    public decimal? WeightKg { get; set; }
    public decimal? Rpe { get; set; }
    public int? RestSeconds { get; set; }
}

/// <summary>
/// The answer to "add these to the session I already have running": the action, now executed, plus
/// the resolved exercises the client appends to the live draft.
/// </summary>
public class AIActionMergeResultModel
{
    public AIActionModel Action { get; set; } = new();
    public AIActionDetailModel Detail { get; set; } = new();
}
