namespace FitMate.Services.AI.Tools;

/// <summary>What the model sees about a tool: its name, purpose and argument schema.</summary>
public class AIToolDefinition
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string ParametersJsonSchema { get; set; } = """{"type":"object","properties":{}}""";
}
