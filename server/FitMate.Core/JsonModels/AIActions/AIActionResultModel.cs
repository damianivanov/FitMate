namespace FitMate.Core.JsonModels.AIActions;

/// <summary>What confirming actually produced, so the card can link to it.</summary>
public class AIActionResultModel
{
    public long CreatedEntityId { get; set; }
    public string? CreatedEntityName { get; set; }

    /// <summary>Client-side route fragment, e.g. "templates" or "workouts".</summary>
    public string? EntityKind { get; set; }
}
