using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.Exercises;

public class ExerciseLookupModel
{
    public long Id { get; set; }
    public long? UserId { get; set; }
    public bool IsGlobal { get; set; }
    public bool IsPublic { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public string? VideoUrl { get; set; }
    public long PrimaryMuscleGroupId { get; set; }
    public string PrimaryMuscleGroupName { get; set; } = string.Empty;
    public long? SecondaryMuscleGroupId { get; set; }
    public string? SecondaryMuscleGroupName { get; set; }
    public ExerciseEquipment? Equipment { get; set; }
    public ExerciseMovementPattern? MovementPattern { get; set; }
    public ExerciseDifficulty? Difficulty { get; set; }
    public ExerciseCategory? Category { get; set; }
    public List<string> Aliases { get; set; } = [];
    public long? CreatorUserId { get; set; }
    public string? CreatorDisplayName { get; set; }
    public DateTime DateCreated { get; set; }
}
