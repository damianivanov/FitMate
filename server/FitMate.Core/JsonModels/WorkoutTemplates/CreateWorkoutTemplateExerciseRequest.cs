using System.ComponentModel.DataAnnotations;
using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.WorkoutTemplates;

public class CreateWorkoutTemplateExerciseRequest
{
    public ExerciseGroupType GroupType { get; set; } = ExerciseGroupType.Straight;
    public int? ClientGroupId { get; set; }

    [Range(1, long.MaxValue)]
    public long ExerciseId { get; set; }

    [StringLength(2000)]
    public string? Notes { get; set; }
    public List<CreateWorkoutTemplateExerciseSetRequest> Sets { get; set; } = [];
}
