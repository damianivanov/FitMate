using System.ComponentModel.DataAnnotations;
using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.Workouts;

public class CreateWorkoutExerciseRequest
{
    public ExerciseGroupType GroupType { get; set; } = ExerciseGroupType.Straight;
    public int? ClientGroupId { get; set; }
    public int OrderIndex { get; set; }

    [Range(1, long.MaxValue)]
    public long ExerciseId { get; set; }

    [StringLength(2000)]
    public string? Notes { get; set; }
    public List<CreateWorkoutSetRequest> Sets { get; set; } = [];
}
