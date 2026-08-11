using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;

namespace FitMate.Tests.TestInfrastructure;

/// <summary>Builds workout/exercise graphs for tests that need volume rather than realism.</summary>
public static class WorkoutSeed
{
    private static readonly DateTime Origin = new(2026, 1, 1, 8, 0, 0, DateTimeKind.Utc);

    public static async Task<List<long>> AddExercisesAsync(
        AppDbContext context,
        int count,
        long muscleGroupId,
        string namePrefix = "Exercise")
    {
        var exercises = Enumerable.Range(1, count)
            .Select(index => new Exercise
            {
                Name = $"{namePrefix} {index:D4}",
                Slug = $"{namePrefix.ToLowerInvariant()}-{index:D4}",
                IsPublic = true,
                PrimaryMuscleGroupId = muscleGroupId,
                ImageUrl = "https://example.test/image.png",
                VideoUrl = "https://example.test/video.mp4",
            })
            .ToList();

        context.Exercises.AddRange(exercises);
        await context.SaveChangesAsync();

        return exercises.Select(x => x.Id).ToList();
    }

    /// <summary>One workout per index, newest last, each logging the supplied exercise once.</summary>
    public static async Task AddWorkoutsAsync(
        AppDbContext context,
        long userId,
        int count,
        long? exerciseId = null)
    {
        var targetExerciseId = exerciseId
            ?? (await AddExercisesAsync(context, 1, SqliteTestDatabase.ChestId, "Seeded"))[0];

        for (var index = 0; index < count; index++)
        {
            await AddWorkoutAsync(context, userId, targetExerciseId, Origin.AddDays(index));
        }
    }

    /// <summary>The same exercise logged across several sessions, so "latest" is unambiguous.</summary>
    public static async Task<long> AddExerciseWithHistoryAsync(AppDbContext context, long userId, int sessions)
    {
        var exerciseId = (await AddExercisesAsync(context, 1, SqliteTestDatabase.ChestId, "History"))[0];

        for (var index = 0; index < sessions; index++)
        {
            await AddWorkoutAsync(
                context,
                userId,
                exerciseId,
                Origin.AddDays(index),
                weightKg: 60 + index,
                reps: 8 + index);
        }

        return exerciseId;
    }

    public static async Task<long> AddWorkoutAsync(
        AppDbContext context,
        long userId,
        long exerciseId,
        DateTime startedAt,
        decimal weightKg = 50,
        int reps = 10)
    {
        var workout = new Workout
        {
            UserId = userId,
            Title = $"Workout {startedAt:yyyy-MM-dd}",
            StartedAt = startedAt,
            FinishedAt = startedAt.AddHours(1),
            DurationSeconds = 3600,
            TotalVolumeKg = weightKg * reps,
        };

        context.Workouts.Add(workout);
        await context.SaveChangesAsync();

        var group = new WorkoutExerciseGroup
        {
            WorkoutId = workout.Id,
            SortOrder = 0,
            GroupType = ExerciseGroupType.Straight,
        };

        context.WorkoutExerciseGroups.Add(group);
        await context.SaveChangesAsync();

        var workoutExercise = new WorkoutExercise
        {
            WorkoutExerciseGroupId = group.Id,
            ExerciseId = exerciseId,
            OrderIndex = 0,
        };

        context.WorkoutExercises.Add(workoutExercise);
        await context.SaveChangesAsync();

        context.ExerciseSets.Add(new ExerciseSet
        {
            WorkoutExerciseId = workoutExercise.Id,
            OrderIndex = 0,
            SetType = ExerciseSetType.Working,
            WeightKg = weightKg,
            Reps = reps,
            IsCompleted = true,
        });

        await context.SaveChangesAsync();
        return workout.Id;
    }

    public static async Task<long> AddTemplateAsync(
        AppDbContext context,
        long? userId,
        long exerciseId,
        string name = "Template")
    {
        var template = new WorkoutTemplate
        {
            UserId = userId,
            Name = name,
            IsPublic = userId == null,
        };

        context.WorkoutTemplates.Add(template);
        await context.SaveChangesAsync();

        var group = new TemplateExerciseGroup
        {
            WorkoutTemplateId = template.Id,
            SortOrder = 0,
            GroupType = ExerciseGroupType.Straight,
        };

        context.TemplateExerciseGroups.Add(group);
        await context.SaveChangesAsync();

        context.TemplateExercises.Add(new TemplateExercise
        {
            TemplateExerciseGroupId = group.Id,
            ExerciseId = exerciseId,
            OrderIndex = 0,
            TargetSets = 3,
        });

        await context.SaveChangesAsync();
        return template.Id;
    }
}
