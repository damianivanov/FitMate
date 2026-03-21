using FitMate.DB.Entities.Base;

namespace FitMate.DB.Entities;

public class WorkoutExercise : BaseEntity
{
    public long WorkoutExerciseGroupId { get; set; }
    public long ExerciseId { get; set; }
    public int OrderIndex { get; set; }
    public string? Notes { get; set; }

    public WorkoutExerciseGroup WorkoutExerciseGroup { get; set; } = null!;
    public Exercise Exercise { get; set; } = null!;
    public ICollection<ExerciseSet> Sets { get; set; } = [];
}
