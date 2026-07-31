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
    public int MaximumConversationMessages { get; set; } = 30;
    public bool StoreRawProviderPayload { get; set; }
    public AIRetentionOptions Retention { get; set; } = new();
}
