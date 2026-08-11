using FitMate.Services.AI.Tools;

namespace FitMate.Tests.TestInfrastructure;

/// <summary>A trivial read-only tool used to exercise the orchestration loop.</summary>
public sealed class FakeEchoToolHandler : IAIToolHandler
{
    public FakeEchoToolHandler(string name = "echo")
    {
        Name = name;
    }

    public string Name { get; }

    public bool Available { get; set; } = true;

    public Exception? ThrowOnExecute { get; set; }

    public List<string> Calls { get; } = [];

    public AIToolDefinition Definition => new()
    {
        Name = Name,
        Description = "Echoes the supplied value back.",
        ParametersJsonSchema = """
        {
          "type": "object",
          "properties": { "value": { "type": "string" } },
          "required": ["value"]
        }
        """,
    };

    public bool IsAvailable(AIToolContext context) => Available;

    public Task<AIToolExecutionResult> ExecuteAsync(
        string argumentsJson,
        AIToolContext context,
        CancellationToken cancellationToken)
    {
        Calls.Add(argumentsJson);

        if (ThrowOnExecute != null)
        {
            throw ThrowOnExecute;
        }

        return Task.FromResult(AIToolExecutionResult.Ok(new { echoed = argumentsJson }));
    }
}
