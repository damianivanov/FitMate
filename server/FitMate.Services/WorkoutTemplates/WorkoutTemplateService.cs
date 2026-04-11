using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.WorkoutTemplates;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.WorkoutTemplates;

public class WorkoutTemplateService : IWorkoutTemplateService
{
    private readonly AppDbContext dbContext;

    public WorkoutTemplateService(
        AppDbContext dbContext)
    {
        this.dbContext = dbContext;
    }

    public async Task<IReadOnlyList<WorkoutTemplateModel>> ListAsync(long userId)
    {
        if (userId <= 0)
        {
            throw new FitMateException("Unauthorized.");
        }

        var templates = await dbContext.WorkoutTemplates
            .AsNoTracking()
            .Where(x => x.UserId == userId || x.IsPublic)
            .Include(x => x.ExerciseGroups)
                .ThenInclude(x => x.Exercises)
                    .ThenInclude(x => x.Exercise)
            .Include(x => x.ExerciseGroups)
                .ThenInclude(x => x.Exercises)
                    .ThenInclude(x => x.Sets)
            .OrderByDescending(x => x.DateCreated)
            .ThenByDescending(x => x.Id)
            .AsSplitQuery()
            .ToListAsync();

        return templates.Select(template => MapTemplate(template)).ToList();
    }

