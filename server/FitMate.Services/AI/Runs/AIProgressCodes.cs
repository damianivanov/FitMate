namespace FitMate.Services.AI.Runs;

/// <summary>
/// The complete set of stages the client may be told about. Codes are stable identifiers the UI
/// maps to copy, never localized sentences, and never anything derived from tool payloads.
/// </summary>
public static class AIProgressCodes
{
    public const string RunQueued = "run_queued";
    public const string RunStarted = "run_started";
    public const string ProviderThinking = "provider_thinking";
    public const string ToolStarted = "tool_started";
    public const string ToolCompleted = "tool_completed";
    public const string ToolFailed = "tool_failed";
    public const string ResponseComposing = "response_composing";
    public const string RunCompleted = "run_completed";
    public const string RunFailed = "run_failed";
    public const string RunLimited = "run_limited";
    public const string RunCancelled = "run_cancelled";

    private static readonly HashSet<string> TerminalCodes =
        [RunCompleted, RunFailed, RunLimited, RunCancelled];

    public static bool IsTerminal(string code) => TerminalCodes.Contains(code);
}

/// <summary>
/// Failure codes the client is allowed to see. Anything else — notably the exception type names
/// <see cref="IAIRunService.FailAsync"/> records for auditing — collapses to a generic code, so
/// internal type names never reach a browser.
/// </summary>
public static class AIPublicErrorCodes
{
    public const string Internal = "internal_error";

    private static readonly HashSet<string> Known =
    [
        "tool_call_limit",
        "tool_iteration_limit",
        "run_interrupted",
        "run_cancelled",
    ];

    public static string Resolve(string? errorCode) =>
        errorCode != null && Known.Contains(errorCode) ? errorCode : Internal;
}
