namespace FitMate.Core.JsonModels.AIActions;

public class MergeAIActionRequest
{
    /// <summary>The unfinished workout the suggestion should be added to.</summary>
    public long WorkoutId { get; set; }
}
