namespace FitMate.Core.JsonModels.Analytics;

public class MuscleGroupVolumeModel
{
    public long MuscleGroupId { get; set; }
    public string MuscleGroupName { get; set; } = string.Empty;
    public decimal TotalVolumeKg { get; set; }
    public int SetCount { get; set; }
}
