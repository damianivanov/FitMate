namespace FitMate.Services.AI.Context;

/// <summary>
/// Bounded reads for AI context. Every method applies its ordering and limit in SQL, so cost tracks
/// the size of the answer rather than the size of the user's training history.
/// </summary>
public interface IAITrainingContextQuery
{
    Task<IReadOnlyList<AIRecentWorkoutModel>> GetRecentWorkoutsAsync(
        long userId, int take, CancellationToken cancellationToken);

    Task<IReadOnlyList<AIExerciseCandidateModel>> GetExerciseCandidatesAsync(
        long userId, IReadOnlyCollection<long> muscleGroupIds, int take, CancellationToken cancellationToken);

    Task<IReadOnlyDictionary<long, AILatestExercisePerformanceModel>> GetLatestPerformanceAsync(
        long userId, IReadOnlyCollection<long> exerciseIds, CancellationToken cancellationToken);

    Task<IReadOnlyList<AIMatchingTemplateModel>> GetMatchingTemplatesAsync(
        long userId, IReadOnlyCollection<long> exerciseIds, int take, CancellationToken cancellationToken);

    Task<IReadOnlyList<AIMuscleExposureModel>> GetRecentMuscleExposureAsync(
        long userId, IReadOnlyCollection<long> muscleGroupIds, int workoutsToScan, CancellationToken cancellationToken);
}
