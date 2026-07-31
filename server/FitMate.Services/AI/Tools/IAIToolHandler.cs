namespace FitMate.Services.AI.Tools;

/// <summary>
/// A capability the model may invoke. Only handlers registered in DI are callable: the registry
/// treats its injected set as the allow-list.
/// </summary>
public interface IAIToolHandler
{
    string Name { get; }

    AIToolDefinition Definition { get; }

    /// <summary>Lets a handler hide itself, e.g. admin-only tools for non-admin sessions.</summary>
    bool IsAvailable(AIToolContext context);

    Task<AIToolExecutionResult> ExecuteAsync(
        string argumentsJson,
        AIToolContext context,
        CancellationToken cancellationToken);
}
