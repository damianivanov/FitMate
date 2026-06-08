using FitMate.DB.Entities.Base;

namespace FitMate.DB.Entities;

public class Exercise : BaseEntity
{
    public long? UserId { get; set; }
    public bool IsPublic { get; set; } = true;
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public string? VideoUrl { get; set; }
    public long PrimaryMuscleGroupId { get; set; }
    public long? SecondaryMuscleGroupId { get; set; }

    public User? User { get; set; }
    public MuscleGroup PrimaryMuscleGroup { get; set; } = null!;
    public MuscleGroup? SecondaryMuscleGroup { get; set; }
    public ICollection<TemplateExercise> TemplateExercises { get; set; } = [];
    public ICollection<WorkoutExercise> WorkoutExercises { get; set; } = [];
    public ICollection<PersonalRecord> PersonalRecords { get; set; } = [];
}
