using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.AI;

public class StartAIRunResponse
{
    public long ConversationId { get; set; }
    public long RunId { get; set; }
    public AIRunStatus Status { get; set; }
    public AIMessageModel UserMessage { get; set; } = null!;
}
