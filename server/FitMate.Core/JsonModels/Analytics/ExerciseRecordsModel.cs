namespace FitMate.Core.JsonModels.Analytics;

public class ExerciseRecordsModel
{
    public ExerciseRecordModel? HeaviestWeight { get; set; }
    public ExerciseRecordModel? BestEstimatedOneRepMax { get; set; }
    public ExerciseRecordModel? MostReps { get; set; }
    public ExerciseRecordModel? BestSessionVolume { get; set; }
}
