using FitMate.DB.Entities.Base;

namespace FitMate.DB.Entities;

public class TemplateExercise : BaseEntity
{
    public long TemplateExerciseGroupId { get; set; }
    public long ExerciseId { get; set; }
    public int SortOrderInGroup { get; set; }
    public int TargetSets { get; set; }
    public string? TargetReps { get; set; }
    public decimal? TargetWeightKg { get; set; }
    public int? TargetRestSeconds { get; set; }
    public string? Tempo { get; set; }
    public string? Notes { get; set; }

    public TemplateExerciseGroup TemplateExerciseGroup { get; set; } = null!;
    public Exercise Exercise { get; set; } = null!;
}
