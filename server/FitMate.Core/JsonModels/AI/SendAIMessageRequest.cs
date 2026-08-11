namespace FitMate.Core.JsonModels.AI;

public class SendAIMessageRequest
{
    public string Content { get; set; } = string.Empty;

    /// <summary>
    /// Browser-generated idempotency key. A retry with the same key returns the existing run
    /// instead of charging quota and starting a second one.
    /// </summary>
    public string ClientRequestId { get; set; } = string.Empty;
}
