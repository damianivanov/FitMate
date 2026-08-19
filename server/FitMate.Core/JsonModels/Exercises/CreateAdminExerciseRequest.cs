using System.ComponentModel.DataAnnotations;
using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.Exercises;

/// <summary>
/// Admin-side exercise creation. Scope is explicit rather than inferred from the caller's role:
/// leaving <see cref="IsPrivate"/> off adds the exercise to the shared catalogue (global, visible to
/// everyone); turning it on keeps the exercise private to the administrator's own account.
/// </summary>
public class CreateAdminExerciseRequest
{
    [Required]
    [StringLength(200)]
    public string Name { get; set; } = string.Empty;

    [StringLength(2000)]
    public string? Description { get; set; }

    [StringLength(2048)]
    public string? VideoUrl { get; set; }

    [Range(1, long.MaxValue)]
    public long PrimaryMuscleGroupId { get; set; }

    public long? SecondaryMuscleGroupId { get; set; }
    public ExerciseEquipment? Equipment { get; set; }
    public ExerciseMovementPattern? MovementPattern { get; set; }
    public ExerciseDifficulty? Difficulty { get; set; }
    public ExerciseCategory? Category { get; set; }
    public ExerciseLoadBasis? LoadBasis { get; set; }
    public List<string>? Aliases { get; set; }

    /// <summary>
    /// When false (the default) the exercise is created globally and is visible to every user.
    /// </summary>
    public bool IsPrivate { get; set; }

    public CreateExerciseRequest ToExerciseRequest(bool isPublic) => new()
    {
        Name = Name,
        Description = Description,
        VideoUrl = VideoUrl,
        PrimaryMuscleGroupId = PrimaryMuscleGroupId,
        SecondaryMuscleGroupId = SecondaryMuscleGroupId,
        Equipment = Equipment,
        MovementPattern = MovementPattern,
        Difficulty = Difficulty,
        Category = Category,
        LoadBasis = LoadBasis,
        Aliases = Aliases,
        IsPublic = isPublic,
    };
}
