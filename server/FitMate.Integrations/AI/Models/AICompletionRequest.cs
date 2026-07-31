namespace FitMate.Integrations.AI.Models;

public class AICompletionRequest
{
    public List<AIProviderMessage> Messages { get; set; } = [];
    public List<AIProviderTool> Tools { get; set; } = [];
    public string Model { get; set; } = string.Empty;
    public int? MaxOutputTokens { get; set; }
    public float? Temperature { get; set; }
}
