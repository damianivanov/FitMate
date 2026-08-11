using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Tests.Unit.Services;

public class AIRunSchemaTests
{
    // Ключът за идемпотентност е уникален за потребител
    [Fact]
    public async Task DuplicateClientRequestIdForSameUser_IsRejected()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var conversationId = await AddConversationAsync(context);

        context.AIRuns.Add(NewRun(conversationId, SqliteTestDatabase.UserId, "key-1"));
        await context.SaveChangesAsync();

        context.AIRuns.Add(NewRun(conversationId, SqliteTestDatabase.UserId, "key-1"));

        await Assert.ThrowsAnyAsync<DbUpdateException>(() => context.SaveChangesAsync());
    }

    // Два потребителя могат да ползват един и същ ключ
    [Fact]
    public async Task SameClientRequestIdForDifferentUsers_IsAllowed()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var mine = await AddConversationAsync(context, SqliteTestDatabase.UserId);
        var theirs = await AddConversationAsync(context, SqliteTestDatabase.OtherUserId);

        context.AIRuns.Add(NewRun(mine, SqliteTestDatabase.UserId, "shared-key"));
        context.AIRuns.Add(NewRun(theirs, SqliteTestDatabase.OtherUserId, "shared-key"));

        await context.SaveChangesAsync();

        Assert.Equal(2, await context.AIRuns.CountAsync());
    }

    // Идентичността е курсорът за повторно възпроизвеждане
    [Fact]
    public async Task ProgressEvents_ReplayInInsertionOrder()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var conversationId = await AddConversationAsync(context);

        var run = NewRun(conversationId, SqliteTestDatabase.UserId, "key-2");
        context.AIRuns.Add(run);
        await context.SaveChangesAsync();

        string[] expected = ["run_queued", "run_started", "tool_started", "run_completed"];
        foreach (var code in expected)
        {
            context.AIProgressEvents.Add(new AIProgressEvent { AIRunId = run.Id, Code = code });
            await context.SaveChangesAsync();
        }

        var codes = await context.AIProgressEvents
            .Where(x => x.AIRunId == run.Id)
            .OrderBy(x => x.Id)
            .Select(x => x.Code)
            .ToListAsync();

        Assert.Equal(expected, codes);
    }

    // Изтриването на прогон отнася и събитията му
    [Fact]
    public async Task DeletingRun_CascadesToProgressEvents()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var conversationId = await AddConversationAsync(context);

        var run = NewRun(conversationId, SqliteTestDatabase.UserId, "key-3");
        context.AIRuns.Add(run);
        await context.SaveChangesAsync();

        context.AIProgressEvents.Add(new AIProgressEvent { AIRunId = run.Id, Code = "run_queued" });
        await context.SaveChangesAsync();

        context.AIRuns.Remove(run);
        await context.SaveChangesAsync();

        Assert.Equal(0, await context.AIProgressEvents.CountAsync());
    }

    private static async Task<long> AddConversationAsync(AppDbContext context, long? userId = null)
    {
        var conversation = new AIConversation
        {
            UserId = userId ?? SqliteTestDatabase.UserId,
            Status = AIConversationStatus.Active,
            LastMessageAt = DateTime.UtcNow,
        };

        context.AIConversations.Add(conversation);
        await context.SaveChangesAsync();
        return conversation.Id;
    }

    private static AIRun NewRun(long conversationId, long userId, string clientRequestId) => new()
    {
        UserId = userId,
        ConversationId = conversationId,
        Status = AIRunStatus.Queued,
        Provider = "OpenAI",
        Model = "test-model",
        PromptVersion = "system-v2",
        ClientRequestId = clientRequestId,
        StartedAt = DateTime.UtcNow,
        QueuedAt = DateTime.UtcNow,
    };
}
