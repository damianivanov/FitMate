using FitMate.Core.JsonModels.AIActions;

namespace FitMate.Core.JsonModels.AI;

public class SendAIMessageResponse
{
    public long ConversationId { get; set; }
    public AIMessageModel Message { get; set; } = null!;

    /// <summary>Tool names used during the run, for the frontend activity indicator.</summary>
    public List<string> UsedTools { get; set; } = [];

    /// <summary>Proposals raised during this run that are waiting for the user to confirm.</summary>
    public List<AIActionModel> Actions { get; set; } = [];

    public AIUsageSummaryModel Usage { get; set; } = null!;
}
