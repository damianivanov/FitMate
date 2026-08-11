namespace FitMate.Services.AI.Context;

/// <summary>
/// AI-facing projections. Deliberately narrower than the UI models: no image or video URLs, no set
/// rows beyond the latest session, and no field the prompt never reads.
/// </summary>
public sealed record AIRecentWorkoutModel(
    long Id,
    string Title,
    DateTime? StartedAt,
    DateTime? FinishedAt,
    decimal? TotalVolumeKg,
    int? DurationSeconds,
    IReadOnlyList<AIRecentWorkoutExerciseModel> Exercises);

public sealed record AIRecentWorkoutExerciseModel(long ExerciseId, string ExerciseName, int SetCount);

public sealed record AIExerciseCandidateModel(
    long Id,
    string Name,
    long PrimaryMuscleGroupId,
    string PrimaryMuscleGroupName,
    string? SecondaryMuscleGroupName,
    string? Equipment,
    string? MovementPattern);

public sealed record AILatestExercisePerformanceModel(
    long ExerciseId,
    DateTime PerformedAt,
    decimal? WeightKg,
    IReadOnlyList<int> Reps);

public sealed record AIMatchingTemplateModel(long Id, string Name, int ExerciseCount);

public sealed record AIMuscleExposureModel(long MuscleGroupId, DateTime LastTrainedAt);
