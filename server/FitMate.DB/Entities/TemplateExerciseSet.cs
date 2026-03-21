using FitMate.DB.Entities.Base;

namespace FitMate.DB.Entities;

public class TemplateExerciseSet : BaseEntity
{
    public long TemplateExerciseId { get; set; }
    public int OrderIndex { get; set; }
    public decimal? WeightKg { get; set; }
    public int? Reps { get; set; }
    public int? DurationSeconds { get; set; }
    public decimal? DistanceMeters { get; set; }
    public decimal? Rpe { get; set; }
    public int? RestSeconds { get; set; }
    public string? Notes { get; set; }

    public TemplateExercise TemplateExercise { get; set; } = null!;
}
