using FitMate.Core.JsonModels.AIActions;
using FitMate.DB.Enums;

namespace FitMate.Services.AIActions;

public class CreateAIActionRequest
{
    public long ConversationId { get; set; }
    public long AIRunId { get; set; }
    public AIActionType ActionType { get; set; }
    public string PayloadJson { get; set; } = "{}";
    public AIActionPreviewModel Preview { get; set; } = new();
    public AIActionValidationSummaryModel ValidationSummary { get; set; } = new();
}

public interface IAIActionService
{
    /// <summary>Records a proposal awaiting confirmation. Nothing is written to the domain yet.</summary>
    Task<AIActionModel> CreatePendingAsync(CreateAIActionRequest request, long userId);

    Task<AIActionModel?> GetByIdAsync(long actionId, long userId);

    Task<IReadOnlyList<AIActionModel>> ListForConversationAsync(long conversationId, long userId);

    /// <summary>
    /// Revalidates the payload and executes it through the normal domain services. Idempotent:
    /// confirming an already-executed action returns the original result instead of repeating it.
    /// </summary>
    Task<AIActionModel> ConfirmAsync(long actionId, long userId);

    Task<AIActionModel> RejectAsync(long actionId, long userId);
}
