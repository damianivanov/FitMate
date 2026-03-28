using FitMate.Core.JsonModels.Exercises;
using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.WorkoutTemplates;

public class CreateWorkoutTemplateExerciseRequest
{
    public ExerciseGroupType GroupType { get; set; } = ExerciseGroupType.Straight;
    public long? ExerciseId { get; set; }
    public CreateExerciseRequest? CreateExercise { get; set; }
    public string? Notes { get; set; }
    public List<CreateWorkoutTemplateExerciseSetRequest> Sets { get; set; } = [];
}
