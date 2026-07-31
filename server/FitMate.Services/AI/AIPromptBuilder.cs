using System.Reflection;

namespace FitMate.Services.AI;

public class AIPromptBuilder : IAIPromptBuilder
{
    private static readonly Lazy<string> SystemPrompt = new(LoadSystemPrompt);

    public string SystemPromptVersion => "system-v1";

    public string BuildSystemPrompt() => SystemPrompt.Value;

    private static string LoadSystemPrompt()
    {
        var assemblyDirectory = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location)
            ?? AppContext.BaseDirectory;
        var path = Path.Combine(assemblyDirectory, "AI", "Prompts", "system-v1.txt");

        return File.Exists(path)
            ? File.ReadAllText(path)
            : throw new FileNotFoundException("The AI system prompt file is missing.", path);
    }
}
