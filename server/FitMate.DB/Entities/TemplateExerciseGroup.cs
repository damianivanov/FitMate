using FitMate.DB.Entities.Base;
using FitMate.DB.Enums;

namespace FitMate.DB.Entities;

public class TemplateExerciseGroup : BaseEntity
{
    public long WorkoutTemplateId { get; set; }
    public int SortOrder { get; set; }
    public ExerciseGroupType GroupType { get; set; } = ExerciseGroupType.Straight;
    public int? RestBetweenExercisesSeconds { get; set; }
    public int? RestAfterGroupSeconds { get; set; }
    public int Rounds { get; set; } = 1;

    public WorkoutTemplate WorkoutTemplate { get; set; } = null!;
    public ICollection<TemplateExercise> Exercises { get; set; } = [];
}
