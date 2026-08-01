using FitMate.DB.Entities.Base;

namespace FitMate.DB.Entities;

/// <summary>
/// Single-row global AI configuration. Absent row means the appsettings values still apply, so the
/// app runs unconfigured. Provider is deliberately not here: it selects which adapter is registered
/// at startup and cannot be changed without a restart.
/// </summary>
public class AISettings : BaseEntity
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

    /// <summary>Ceiling for conversation history sent per request. No plan may exceed it.</summary>
    public int MaximumContextTokens { get; set; }

    public int MaximumOutputTokens { get; set; }
    public int MaximumMessageCharacters { get; set; }

    public bool StoreRawProviderPayload { get; set; }
}
