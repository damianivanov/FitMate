using FitMate.DB.Entities.Base;

namespace FitMate.DB.Entities;

public class ExerciseAlias : BaseEntity
{
    public long ExerciseId { get; set; }
    public string Alias { get; set; } = string.Empty;
    public string NormalizedAlias { get; set; } = string.Empty;

    public Exercise Exercise { get; set; } = null!;
}
