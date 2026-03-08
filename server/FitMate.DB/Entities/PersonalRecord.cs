using FitMate.DB.Entities.Base;
using FitMate.DB.Enums;

namespace FitMate.DB.Entities;

public class PersonalRecord : BaseEntity
{
    public long UserId { get; set; }
    public long ExerciseId { get; set; }
    public PersonalRecordType RecordType { get; set; }
    public decimal Value { get; set; }
    public long? ExerciseSetId { get; set; }
    public DateOnly AchievedOn { get; set; }
    public bool IsCurrent { get; set; }

    public User User { get; set; } = null!;
    public Exercise Exercise { get; set; } = null!;
    public ExerciseSet? ExerciseSet { get; set; }
}
