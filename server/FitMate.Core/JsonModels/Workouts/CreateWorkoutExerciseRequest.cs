using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.Workouts;

public class CreateWorkoutExerciseRequest
{
    public ExerciseGroupType GroupType { get; set; } = ExerciseGroupType.Straight;
    public int? ClientGroupId { get; set; }
    public int OrderIndex { get; set; }
    public long ExerciseId { get; set; }
    public string? Notes { get; set; }
    public List<CreateWorkoutSetRequest> Sets { get; set; } = [];
}
