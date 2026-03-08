using FitMate.DB.Entities.Base;
using FitMate.DB.Enums;

namespace FitMate.DB.Entities;

public class WorkoutExerciseGroup : BaseEntity
{
    public long WorkoutId { get; set; }
    public int SortOrder { get; set; }
    public ExerciseGroupType GroupType { get; set; } = ExerciseGroupType.Straight;

    public Workout Workout { get; set; } = null!;
    public ICollection<WorkoutExercise> Exercises { get; set; } = [];
}
