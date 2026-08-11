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
    Task<AIMessageModel> AddUserMessageAsync(long conversationId, string content, long userId, long? runId = null);
    Task<AIMessageModel> AddAssistantMessageAsync(long conversationId, string content, long userId, string? metadataJson = null, long? runId = null);
    Task AddToolCallMessageAsync(long conversationId, long userId, string toolName, string toolCallId, string argumentsJson, long? runId = null);
    Task AddToolResultMessageAsync(long conversationId, long userId, string toolName, string toolCallId, string resultJson, long? runId = null);
    Task<IReadOnlyList<AIMessage>> GetContextMessagesAsync(long conversationId, long userId, int maxMessages);
    Task SetTitleIfEmptyAsync(long conversationId, long userId, string title);

    /// <summary>
    /// Stamps the run onto a message written before the run row existed. The user message has to be
    /// persisted first so the run can reference it, which makes the link a second step.
    /// </summary>
    Task SetRunOnMessageAsync(long messageId, long runId);
}
