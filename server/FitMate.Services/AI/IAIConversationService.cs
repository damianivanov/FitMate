using FitMate.Core.JsonModels.AI;
using FitMate.DB.Entities;

namespace FitMate.Services.AI;

/// <summary>
/// Conversation and message persistence. Every method enforces ownership, so no caller can reach
/// another user's conversation.
/// </summary>
public interface IAIConversationService
{
    Task<IReadOnlyList<AIConversationSummaryModel>> ListAsync(long userId);
    Task<AIConversationModel> CreateAsync(CreateAIConversationRequest request, long userId);
    Task<AIConversationModel?> GetByIdAsync(long conversationId, long userId);
    Task<bool> DeleteAsync(long conversationId, long userId);
    Task<AIMessageModel> AddUserMessageAsync(long conversationId, string content, long userId);
    Task<AIMessageModel> AddAssistantMessageAsync(long conversationId, string content, long userId, string? metadataJson = null);
    Task AddToolCallMessageAsync(long conversationId, long userId, string toolName, string toolCallId, string argumentsJson);
    Task AddToolResultMessageAsync(long conversationId, long userId, string toolName, string toolCallId, string resultJson);
    Task<IReadOnlyList<AIMessage>> GetContextMessagesAsync(long conversationId, long userId, int maxMessages);
    Task SetTitleIfEmptyAsync(long conversationId, long userId, string title);
}
