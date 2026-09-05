using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.AI.Runs;
using FitMate.Services.Subscriptions;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace FitMate.Tests.Unit.Services;

public class AIRunQueueTests
{
    private static readonly DateTime Now = new(2026, 8, 11, 12, 0, 0, DateTimeKind.Utc);

    // Заявеният прогон се взима и се маркира като изпълняван
    [Fact]
    public async Task ClaimNext_ReturnsQueuedRun_AndMarksItRunning()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var runId = await SeedQueuedRunAsync(context);

        var claimed = await NewQueue(context).ClaimNextAsync("worker-a", Now, CancellationToken.None);

        Assert.Equal(runId, claimed);

        var run = await context.AIRuns.AsNoTracking().SingleAsync();
        Assert.Equal(AIRunStatus.Running, run.Status);
        Assert.Equal("worker-a", run.LeaseOwner);
        Assert.Equal(1, run.AttemptCount);
        Assert.NotNull(run.ProcessingStartedAt);
        Assert.True(run.LeaseExpiresAt > Now);
    }

    // Два работника не могат да вземат един и същ прогон
    [Fact]
    public async Task ClaimNext_TwoWorkers_OnlyOneWins()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        await SeedQueuedRunAsync(context);

        await using var otherContext = db.CreateContext();

        var first = await NewQueue(context).ClaimNextAsync("worker-a", Now, CancellationToken.None);
        var second = await NewQueue(otherContext).ClaimNextAsync("worker-b", Now, CancellationToken.None);

        Assert.NotNull(first);
        Assert.Null(second);
    }

    // Отложен опит не се взима преди времето му
    [Fact]
    public async Task ClaimNext_SkipsRunsWhoseNextAttemptIsInTheFuture()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        await SeedQueuedRunAsync(context, nextAttemptAt: Now.AddMinutes(5));

        Assert.Null(await NewQueue(context).ClaimNextAsync("worker-a", Now, CancellationToken.None));
    }

    // Празна опашка
    [Fact]
    public async Task ClaimNext_WithNothingQueued_ReturnsNull()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();

        Assert.Null(await NewQueue(context).ClaimNextAsync("worker-a", Now, CancellationToken.None));
    }

    // Наемът се подновява само от собственика
    [Fact]
    public async Task RenewLease_OnlySucceedsForTheOwningWorker()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var runId = await SeedQueuedRunAsync(context);
        var queue = NewQueue(context);
        await queue.ClaimNextAsync("worker-a", Now, CancellationToken.None);

        Assert.True(await queue.RenewLeaseAsync(runId, "worker-a", Now.AddSeconds(30), CancellationToken.None));
        Assert.False(await queue.RenewLeaseAsync(runId, "worker-b", Now.AddSeconds(30), CancellationToken.None));
    }

    // Безопасно връщане в опашката, когато няма странични ефекти
    [Fact]
    public async Task RequeueSafe_ReturnsRunToQueue_WhenNoSideEffectsOccurred()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var runId = await SeedQueuedRunAsync(context);
        var queue = NewQueue(context);
        await queue.ClaimNextAsync("worker-a", Now, CancellationToken.None);

        Assert.True(await queue.RequeueSafeAsync(runId, "worker-a", Now.AddSeconds(5), CancellationToken.None));

        var run = await context.AIRuns.AsNoTracking().SingleAsync();
        Assert.Equal(AIRunStatus.Queued, run.Status);
        Assert.Null(run.LeaseOwner);
    }

    // Прогон със странични ефекти никога не се преиграва
    [Fact]
    public async Task RequeueSafe_Refuses_WhenSideEffectsAlreadyHappened()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var runId = await SeedQueuedRunAsync(context);
        var queue = NewQueue(context);
        await queue.ClaimNextAsync("worker-a", Now, CancellationToken.None);

        await context.AIRuns.Where(x => x.Id == runId)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.HasSideEffects, true));

        Assert.False(await queue.RequeueSafeAsync(runId, "worker-a", Now.AddSeconds(5), CancellationToken.None));
    }

    // Изчерпани опити
    [Fact]
    public async Task RequeueSafe_Refuses_WhenAttemptsExhausted()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var runId = await SeedQueuedRunAsync(context);
        var queue = NewQueue(context, maximumSafeAttempts: 1);
        await queue.ClaimNextAsync("worker-a", Now, CancellationToken.None);

        Assert.False(await queue.RequeueSafeAsync(runId, "worker-a", Now.AddSeconds(5), CancellationToken.None));
    }

    // Изтекъл наем: чистият се връща, мръсният се проваля
    [Fact]
    public async Task ReclaimStale_RequeuesCleanRun_AndFailsOneWithSideEffects()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var cleanId = await SeedQueuedRunAsync(context, clientRequestId: "clean");
        var dirtyId = await SeedQueuedRunAsync(context, clientRequestId: "dirty");
        var queue = NewQueue(context);

        await queue.ClaimNextAsync("worker-a", Now, CancellationToken.None);
        await queue.ClaimNextAsync("worker-a", Now, CancellationToken.None);

        await context.AIRuns.Where(x => x.Id == dirtyId)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.HasSideEffects, true));

        var reclaimed = await queue.ReclaimStaleAsync(Now.AddHours(1), CancellationToken.None);

        Assert.Equal(2, reclaimed);
        Assert.Equal(AIRunStatus.Queued, (await context.AIRuns.AsNoTracking().SingleAsync(x => x.Id == cleanId)).Status);

        var dirty = await context.AIRuns.AsNoTracking().SingleAsync(x => x.Id == dirtyId);
        Assert.Equal(AIRunStatus.Failed, dirty.Status);
        Assert.Equal("run_interrupted", dirty.ErrorCode);
    }

    // Проваленият прогон освобождава разговора и записва терминално събитие
    [Fact]
    public async Task ReclaimStale_ClearsActiveRunAndPublishesTerminalEvent()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var runId = await SeedQueuedRunAsync(context, setActiveRun: true);
        var queue = NewQueue(context);
        await queue.ClaimNextAsync("worker-a", Now, CancellationToken.None);

        await context.AIRuns.Where(x => x.Id == runId)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.HasSideEffects, true));

        await queue.ReclaimStaleAsync(Now.AddHours(1), CancellationToken.None);

        var conversation = await context.AIConversations.AsNoTracking().SingleAsync();
        Assert.Null(conversation.ActiveRunId);

        var codes = await context.AIProgressEvents.AsNoTracking()
            .Where(x => x.AIRunId == runId)
            .Select(x => x.Code)
            .ToListAsync();
        Assert.Contains(AIProgressCodes.RunFailed, codes);
    }

    // Жив наем не се пипа
    [Fact]
    public async Task ReclaimStale_LeavesLiveLeasesAlone()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        await SeedQueuedRunAsync(context);
        var queue = NewQueue(context);
        await queue.ClaimNextAsync("worker-a", Now, CancellationToken.None);

        Assert.Equal(0, await queue.ReclaimStaleAsync(Now.AddSeconds(10), CancellationToken.None));
        Assert.Equal(AIRunStatus.Running, (await context.AIRuns.AsNoTracking().SingleAsync()).Status);
    }

    [Fact]
    public async Task ReclaimStale_ReleasesReservedQuotaExactlyOnce()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var usage = new UsageService(context, new FakeEntitlementService());
        var reservation = await usage.ReserveAsync(SqliteTestDatabase.UserId, SubscriptionFeature.AIChat, 1);
        var runId = await SeedQueuedRunAsync(context, setActiveRun: true);
        await context.AIRuns.Where(x => x.Id == runId).ExecuteUpdateAsync(s =>
            s.SetProperty(x => x.UsageReservationId, reservation.Id));
        var queue = new AIRunQueue(context, new AIProgressService(context),
            Options.Create(new AIRunOptions { LeaseSeconds = 180, MaximumSafeAttempts = 1 }), usage);
        await queue.ClaimNextAsync("worker-a", Now, CancellationToken.None);

        Assert.Equal(1, await queue.ReclaimStaleAsync(Now.AddHours(1), CancellationToken.None));
        Assert.Equal(0, await queue.ReclaimStaleAsync(Now.AddHours(1), CancellationToken.None));

        var bucket = await context.UsageBuckets.AsNoTracking().SingleAsync();
        Assert.Equal(0, bucket.Reserved);
        Assert.Equal(0, bucket.Used);
        Assert.Equal(UsageReservationStatus.Released,
            (await context.UsageReservations.AsNoTracking().SingleAsync()).Status);
        Assert.Equal(1, await context.UsageEntries.CountAsync(x => x.Type == UsageEntryType.Release));
        Assert.Equal(1, await context.AIProgressEvents.CountAsync(x => x.Code == AIProgressCodes.RunFailed));
        Assert.Null((await context.AIConversations.AsNoTracking().SingleAsync()).ActiveRunId);
    }

    private static AIRunQueue NewQueue(AppDbContext context, int maximumSafeAttempts = 2) =>
        new(
            context,
            new AIProgressService(context),
            Options.Create(new AIRunOptions { LeaseSeconds = 180, MaximumSafeAttempts = maximumSafeAttempts }),
            new FakeUsageService());

    private static async Task<long> SeedQueuedRunAsync(
        AppDbContext context,
        DateTime? nextAttemptAt = null,
        string clientRequestId = "req-1",
        bool setActiveRun = false)
    {
        var conversation = new AIConversation
        {
            UserId = SqliteTestDatabase.UserId,
            Status = AIConversationStatus.Active,
            LastMessageAt = Now,
        };

        context.AIConversations.Add(conversation);
        await context.SaveChangesAsync();

        var run = new AIRun
        {
            UserId = SqliteTestDatabase.UserId,
            ConversationId = conversation.Id,
            Status = AIRunStatus.Queued,
            Provider = "OpenAI",
            Model = "test-model",
            PromptVersion = "system-v2",
            ClientRequestId = clientRequestId,
            StartedAt = Now,
            QueuedAt = Now,
            NextAttemptAt = nextAttemptAt ?? Now,
        };

        context.AIRuns.Add(run);
        await context.SaveChangesAsync();

        if (setActiveRun)
        {
            conversation.ActiveRunId = run.Id;
            await context.SaveChangesAsync();
        }

        return run.Id;
    }
}
