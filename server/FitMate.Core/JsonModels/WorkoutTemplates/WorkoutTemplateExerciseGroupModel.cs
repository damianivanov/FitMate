using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.WorkoutTemplates;

public class WorkoutTemplateExerciseGroupModel
{
    public long Id { get; set; }
    public int SortOrder { get; set; }
    public ExerciseGroupType GroupType { get; set; } = ExerciseGroupType.Straight;
    public int? RestBetweenExercisesSeconds { get; set; }
    public int? RestAfterGroupSeconds { get; set; }
    public int Rounds { get; set; }
    public List<WorkoutTemplateExerciseModel> Exercises { get; set; } = [];
}
