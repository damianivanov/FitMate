using System.ComponentModel.DataAnnotations;
using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.WorkoutTemplates;

public class CreateWorkoutTemplateExerciseSetRequest
{
    public ExerciseSetType SetType { get; set; } = ExerciseSetType.Working;
    public decimal? WeightKg { get; set; }
    public int? Reps { get; set; }
    public int? DurationSeconds { get; set; }
    public decimal? DistanceMeters { get; set; }

    [Range(0, 10)]
    public decimal? Rpe { get; set; }

    [Range(0, int.MaxValue)]
    public int? RestSeconds { get; set; }

    [StringLength(2000)]
    public string? Notes { get; set; }
}