    public async Task<WorkoutTemplateModel> CreateAsync(
        CreateWorkoutTemplateRequest request,
        long userId)
    {
        if (userId <= 0)
        {
            throw new FitMateException("Unauthorized.");
        }

        var name = (request.Name ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new FitMateException("Template name is required.");
        }

        if (request.EstimatedDurationMinutes.HasValue && request.EstimatedDurationMinutes.Value <= 0)
        {
            throw new FitMateException("Estimated duration must be greater than zero.");
        }

        if (request.EstimatedDurationMinutes.HasValue && request.EstimatedDurationMinutes.Value > 600)
        {
            throw new FitMateException("Estimated duration cannot exceed 600 minutes.");
        }

        var exercises = request.Exercises ?? [];
        if (exercises.Count == 0)
        {
            throw new FitMateException("At least one template exercise is required.");
        }

        for (var exerciseIndex = 0; exerciseIndex < exercises.Count; exerciseIndex++)
        {
            var exerciseRequest = exercises[exerciseIndex];

            if (!Enum.IsDefined(exerciseRequest.GroupType))
            {
                throw new FitMateException($"Exercise #{exerciseIndex + 1} has an invalid group type.");
            }

            if (exerciseRequest.ExerciseId <= 0)
            {
                throw new FitMateException($"Exercise #{exerciseIndex + 1} has an invalid exercise id.");
            }

            var sets = exerciseRequest.Sets ?? [];
            if (sets.Count == 0)
            {
                throw new FitMateException($"Exercise #{exerciseIndex + 1} must include at least one set.");
            }

            for (var setIndex = 0; setIndex < sets.Count; setIndex++)
            {
                var validationError = ValidateSet(sets[setIndex]);
                if (validationError != null)
                {
                    throw new FitMateException($"Exercise #{exerciseIndex + 1}, set #{setIndex + 1}: {validationError}");
                }
            }
        }

        var existingExerciseIds = exercises
            .Select(x => x.ExerciseId)
            .ToList();

        if (existingExerciseIds.Distinct().Count() != existingExerciseIds.Count)
        {
            throw new FitMateException("Duplicate exercises are not supported in one template.");
        }

        var existingExercises = await dbContext.Exercises
            .AsNoTracking()
            .Where(x => existingExerciseIds.Contains(x.Id))
            .Select(x => new
            {
                x.Id,
                x.Name,
            })
            .ToListAsync();

        if (existingExercises.Count != existingExerciseIds.Count)
        {
            throw new FitMateException("One or more selected exercises do not exist.");
        }

        var exerciseNamesById = existingExercises
            .ToDictionary(x => x.Id, x => x.Name);

        var workoutTemplate = new WorkoutTemplate
        {
            UserId = userId,
            Name = name,
            Description = NormalizeNullable(request.Description),
            EstimatedDurationMinutes = request.EstimatedDurationMinutes,
            IsPublic = request.IsPublic,
        };
        TemplateExerciseGroup? activeGroup = null;
        ExerciseGroupType? activeGroupedType = null;
        var nextGroupSortOrder = 0;
        var exerciseOrderInActiveGroup = 0;

        TemplateExerciseGroup EnsureGroup(ExerciseGroupType groupType)
        {
            if (groupType == ExerciseGroupType.Straight)
            {
                var straightGroup = new TemplateExerciseGroup
                {
                    SortOrder = ++nextGroupSortOrder,
                    GroupType = ExerciseGroupType.Straight,
                    Rounds = 1,
                };

                workoutTemplate.ExerciseGroups.Add(straightGroup);
                activeGroup = straightGroup;
                activeGroupedType = null;
                exerciseOrderInActiveGroup = 0;
                return straightGroup;
            }

            if (activeGroup == null || activeGroupedType != groupType)
            {
                activeGroup = new TemplateExerciseGroup
                {
                    SortOrder = ++nextGroupSortOrder,
                    GroupType = groupType,
                    Rounds = 1,
                };

                workoutTemplate.ExerciseGroups.Add(activeGroup);
                activeGroupedType = groupType;
                exerciseOrderInActiveGroup = 0;
            }

            return activeGroup;
        }

        await using var transaction = await dbContext.Database.BeginTransactionAsync();

        try
        {
            for (var exerciseIndex = 0; exerciseIndex < exercises.Count; exerciseIndex++)
            {
                var exerciseRequest = exercises[exerciseIndex];
                var sets = exerciseRequest.Sets ?? [];
                var firstSet = sets[0];
                var group = EnsureGroup(exerciseRequest.GroupType);
                exerciseOrderInActiveGroup += 1;

                var templateExercise = new TemplateExercise
                {
                    ExerciseId = exerciseRequest.ExerciseId,
                    OrderIndex = exerciseOrderInActiveGroup,
                    TargetSets = sets.Count,
                    TargetReps = firstSet.Reps?.ToString(),
                    TargetWeightKg = NormalizeWeight(firstSet.WeightKg),
                    TargetRestSeconds = firstSet.RestSeconds,
                    Notes = NormalizeNullable(exerciseRequest.Notes),
                };

                for (var setIndex = 0; setIndex < sets.Count; setIndex++)
                {
                    var setRequest = sets[setIndex];
                    templateExercise.Sets.Add(new TemplateExerciseSet
                    {
                        OrderIndex = setIndex + 1,
                        WeightKg = NormalizeWeight(setRequest.WeightKg),
                        Reps = setRequest.Reps,
                        DurationSeconds = setRequest.DurationSeconds,
                        DistanceMeters = NormalizeDistance(setRequest.DistanceMeters),
                        Rpe = NormalizeRpe(setRequest.Rpe),
                        RestSeconds = setRequest.RestSeconds,
                        Notes = NormalizeNullable(setRequest.Notes),
                    });
                }

                group.Exercises.Add(templateExercise);

                if (exerciseRequest.GroupType == ExerciseGroupType.Straight)
                {
                    activeGroup = null;
                    activeGroupedType = null;
                }
            }

            dbContext.WorkoutTemplates.Add(workoutTemplate);
            await dbContext.SaveChangesAsync(userId);
            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }

        return MapTemplate(workoutTemplate, exerciseNamesById);
    }

