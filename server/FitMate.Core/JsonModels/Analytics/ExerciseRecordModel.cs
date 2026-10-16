namespace FitMate.Core.JsonModels.Analytics;

/// <summary>
/// One personal best. <see cref="Value"/> is the record's own metric (kg, e1RM, reps or session
/// volume); <see cref="WeightKg"/> and <see cref="Reps"/> describe the set that produced it and are
/// empty for a session-volume record.
/// </summary>
public class ExerciseRecordModel
{
    public long WorkoutId { get; set; }
    public DateTime AchievedOn { get; set; }
    public decimal Value { get; set; }
    public decimal? WeightKg { get; set; }
    public int? Reps { get; set; }
}
