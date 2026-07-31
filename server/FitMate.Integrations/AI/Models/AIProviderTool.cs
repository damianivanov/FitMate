namespace FitMate.Integrations.AI.Models;

public class AIProviderTool
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string ParametersJsonSchema { get; set; } = """{"type":"object","properties":{}}""";
}
