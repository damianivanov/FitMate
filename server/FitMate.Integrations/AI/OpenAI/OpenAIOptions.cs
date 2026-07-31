namespace FitMate.Integrations.AI.OpenAI;

public class OpenAIOptions
{
    public const string SectionName = "OpenAI";

    /// <summary>Never committed: supplied through environment variables or user secrets.</summary>
    public string ApiKey { get; set; } = string.Empty;

    /// <summary>Optional override for Azure OpenAI or a compatible gateway.</summary>
    public string? Endpoint { get; set; }

    public bool IsConfigured => !string.IsNullOrWhiteSpace(ApiKey);
}
