using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.AI;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.AI;

/// <summary>
/// Owns conversation and message persistence. Every method enforces ownership, so no caller can
/// reach another user's conversation.
/// </summary>
public class AIConversationService : IAIConversationService
{
    private const int TitleMaxLength = 60;

    private readonly AppDbContext dbContext;
    private readonly IAIRedactionService redactionService;

    public AIConversationService(AppDbContext dbContext, IAIRedactionService redactionService)
    {
        this.dbContext = dbContext;
        this.redactionService = redactionService;
    }

    public async Task<IReadOnlyList<AIConversationSummaryModel>> ListAsync(long userId)
    {
        return await dbContext.AIConversations
            .AsNoTracking()
            .Where(x => x.UserId == userId && x.Status != AIConversationStatus.Deleted)
            .OrderByDescending(x => x.LastMessageAt)
            .Select(x => new AIConversationSummaryModel
            {
                Id = x.Id,
                Title = x.Title,
                Status = x.Status,
                LastMessageAt = x.LastMessageAt,
                MessageCount = x.Messages.Count(m =>
                    m.Role == AIMessageRole.User || m.Role == AIMessageRole.Assistant),
            })
            .ToListAsync();
    }

    public async Task<AIConversationModel> CreateAsync(CreateAIConversationRequest request, long userId)
    {
        var conversation = new AIConversation
        {
            UserId = userId,
            Title = Truncate(request.Title?.Trim()),
            Status = AIConversationStatus.Active,
            LastMessageAt = DateTime.UtcNow,
        };

        dbContext.AIConversations.Add(conversation);
        await dbContext.SaveChangesAsync();

        return new AIConversationModel
        {
            Id = conversation.Id,
            Title = conversation.Title,
            Status = conversation.Status,
            LastMessageAt = conversation.LastMessageAt,
        };
    }

    public async Task<AIConversationModel?> GetByIdAsync(long conversationId, long userId)
    {
        var conversation = await dbContext.AIConversations
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == conversationId
                && x.UserId == userId
                && x.Status != AIConversationStatus.Deleted);

        if (conversation == null)
        {
            return null;
        }

        var messages = await dbContext.AIMessages
            .AsNoTracking()
            .Where(x => x.ConversationId == conversationId)
            .OrderBy(x => x.DateCreated)
            .ThenBy(x => x.Id)
            .Select(x => new AIMessageModel
            {
                Id = x.Id,
                Role = x.Role,
                Content = x.Content,
                ToolName = x.ToolName,
                DateCreated = x.DateCreated,
            })
            .ToListAsync();

        return new AIConversationModel
        {
            Id = conversation.Id,
            Title = conversation.Title,
            Status = conversation.Status,
            LastMessageAt = conversation.LastMessageAt,
            Messages = messages,
        };
    }

    public async Task<bool> DeleteAsync(long conversationId, long userId)
    {
        var conversation = await dbContext.AIConversations
            .FirstOrDefaultAsync(x => x.Id == conversationId && x.UserId == userId);

        if (conversation == null || conversation.Status == AIConversationStatus.Deleted)
        {
            return false;
        }

        // Soft delete: operational records (runs, usage) must survive for billing and security.
        conversation.Status = AIConversationStatus.Deleted;
        await dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<AIMessageModel> AddUserMessageAsync(long conversationId, string content, long userId)
    {
        var conversation = await RequireOwnedAsync(conversationId, userId);
        var message = await AddMessageAsync(conversation, userId, AIMessageRole.User, content);

        if (string.IsNullOrWhiteSpace(conversation.Title))
        {
            conversation.Title = Truncate(content.Trim());
            await dbContext.SaveChangesAsync();
        }

        return ToModel(message);
    }

    public async Task<AIMessageModel> AddAssistantMessageAsync(
        long conversationId,
        string content,
        long userId,
        string? metadataJson = null)
    {
        var conversation = await RequireOwnedAsync(conversationId, userId);
        var message = await AddMessageAsync(
            conversation,
            userId,
            AIMessageRole.Assistant,
            content,
            metadataJson: metadataJson);

        return ToModel(message);
    }

    public async Task AddToolCallMessageAsync(
        long conversationId,
        long userId,
        string toolName,
        string toolCallId,
        string argumentsJson)
    {
        var conversation = await RequireOwnedAsync(conversationId, userId);
        await AddMessageAsync(
            conversation,
            userId,
            AIMessageRole.ToolCall,
            redactionService.RedactJson(argumentsJson),
            toolName,
            toolCallId);
    }

    public async Task AddToolResultMessageAsync(
        long conversationId,
        long userId,
        string toolName,
        string toolCallId,
        string resultJson)
    {
        var conversation = await RequireOwnedAsync(conversationId, userId);
        await AddMessageAsync(
            conversation,
            userId,
            AIMessageRole.ToolResult,
            redactionService.RedactJson(resultJson),
            toolName,
            toolCallId);
    }

    public async Task<IReadOnlyList<AIMessage>> GetContextMessagesAsync(
        long conversationId,
        long userId,
        int maxMessages)
    {
        await RequireOwnedAsync(conversationId, userId);

        var take = maxMessages <= 0 ? 30 : maxMessages;

        // Take the newest slice, then flip back to chronological order for the provider.
        var messages = await dbContext.AIMessages
            .AsNoTracking()
            .Where(x => x.ConversationId == conversationId
                && (x.Role == AIMessageRole.User || x.Role == AIMessageRole.Assistant))
            .OrderByDescending(x => x.DateCreated)
            .ThenByDescending(x => x.Id)
            .Take(take)
            .ToListAsync();

        messages.Reverse();
        return messages;
    }

    public async Task SetTitleIfEmptyAsync(long conversationId, long userId, string title)
    {
        var conversation = await RequireOwnedAsync(conversationId, userId);
        if (!string.IsNullOrWhiteSpace(conversation.Title))
        {
            return;
        }

        conversation.Title = Truncate(title.Trim());
        await dbContext.SaveChangesAsync();
    }

    private async Task<AIMessage> AddMessageAsync(
        AIConversation conversation,
        long userId,
        AIMessageRole role,
        string content,
        string? toolName = null,
        string? toolCallId = null,
        string? metadataJson = null)
    {
        var message = new AIMessage
        {
            ConversationId = conversation.Id,
            UserId = userId,
            Role = role,
            Content = content,
            ToolName = toolName,
            ToolCallId = toolCallId,
            MetadataJson = metadataJson,
        };

        dbContext.AIMessages.Add(message);
        conversation.LastMessageAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync();

        return message;
    }

    private async Task<AIConversation> RequireOwnedAsync(long conversationId, long userId) =>
        await dbContext.AIConversations
            .FirstOrDefaultAsync(x => x.Id == conversationId
                && x.UserId == userId
                && x.Status != AIConversationStatus.Deleted)
        ?? throw new FitMateException("Conversation not found.");

    private static string? Truncate(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return value.Length <= TitleMaxLength ? value : value[..TitleMaxLength];
    }

    private static AIMessageModel ToModel(AIMessage message) => new()
    {
        Id = message.Id,
        Role = message.Role,
        Content = message.Content,
        ToolName = message.ToolName,
        DateCreated = message.DateCreated,
    };
}
