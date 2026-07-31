using FitMate.Core.JsonModels.AIActions;

namespace FitMate.Services.AIActions;

/// <summary>
/// Range checks for proposed workouts, templates and exercises. Deliberately pure so it can run
/// unchanged at proposal time and again at confirmation time (spec §7.5: the payload is a
/// proposal, not trusted input).
/// </summary>
public static class AIProposalValidator
{
    private const int MaxExercisesPerSession = 20;
    private const int MaxSetsPerExercise = 15;
    private const int MaxReps = 100;
    private const decimal MaxWeightKg = 1000m;
    private const int MaxRestSeconds = 600;

    /// <summary>Rough session-length estimate used for the "this looks long" warning.</summary>
    private const int SecondsPerSet = 45;

    public static List<string> ValidateExercise(ProposeExercisePayload payload)
    {
        var errors = new List<string>();

        if (string.IsNullOrWhiteSpace(payload.Name))
        {
            errors.Add("The exercise needs a name.");
        }
        else if (payload.Name.Trim().Length > 200)
        {
            errors.Add("The exercise name is too long.");
        }

        if (payload.PrimaryMuscleGroupId <= 0)
        {
            errors.Add("A primary muscle group is required.");
        }

        if (payload.SecondaryMuscleGroupId is <= 0)
        {
            errors.Add("The secondary muscle group is invalid.");
        }

        if (payload.SecondaryMuscleGroupId == payload.PrimaryMuscleGroupId)
        {
            errors.Add("The secondary muscle group must differ from the primary one.");
        }

        if (payload.Aliases.Count > 10)
        {
            errors.Add("At most 10 aliases are allowed.");
        }

        return errors;
    }

    /// <summary>
    /// Shared by propose_workout and propose_workout_template: both carry the same exercise shape.
    /// <paramref name="visibleExerciseIds"/> is what the user is actually allowed to reference.
    /// </summary>
    public static List<string> ValidateExercises(
        IReadOnlyList<ProposedExercise> exercises,
        IReadOnlyCollection<long> visibleExerciseIds)
    {
        var errors = new List<string>();

        if (exercises.Count == 0)
        {
            errors.Add("At least one exercise is required.");
            return errors;
        }

        if (exercises.Count > MaxExercisesPerSession)
        {
            errors.Add($"At most {MaxExercisesPerSession} exercises are allowed.");
        }

        var duplicateIds = exercises
            .GroupBy(x => x.ExerciseId)
            .Where(group => group.Count() > 1)
            .Select(group => group.Key)
            .ToList();

        if (duplicateIds.Count > 0)
        {
            errors.Add($"Exercise {string.Join(", ", duplicateIds)} appears more than once.");
        }

        foreach (var exercise in exercises)
        {
            if (!visibleExerciseIds.Contains(exercise.ExerciseId))
            {
                errors.Add($"Exercise {exercise.ExerciseId} does not exist or is not available to you.");
                continue;
            }

            if (exercise.Sets.Count == 0)
            {
                errors.Add($"Exercise {exercise.ExerciseId} has no sets.");
                continue;
            }

            if (exercise.Sets.Count > MaxSetsPerExercise)
            {
                errors.Add($"Exercise {exercise.ExerciseId} has more than {MaxSetsPerExercise} sets.");
            }

            foreach (var set in exercise.Sets)
            {
                if (set.Reps is < 1 or > MaxReps)
                {
                    errors.Add($"Exercise {exercise.ExerciseId} has a set with an invalid rep count.");
                    break;
                }

                if (set.WeightKg is < 0 or > MaxWeightKg)
                {
                    errors.Add($"Exercise {exercise.ExerciseId} has a set with an invalid weight.");
                    break;
                }

                if (set.Rpe is < 1 or > 10)
                {
                    errors.Add($"Exercise {exercise.ExerciseId} has a set with an RPE outside 1-10.");
                    break;
                }

                if (set.RestSeconds is < 0 or > MaxRestSeconds)
                {
                    errors.Add($"Exercise {exercise.ExerciseId} has a set with an invalid rest time.");
                    break;
                }
            }
        }

        return errors;
    }

    public static int EstimateDurationMinutes(IReadOnlyList<ProposedExercise> exercises)
    {
        var totalSets = exercises.Sum(x => x.Sets.Count);
        var restSeconds = exercises
            .SelectMany(x => x.Sets)
            .Sum(set => set.RestSeconds ?? 90);

        return (int)Math.Ceiling((totalSets * SecondsPerSet + restSeconds) / 60d);
    }
}
