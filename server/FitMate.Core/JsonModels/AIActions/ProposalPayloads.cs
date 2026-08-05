using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.AIActions;

/// <summary>
/// The arguments the model supplies for propose_exercise. Stored verbatim on the action and
/// revalidated at confirmation time — never trusted on the strength of the first check alone.
/// </summary>
public class ProposeExercisePayload
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public long PrimaryMuscleGroupId { get; set; }
    public long? SecondaryMuscleGroupId { get; set; }
    public ExerciseEquipment? Equipment { get; set; }
    public ExerciseMovementPattern? MovementPattern { get; set; }
    public ExerciseDifficulty? Difficulty { get; set; }
    public ExerciseCategory? Category { get; set; }
    public bool IsPublic { get; set; }
    public List<string> Aliases { get; set; } = [];

    /// <summary>Administrators only: add to the shared catalogue instead of the user's account.</summary>
    public bool IsGlobal { get; set; }
}

public class ProposeWorkoutPayload
{
    public string Title { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public List<ProposedExercise> Exercises { get; set; } = [];
    public List<ProposedNewExercise> NewExercises { get; set; } = [];
}

public class ProposeWorkoutTemplatePayload
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int? EstimatedDurationMinutes { get; set; }
    public bool IsPublic { get; set; }
    public List<ProposedExercise> Exercises { get; set; } = [];
    public List<ProposedNewExercise> NewExercises { get; set; } = [];
}

/// <summary>
/// An exercise that does not exist yet, created as part of the same confirmation as the workout or
/// template that uses it. Mirrors how a program proposal carries its new templates.
/// </summary>
public class ProposedNewExercise : ProposeExercisePayload
{
    /// <summary>Short handle the exercise list refers to, e.g. "skull-crusher".</summary>
    public string ClientKey { get; set; } = string.Empty;
}

public class ProposedExercise
{
    /// <summary>An existing exercise. Zero when NewExerciseClientKey is used instead.</summary>
    public long ExerciseId { get; set; }

    /// <summary>The clientKey of one of the newExercises carried by the same proposal.</summary>
    public string? NewExerciseClientKey { get; set; }

    public List<ProposedSet> Sets { get; set; } = [];
}

public class ProposedSet
{
    public ExerciseSetType SetType { get; set; } = ExerciseSetType.Working;
    public int? Reps { get; set; }
    public decimal? WeightKg { get; set; }
    public decimal? Rpe { get; set; }
    public int? RestSeconds { get; set; }
}
