using FitMate.DB.Entities.Base;

namespace FitMate.DB.Entities;

public class MuscleGroup : BaseEntity
{
    public string Name { get; set; } = string.Empty;

    public ICollection<Exercise> PrimaryExercises { get; set; } = [];
    public ICollection<Exercise> SecondaryExercises { get; set; } = [];
}
