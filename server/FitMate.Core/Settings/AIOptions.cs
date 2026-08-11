namespace FitMate.Core.Settings;

public class AIOptions
{
    public const string SectionName = "AI";

    public string Provider { get; set; } = "OpenAI";
    public string DefaultModel { get; set; } = string.Empty;
    public string FastModel { get; set; } = string.Empty;
    public string ReasoningModel { get; set; } = string.Empty;
    public string VisionModel { get; set; } = string.Empty;
    public string ImageModel { get; set; } = string.Empty;
    public int TimeoutSeconds { get; set; } = 90;
    public int MaximumToolIterations { get; set; } = 6;
    public int MaximumToolCallsPerRun { get; set; } = 12;
    /// <summary>
    /// Global ceiling on replayed conversation messages. Plans ask for less, never more, so this
    /// must not sit below the highest plan value or it silently caps it.
    /// </summary>
    public int MaximumConversationMessages { get; set; } = 50;
    public bool StoreRawProviderPayload { get; set; }
    public AIRetentionOptions Retention { get; set; } = new();
}
