using FitMate.DB.Entities.Base;
using FitMate.DB.Enums;

namespace FitMate.DB.Entities;

public class AIMessage : BaseEntity
{
    public long ConversationId { get; set; }
    public long UserId { get; set; }
    public AIMessageRole Role { get; set; }
    public string Content { get; set; } = string.Empty;
    public string? ToolName { get; set; }
    public string? ToolCallId { get; set; }
    public string? MetadataJson { get; set; }

    public AIConversation Conversation { get; set; } = null!;
}
