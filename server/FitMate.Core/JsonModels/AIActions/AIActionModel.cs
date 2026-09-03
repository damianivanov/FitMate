using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.AIActions;

public class AIActionModel
{
    public long Id { get; set; }
    public long ConversationId { get; set; }

    /// <summary>The run that proposed this action; the client renders the card against that turn.</summary>
    public long AIRunId { get; set; }

    public AIActionType ActionType { get; set; }
    public AIActionStatus Status { get; set; }

    /// <summary>Human-readable summary rendered by the confirmation card. Never raw tool JSON.</summary>
    public AIActionPreviewModel Preview { get; set; } = new();

    public AIActionValidationSummaryModel ValidationSummary { get; set; } = new();
    public AIActionResultModel? Result { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public DateTime? ExecutedAt { get; set; }
    public string? FailureReason { get; set; }
    public DateTime DateCreated { get; set; }
}
