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

        var groupTypeByClientGroupId = new Dictionary<int, ExerciseGroupType>();
        var closedClientGroupIds = new HashSet<int>();
        int? activeClientGroupId = null;
        var validationExerciseIndex = 0;
        foreach (var exerciseRequest in exercises)
        {
            if (!Enum.IsDefined(exerciseRequest.GroupType))
            {
                throw new FitMateException($"Exercise #{validationExerciseIndex + 1} has an invalid group type.");
            }

            if (exerciseRequest.ExerciseId <= 0)
            {
                throw new FitMateException($"Exercise #{validationExerciseIndex + 1} has an invalid exercise id.");
            }

            if (exerciseRequest.GroupType == ExerciseGroupType.Straight)
            {
                if (activeClientGroupId.HasValue)
                {
                    closedClientGroupIds.Add(activeClientGroupId.Value);
                    activeClientGroupId = null;
                }
            }
            else
            {
                if (!exerciseRequest.ClientGroupId.HasValue || exerciseRequest.ClientGroupId.Value == 0)
                {
                    throw new FitMateException($"Exercise #{validationExerciseIndex + 1} must include a client group id.");
                }

                var clientGroupId = exerciseRequest.ClientGroupId.Value;
                if (
                    groupTypeByClientGroupId.TryGetValue(clientGroupId, out var existingGroupType)
                    && existingGroupType != exerciseRequest.GroupType)
                {
                    throw new FitMateException($"Client group id {clientGroupId} cannot mix group types.");
                }

                groupTypeByClientGroupId.TryAdd(clientGroupId, exerciseRequest.GroupType);

                if (activeClientGroupId != clientGroupId)
                {
                    if (activeClientGroupId.HasValue)
                    {
                        closedClientGroupIds.Add(activeClientGroupId.Value);
                    }

                    if (closedClientGroupIds.Contains(clientGroupId))
                    {
                        throw new FitMateException($"Client group id {clientGroupId} must be contiguous.");
                    }

                    activeClientGroupId = clientGroupId;
                }
            }

            var sets = exerciseRequest.Sets ?? [];
            if (sets.Count == 0)
            {
                throw new FitMateException($"Exercise #{validationExerciseIndex + 1} must include at least one set.");
            }

            var setIndex = 0;
            foreach (var setRequest in sets)
            {
                var validationError = ValidateSet(setRequest);
                if (validationError != null)
                {
                    throw new FitMateException($"Exercise #{validationExerciseIndex + 1}, set #{setIndex + 1}: {validationError}");
                }

                setIndex++;
            }

            validationExerciseIndex++;
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
            Description = string.IsNullOrWhiteSpace(request.Description)
                ? null
                : request.Description.Trim(),
            EstimatedDurationMinutes = request.EstimatedDurationMinutes,
            IsPublic = request.IsPublic,
        };
        var groupsByClientGroupId = new Dictionary<int, TemplateExerciseGroup>();
        var nextGroupSortOrder = 0;

        TemplateExerciseGroup CreateGroup(ExerciseGroupType groupType)
        {
            var group = new TemplateExerciseGroup
            {
                SortOrder = ++nextGroupSortOrder,
                GroupType = groupType,
                Rounds = 1,
            };

            workoutTemplate.ExerciseGroups.Add(group);
            return group;
        }

        TemplateExerciseGroup ResolveGroup(CreateWorkoutTemplateExerciseRequest exerciseRequest)
        {
            if (exerciseRequest.GroupType == ExerciseGroupType.Straight)
            {
                return CreateGroup(ExerciseGroupType.Straight);
            }

            var clientGroupId = exerciseRequest.ClientGroupId!.Value;
            if (!groupsByClientGroupId.TryGetValue(clientGroupId, out var group))
            {
                group = CreateGroup(exerciseRequest.GroupType);
                groupsByClientGroupId.Add(clientGroupId, group);
            }

            return group;
        }

        await using var transaction = await dbContext.Database.BeginTransactionAsync();

        try
        {
            for (var exerciseIndex = 0; exerciseIndex < exercises.Count; exerciseIndex++)
            {
                var exerciseRequest = exercises[exerciseIndex];
                var sets = exerciseRequest.Sets ?? [];
                var firstSet = sets[0];
                var group = ResolveGroup(exerciseRequest);
                var exerciseOrderIndex = exerciseIndex + 1;

                var templateExercise = new TemplateExercise
                {
                    ExerciseId = exerciseRequest.ExerciseId,
                    OrderIndex = exerciseOrderIndex,
                    TargetSets = sets.Count,
                    TargetReps = firstSet.Reps?.ToString(),
                    TargetWeightKg = NormalizeWeight(firstSet.WeightKg),
                    TargetRestSeconds = firstSet.RestSeconds,
                    Notes = string.IsNullOrWhiteSpace(exerciseRequest.Notes)
                        ? null
                        : exerciseRequest.Notes.Trim(),
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
                        Notes = string.IsNullOrWhiteSpace(setRequest.Notes)
                            ? null
                            : setRequest.Notes.Trim(),
                    });
                }

                group.Exercises.Add(templateExercise);
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

}
