namespace FitMate.Services.AI;

public interface IAIPromptBuilder
{
    /// <summary>Stored on every run so a prompt change is always traceable.</summary>
    string SystemPromptVersion { get; }

    string BuildSystemPrompt();
}