    private static WorkoutTemplateModel MapTemplate(
        WorkoutTemplate template,
        IReadOnlyDictionary<long, string>? exerciseNamesById = null)
    {
        var groups = template.ExerciseGroups
            .OrderBy(x => x.SortOrder)
            .Select(group => new WorkoutTemplateExerciseGroupModel
            {
                Id = group.Id,
                SortOrder = group.SortOrder,
                GroupType = group.GroupType,
                RestBetweenExercisesSeconds = group.RestBetweenExercisesSeconds,
                RestAfterGroupSeconds = group.RestAfterGroupSeconds,
                Rounds = group.Rounds,
                Exercises = group.Exercises
                    .OrderBy(x => x.OrderIndex)
                    .Select(exercise =>
                    {
                        var exerciseName = exercise.Exercise?.Name ?? string.Empty;
                        if (string.IsNullOrWhiteSpace(exerciseName)
                            && exerciseNamesById != null
                            && exerciseNamesById.TryGetValue(exercise.ExerciseId, out var mappedExerciseName))
                        {
                            exerciseName = mappedExerciseName;
                        }

                        return new WorkoutTemplateExerciseModel
                        {
                            Id = exercise.Id,
                            ExerciseId = exercise.ExerciseId,
                            ExerciseName = exerciseName,
                            OrderIndex = exercise.OrderIndex,
                            TargetSets = exercise.TargetSets,
                            TargetReps = exercise.TargetReps,
                            TargetWeightKg = exercise.TargetWeightKg,
                            TargetRestSeconds = exercise.TargetRestSeconds,
                            Tempo = exercise.Tempo,
                            Notes = exercise.Notes,
                            Sets = exercise.Sets
                                .OrderBy(x => x.OrderIndex)
                                .Select(set => new WorkoutTemplateExerciseSetModel
                                {
                                    Id = set.Id,
                                    OrderIndex = set.OrderIndex,
                                    WeightKg = set.WeightKg,
                                    Reps = set.Reps,
                                    DurationSeconds = set.DurationSeconds,
                                    DistanceMeters = set.DistanceMeters,
                                    Rpe = set.Rpe,
                                    RestSeconds = set.RestSeconds,
                                    Notes = set.Notes,
                                })
                                .ToList(),
                        };
                    })
                    .ToList(),
            })
            .ToList();

        return new WorkoutTemplateModel
        {
            Id = template.Id,
            UserId = template.UserId,
            Name = template.Name,
            Description = template.Description,
            EstimatedDurationMinutes = template.EstimatedDurationMinutes,
            IsPublic = template.IsPublic,
            ExerciseCount = groups.Sum(x => x.Exercises.Count),
            SetCount = groups.Sum(x => x.Exercises.Sum(e => e.Sets.Count)),
            DateCreated = template.DateCreated,
            Groups = groups,
        };
    }

    private static string? ValidateSet(CreateWorkoutTemplateExerciseSetRequest request)
    {
        if (request.WeightKg.HasValue && request.WeightKg.Value < 0)
        {
            return "Weight cannot be negative.";
        }

        if (request.Reps.HasValue && request.Reps.Value <= 0)
        {
            return "Reps must be greater than zero.";
        }

        if (request.DurationSeconds.HasValue && request.DurationSeconds.Value <= 0)
        {
            return "Duration seconds must be greater than zero.";
        }

        if (request.DistanceMeters.HasValue && request.DistanceMeters.Value <= 0)
        {
            return "Distance meters must be greater than zero.";
        }

        if (request.Rpe.HasValue && (request.Rpe.Value < 0 || request.Rpe.Value > 10))
        {
            return "RPE must be between 0 and 10.";
        }

        if (request.RestSeconds.HasValue && request.RestSeconds.Value < 0)
        {
            return "Rest seconds cannot be negative.";
        }

        var hasMainMetric =
            request.WeightKg.HasValue
            || request.Reps.HasValue
            || request.DurationSeconds.HasValue
            || request.DistanceMeters.HasValue;

        if (!hasMainMetric)
        {
            return "Set must include at least one metric (weight/reps/duration/distance).";
        }

        return null;
    }

    private static decimal? NormalizeWeight(decimal? value)
    {
        return value.HasValue
            ? Math.Round(value.Value, 2, MidpointRounding.AwayFromZero)
            : null;
    }

    private static decimal? NormalizeDistance(decimal? value)
    {
        return value.HasValue
            ? Math.Round(value.Value, 2, MidpointRounding.AwayFromZero)
            : null;
    }

    private static decimal? NormalizeRpe(decimal? value)
    {
        return value.HasValue
            ? Math.Round(value.Value, 1, MidpointRounding.AwayFromZero)
            : null;
    }

    private static string? NormalizeNullable(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }
}
