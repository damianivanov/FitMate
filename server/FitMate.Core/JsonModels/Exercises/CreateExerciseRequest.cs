using System.ComponentModel.DataAnnotations;
using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.Exercises;

public class CreateExerciseRequest
{
    [Required]
    [StringLength(200)]
    public string Name { get; set; } = string.Empty;

    [StringLength(200)]
    public string Slug { get; set; } = string.Empty;

    [StringLength(2000)]
    public string? Description { get; set; }

    [StringLength(2048)]
    public string? ImageUrl { get; set; }

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
    public bool IsPublic { get; set; } = true;
}
