using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.Workouts;

public class WorkoutExerciseGroupModel
{
    public long Id { get; set; }
    public int SortOrder { get; set; }
    public ExerciseGroupType GroupType { get; set; }
    public List<WorkoutExerciseModel> Exercises { get; set; } = [];
}
