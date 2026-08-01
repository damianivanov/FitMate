namespace FitMate.Core.JsonModels.AdminAI;

public class AISettingsModel
{
    public string Provider { get; set; } = string.Empty;
    public string DefaultModel { get; set; } = string.Empty;
    public string FastModel { get; set; } = string.Empty;
    public string ReasoningModel { get; set; } = string.Empty;
    public string VisionModel { get; set; } = string.Empty;
    public string ImageModel { get; set; } = string.Empty;

    public int TimeoutSeconds { get; set; }
    public int MaximumToolIterations { get; set; }
    public int MaximumToolCallsPerRun { get; set; }
    public int MaximumConversationMessages { get; set; }
    public int MaximumContextTokens { get; set; }
    public int MaximumOutputTokens { get; set; }
    public int MaximumMessageCharacters { get; set; }
    public bool StoreRawProviderPayload { get; set; }

    /// <summary>False while the app is still running on the appsettings defaults.</summary>
    public bool IsStored { get; set; }
}

public class SaveAISettingsRequest
{
    public string DefaultModel { get; set; } = string.Empty;
    public string FastModel { get; set; } = string.Empty;
    public string ReasoningModel { get; set; } = string.Empty;
    public string VisionModel { get; set; } = string.Empty;
    public string ImageModel { get; set; } = string.Empty;

    public int TimeoutSeconds { get; set; }
    public int MaximumToolIterations { get; set; }
    public int MaximumToolCallsPerRun { get; set; }
    public int MaximumConversationMessages { get; set; }
    public int MaximumContextTokens { get; set; }
    public int MaximumOutputTokens { get; set; }
    public int MaximumMessageCharacters { get; set; }
    public bool StoreRawProviderPayload { get; set; }
}
