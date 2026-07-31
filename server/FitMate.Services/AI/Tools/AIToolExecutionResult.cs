namespace FitMate.Services.AI.Tools;

public class AIToolExecutionResult
{
    public bool Success { get; set; }

    /// <summary>True when the tool created a pending action that the user must confirm.</summary>
    public bool RequiresConfirmation { get; set; }

    public object? Data { get; set; }
    public long? AIActionId { get; set; }
    public string? ErrorCode { get; set; }
    public string? ErrorMessage { get; set; }

    public static AIToolExecutionResult Ok(object? data) => new() { Success = true, Data = data };

    public static AIToolExecutionResult Fail(string errorCode, string errorMessage) => new()
    {
        Success = false,
        ErrorCode = errorCode,
        ErrorMessage = errorMessage,
    };
}
