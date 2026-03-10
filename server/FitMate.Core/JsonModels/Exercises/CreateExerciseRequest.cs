namespace FitMate.Core.JsonModels.Exercises;

public class CreateExerciseRequest
{
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public string? VideoUrl { get; set; }
    public long PrimaryMuscleGroupId { get; set; }
    public long? SecondaryMuscleGroupId { get; set; }
}
