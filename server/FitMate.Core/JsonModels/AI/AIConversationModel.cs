using FitMate.Core.JsonModels.AIActions;
using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.AI;

public class AIConversationModel
{
    public long Id { get; set; }
    public string? Title { get; set; }
    public AIConversationStatus Status { get; set; }
    public DateTime LastMessageAt { get; set; }
    public List<AIMessageModel> Messages { get; set; } = [];

    /// <summary>Set when a run is still in flight, so a reload can re-attach to it.</summary>
    public AIActiveRunModel? ActiveRun { get; set; }

    /// <summary>
    /// Non-expired proposals for this conversation. Returned on every read because a proposal
    /// created while the user was on another page is otherwise unreachable.
    /// </summary>
    public List<AIActionModel> Actions { get; set; } = [];
}
