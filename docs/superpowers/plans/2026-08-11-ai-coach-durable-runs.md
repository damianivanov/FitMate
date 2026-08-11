# AI Coach Durable Runs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AI Coach runs survive navigation, refresh and reconnect by moving orchestration onto a database-backed queue processed by a server-side worker, with truthful live progress delivered over SSE (polling fallback), plus bounded SQL projections for AI training context and rolling conversation summaries.

**Architecture:** `POST .../messages` becomes an idempotent enqueue that persists the user message, a quota reservation and a `Queued` `AIRun` in one transaction, then returns `202` with a `runId`. An in-process `BackgroundService` atomically claims queued runs via a lease and calls `AIOrchestrator.ProcessAsync`, which runs the existing bounded tool loop while appending sanitized `AIProgressEvent` rows. The browser observes those rows through an SSE endpoint that replays from a cursor, falling back to polling a run snapshot. Conversation reads gain an active-run summary and pending action list so all UI state is rebuildable from the backend alone.

**Tech Stack:** .NET 9, EF Core 9 (Npgsql in production, SQLite in-memory in tests), xUnit, React 19 + TypeScript + Vite, Axios, nginx reverse proxy, Reinforced.Typings for generated frontend types.

---

## Global Constraints

Every task's requirements implicitly include this section.

- **Never run `git commit`.** No task in this plan contains a commit step. Damian commits when he chooses, as one commit. Do not stage, commit, amend, or branch unless explicitly told to in a later message.
- **No manual TypeScript interfaces in service files.** All request/response types consumed by `client/src/services/*.ts` must come from Reinforced.Typings output. To add a frontend type: add the C# DTO under `FitMate.Core/JsonModels/`, run `dotnet build server/FitMate.Web/FitMate.Web.csproj`, then `npm run process-types` from `client/`. Never hand-write a mirror of a backend model.
- **`async`/`await` only.** Never `.then()`, `.catch()`, or `.finally()` chains in TypeScript.
- **No narration comments.** Do not add comments that restate what the code does. The existing codebase comments explain *why* a non-obvious decision was made — match that bar or write nothing.
- **Run `npm run lint` from `client/` after any React/TypeScript change** and fix every error before the task is done.
- **Portable EF only.** Tests use SQLite in-memory (`SqliteTestDatabase`); production uses PostgreSQL. Do not write raw SQL, `FOR UPDATE SKIP LOCKED`, `xmin`, or Npgsql-only constructs in code paths that tests exercise. Use `ExecuteUpdateAsync` with affected-row counts for atomic claims.
- **Never expose to the client:** raw tool arguments or results, internal IDs beyond run/message/action IDs, prompt text, model reasoning, exception text, SQL, provider payloads, secrets.
- **Progress copy is derived from stable server codes**, never from an extra model call.
- **Append enum values, never renumber.** `AIRunStatus` values 1–5 are persisted in production.
- Existing safety invariants must survive every refactor: plan gate before quota, quota before provider cost, resolved model/budget snapshot, max tool iterations, max tool calls, wall-clock timeout, tool allow-list, proposal confirmation boundary, redaction, and exactly-once reservation commit/release.

## Verification commands

Run from the repository root. These are referenced by name throughout the plan.

```powershell
dotnet build server/FitMate.sln
dotnet test server/FitMate.Tests/FitMate.Tests.csproj
dotnet build server/FitMate.Web/FitMate.Web.csproj
cd client
npm run process-types
npm run lint
npx tsc -b --noEmit
npm run build
```

To run a single test: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter "FullyQualifiedName~AIRunStarterTests.Duplicate"`

---

## Deviations from the source plan

These are deliberate departures from `FitMate-AI-Coach-Async-Runs-Implementation-Plan.md`. Each is reversible; raise it if you disagree before implementing.

1. **Queue claim uses `ExecuteUpdateAsync`, not `FOR UPDATE SKIP LOCKED`.** The source plan proposes PostgreSQL row locking. Tests run on SQLite in-memory, so that path could never be covered by the test suite the plan itself demands. A single atomic `UPDATE ... WHERE Id = @id AND Status = Queued AND (LeaseExpiresAt IS NULL OR LeaseExpiresAt < now)` with an affected-row count of 1 is equally race-free, portable to both providers, and directly testable. At one worker container this is not a throughput compromise.

2. **`AIProgressEvent` stores a `Code` string and `ToolName`; no `Type`/`Status` enums.** The source plan proposes `AIProgressEventType` and `AIProgressEventStatus` alongside `Code`. The code already discriminates every case (`tool_started` vs `tool_completed` vs `run_failed`), so the enums are redundant columns that can drift out of sync with the code they duplicate. Terminality is decided by a static `HashSet<string>` in one place.

3. **No `AI:AsyncRuns:Enabled` dual-path flag.** Per your decision: direct cutover. The synchronous `SendAsync` path is removed, not flagged. `WorkerEnabled` survives as ordinary operational config (so a second non-worker instance is possible later), but there is never a second live orchestration path.

4. **`AIRun.HasSideEffects` added (not in source plan).** The source plan's retry policy repeatedly distinguishes "interrupted before tool execution" (safe to requeue) from "interrupted after" (must not replay). Nothing in the proposed schema records which happened. A boolean flipped to `true` the first time a tool executes or an action is created makes that rule enforceable rather than aspirational.

5. **SSE polls the database server-side.** There is no `LISTEN`/`NOTIFY` or in-process bus. The SSE endpoint queries for new events on an interval and pushes them to the browser. This means SSE does **not** reduce database load versus client polling — the win is client-side latency and a single reconnect path. Stated so nobody later assumes a push pipeline exists.

6. **The Free AI chat discrepancy is three-way, not two-way.** The source plan notes `plans.json` (25) vs `subscriptions.md` (10). `SqliteTestDatabase.SeedPlans` also seeds 10 while its comment claims to mirror `plans.json`. Task 10 reconciles all three.

---

## File structure

**Created — persistence**

| File | Responsibility |
| --- | --- |
| `server/FitMate.DB/Entities/AIProgressEvent.cs` | One sanitized, append-only progress row per run stage |
| `server/FitMate.DB/Configurations/AIProgressEventConfiguration.cs` | Column limits and `(AIRunId, Id)` replay index |

**Created — contracts (`server/FitMate.Core/JsonModels/AI/`)**

| File | Responsibility |
| --- | --- |
| `StartAIRunResponse.cs` | The `202` enqueue envelope |
| `AIRunSnapshotModel.cs` | Full rebuildable run state for polling and reconnect |
| `AIProgressEventModel.cs` | One progress event as sent to the browser |
| `AIActiveRunModel.cs` | Compact active-run pointer embedded in a conversation read |

**Created — services (`server/FitMate.Services/AI/Runs/`)**

| File | Responsibility |
| --- | --- |
| `IAIRunStarter.cs` / `AIRunStarter.cs` | Idempotent enqueue: validate, reserve, persist, emit `run_queued` |
| `IAIRunQueue.cs` / `AIRunQueue.cs` | Atomic claim, lease renewal, safe requeue, stale reclaim |
| `IAIProgressService.cs` / `AIProgressService.cs` | Append sanitized progress; read events after a cursor |
| `IAIRunSnapshotService.cs` / `AIRunSnapshotService.cs` | Ownership-checked snapshot assembly |
| `AIRunOptions.cs` | Worker configuration binding (`AI:AsyncRuns`) |

**Created — context queries (`server/FitMate.Services/AI/Context/`)**

| File | Responsibility |
| --- | --- |
| `IAITrainingContextQuery.cs` / `AITrainingContextQuery.cs` | Bounded, server-projected AI reads |
| `AIContextModels.cs` | The four compact projection records |

**Created — summarization (`server/FitMate.Services/AI/Summaries/`)**

| File | Responsibility |
| --- | --- |
| `IAIConversationSummarizer.cs` / `AIConversationSummarizer.cs` | Roll dropped message slices into a bounded summary |

**Created — hosting**

| File | Responsibility |
| --- | --- |
| `server/FitMate.Web/Infrastructure/AIRunWorkerHostedService.cs` | Claim loop, scope per run, lease renewal, shutdown handling |
| `server/FitMate.Web/Controllers/AIRunController.cs` | Snapshot and SSE routes |

**Created — frontend**

| File | Responsibility |
| --- | --- |
| `client/src/pages/AICoach/hooks/useAIRunProgress.ts` | EventSource subscribe + polling fallback for one run |
| `client/src/pages/AICoach/progressLabels.ts` | Code → user-facing copy maps |

**Modified**

| File | Change |
| --- | --- |
| `server/FitMate.DB/Enums/AIRunStatus.cs` | Append `Queued = 6` |
| `server/FitMate.DB/Entities/AIRun.cs` | Queue, lease, idempotency and budget fields |
| `server/FitMate.DB/Entities/AIConversation.cs` | `ActiveRunId`, summary fields |
| `server/FitMate.DB/Entities/AIMessage.cs` | Nullable `AIRunId` |
| `server/FitMate.DB/Configurations/AIRun*/AIConversation*/AIMessage*Configuration.cs` | Indexes and constraints |
| `server/FitMate.DB/AppDbContext.cs` | `DbSet<AIProgressEvent>` |
| `server/FitMate.Services/AI/AIOrchestrator.cs` | `SendAsync` → `ProcessAsync(runId, ct)`, instrumented |
| `server/FitMate.Services/AI/IAIOrchestrator.cs` | New signature |
| `server/FitMate.Services/AI/AIRunService.cs` / `IAIRunService.cs` | Queue-aware lifecycle |
| `server/FitMate.Services/AI/AIConversationService.cs` | Run-linked messages, active run, summary window |
| `server/FitMate.Services/AI/AIContextBuilder.cs` | Prepend summary |
| `server/FitMate.Services/AI/Tools/AIToolRegistry.cs` | Publish tool progress in the execution lifecycle |
| `server/FitMate.Services/AI/Tools/ReadOnly/GetWorkoutCreationContextToolHandler.cs` | Use `AITrainingContextQuery` |
| `server/FitMate.Services/AI/Tools/ReadOnly/GetRecentWorkoutsToolHandler.cs` | Use `AITrainingContextQuery` |
| `server/FitMate.Services/AI/Tools/ReadOnly/GetExerciseHistoryToolHandler.cs` | Cap IDs, use bounded query |
| `server/FitMate.Services/AI/Tools/Proposals/ProposeWorkoutToolHandler.cs` | Fix conflicting tool guidance |
| `server/FitMate.Core/JsonModels/AI/SendAIMessageRequest.cs` | `ClientRequestId` |
| `server/FitMate.Core/JsonModels/AI/AIConversationModel.cs` | `ActiveRun`, `Actions` |
| `server/FitMate.Web/Controllers/AIController.cs` | `202` enqueue |
| `server/FitMate.Web/Program.cs` | Register queue, progress, worker, context query |
| `server/FitMate.Web/appsettings.json` | `AI:AsyncRuns` block |
| `client/src/services/aiService.ts` | Start/snapshot/stream calls |
| `client/src/pages/AICoach/hooks/useAICoachPage.ts` | Start-and-observe instead of await-answer |
| `client/src/pages/AICoach/AICoach.tsx` | Wire progress model |
| `client/src/pages/AICoach/components/ToolActivityIndicator.tsx` | Render event-keyed progress |
| `client/nginx/default.conf.template` | Unbuffered SSE location |
| `docs/architecture/ai-coach.md`, `subscriptions.md`, `operations.md` | Document the pipeline and reconcile limits |

**Deleted**

| File | Reason |
| --- | --- |
| `server/FitMate.Core/JsonModels/AI/SendAIMessageResponse.cs` | Replaced by `StartAIRunResponse` + snapshot (direct cutover) |

---

## Task 1: Contracts and baseline coverage

Locks the wire format before any behavior moves, and pins current orchestrator behavior so the extraction in Task 5 is provably non-destructive.

**Files:**
- Create: `server/FitMate.Core/JsonModels/AI/StartAIRunResponse.cs`
- Create: `server/FitMate.Core/JsonModels/AI/AIProgressEventModel.cs`
- Create: `server/FitMate.Core/JsonModels/AI/AIRunSnapshotModel.cs`
- Create: `server/FitMate.Core/JsonModels/AI/AIActiveRunModel.cs`
- Modify: `server/FitMate.Core/JsonModels/AI/SendAIMessageRequest.cs`
- Modify: `server/FitMate.Core/JsonModels/AI/AIConversationModel.cs`
- Test: `server/FitMate.Tests/Unit/Services/AIOrchestratorTests.cs`

**Interfaces:**
- Produces: `StartAIRunResponse { long ConversationId, long RunId, AIRunStatus Status, AIMessageModel UserMessage }`; `AIRunSnapshotModel { long Id, long ConversationId, AIRunStatus Status, string CurrentProgressCode, long LastEventId, List<AIProgressEventModel> Events, AIMessageModel? AssistantMessage, List<AIActionModel> Actions, AIUsageSummaryModel? Usage, string? PublicErrorCode }`; `AIProgressEventModel { long Id, string Code, string? ToolName, DateTime OccurredAt }`; `AIActiveRunModel { long RunId, AIRunStatus Status, string CurrentProgressCode, long LastEventId }`; `SendAIMessageRequest.ClientRequestId`.

- [ ] **Step 1: Add `ClientRequestId` to the send request**

`server/FitMate.Core/JsonModels/AI/SendAIMessageRequest.cs`:

```csharp
namespace FitMate.Core.JsonModels.AI;

public class SendAIMessageRequest
{
    public string Content { get; set; } = string.Empty;

    /// <summary>
    /// Browser-generated idempotency key. A retry with the same key returns the existing run
    /// instead of charging quota and starting a second one.
    /// </summary>
    public string ClientRequestId { get; set; } = string.Empty;
}
```

The existing `using FitMate.DB.Enums;` is unused — drop it.

- [ ] **Step 2: Add the run contracts**

`server/FitMate.Core/JsonModels/AI/StartAIRunResponse.cs`:

```csharp
using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.AI;

public class StartAIRunResponse
{
    public long ConversationId { get; set; }
    public long RunId { get; set; }
    public AIRunStatus Status { get; set; }
    public AIMessageModel UserMessage { get; set; } = null!;
}
```

`server/FitMate.Core/JsonModels/AI/AIProgressEventModel.cs`:

```csharp
namespace FitMate.Core.JsonModels.AI;

public class AIProgressEventModel
{
    public long Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string? ToolName { get; set; }
    public DateTime OccurredAt { get; set; }
}
```

`server/FitMate.Core/JsonModels/AI/AIActiveRunModel.cs`:

```csharp
using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.AI;

public class AIActiveRunModel
{
    public long RunId { get; set; }
    public AIRunStatus Status { get; set; }
    public string CurrentProgressCode { get; set; } = string.Empty;
    public long LastEventId { get; set; }
}
```

`server/FitMate.Core/JsonModels/AI/AIRunSnapshotModel.cs`:

```csharp
using FitMate.Core.JsonModels.AIActions;
using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.AI;

public class AIRunSnapshotModel
{
    public long Id { get; set; }
    public long ConversationId { get; set; }
    public AIRunStatus Status { get; set; }
    public string CurrentProgressCode { get; set; } = string.Empty;

    /// <summary>Replay cursor: the client resumes SSE from here after a reconnect.</summary>
    public long LastEventId { get; set; }

    public List<AIProgressEventModel> Events { get; set; } = [];
    public AIMessageModel? AssistantMessage { get; set; }
    public List<AIActionModel> Actions { get; set; } = [];
    public AIUsageSummaryModel? Usage { get; set; }

    /// <summary>Stable failure code for UI copy. Never carries exception text.</summary>
    public string? PublicErrorCode { get; set; }
}
```

- [ ] **Step 3: Extend the conversation read contract**

`server/FitMate.Core/JsonModels/AI/AIConversationModel.cs` — add two properties after `Messages`:

```csharp
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
```

- [ ] **Step 4: Pin current tool-loop behavior with a characterization test**

Append to `server/FitMate.Tests/Unit/Services/AIOrchestratorTests.cs`. This test must pass against the **current** synchronous implementation and again after Task 5.

```csharp
[Fact]
public async Task MultiToolRun_CommitsQuotaOnce_AndRecordsEveryToolExecution()
{
    using var db = new SqliteTestDatabase();
    var provider = new FakeAICompletionProvider()
        .EnqueueToolCall("call-1", "get_training_profile", "{}")
        .EnqueueToolCall("call-2", "get_recent_workouts", "{}")
        .EnqueueText("Here is your plan.");

    var harness = await CreateAsync(db, provider, tools: [new StubToolHandler("get_training_profile"), new StubToolHandler("get_recent_workouts")]);

    await harness.Orchestrator.SendAsync(
        harness.ConversationId,
        new SendAIMessageRequest { Content = "plan my week" },
        SqliteTestDatabase.UserId);

    Assert.Equal(1, harness.Usage.CommitCount);
    Assert.Equal(0, harness.Usage.ReleaseCount);

    var run = await harness.Context.AIRuns.SingleAsync();
    Assert.Equal(AIRunStatus.Completed, run.Status);
    Assert.Equal(2, run.ToolCallCount);
    Assert.NotNull(run.AssistantMessageId);

    var executions = await harness.Context.AIToolExecutions
        .Where(x => x.AIRunId == run.Id)
        .OrderBy(x => x.Id)
        .ToListAsync();
    Assert.Equal(2, executions.Count);
    Assert.All(executions, x => Assert.Equal(AIToolExecutionStatus.Completed, x.Status));
}
```

If `StubToolHandler` does not already exist in the test project, add it to `server/FitMate.Tests/TestInfrastructure/StubToolHandler.cs`:

```csharp
using FitMate.Services.AI.Tools;

namespace FitMate.Tests.TestInfrastructure;

public sealed class StubToolHandler : IAIToolHandler
{
    private readonly object payload;

    public StubToolHandler(string name, object? payload = null)
    {
        Name = name;
        this.payload = payload ?? new { ok = true };
    }

    public string Name { get; }

    public AIToolDefinition Definition => new()
    {
        Name = Name,
        Description = $"Test stub for {Name}.",
        ParametersJsonSchema = """{ "type": "object", "properties": {} }""",
    };

    public bool IsAvailable(AIToolContext context) => true;

    public Task<AIToolExecutionResult> ExecuteAsync(
        string argumentsJson,
        AIToolContext context,
        CancellationToken cancellationToken) =>
        Task.FromResult(AIToolExecutionResult.Ok(payload));
}
```

Check `FakeUsageService` exposes `CommitCount` and `ReleaseCount`; if it tracks differently, adapt the assertions to the existing shape rather than rewriting the fake.

- [ ] **Step 5: Run the characterization test and confirm it passes now**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter "FullyQualifiedName~MultiToolRun_CommitsQuotaOnce"`
Expected: PASS. This is a characterization test, not a TDD red test — it documents behavior that must not change.

- [ ] **Step 6: Build**

Run: `dotnet build server/FitMate.sln`
Expected: succeeds. `SendAIMessageResponse` still exists and is still used — it is removed in Task 6.

---

## Task 2: Schema and migration

**Files:**
- Modify: `server/FitMate.DB/Enums/AIRunStatus.cs`
- Modify: `server/FitMate.DB/Entities/AIRun.cs`
- Modify: `server/FitMate.DB/Entities/AIConversation.cs`
- Modify: `server/FitMate.DB/Entities/AIMessage.cs`
- Create: `server/FitMate.DB/Entities/AIProgressEvent.cs`
- Create: `server/FitMate.DB/Configurations/AIProgressEventConfiguration.cs`
- Modify: `server/FitMate.DB/Configurations/AIRunConfiguration.cs`
- Modify: `server/FitMate.DB/Configurations/AIConversationConfiguration.cs`
- Modify: `server/FitMate.DB/Configurations/AIMessageConfiguration.cs`
- Modify: `server/FitMate.DB/AppDbContext.cs`
- Test: `server/FitMate.Tests/Unit/Services/AIRunSchemaTests.cs`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `AIRunStatus.Queued`; `AIRun.ClientRequestId/UsageReservationId/QueuedAt/ProcessingStartedAt/HeartbeatAt/LeaseOwner/LeaseExpiresAt/AttemptCount/NextAttemptAt/ExecutionBudgetJson/HasSideEffects`; `AIConversation.ActiveRunId/Summary/SummaryThroughMessageId/SummaryUpdatedAt`; `AIMessage.AIRunId`; `AIProgressEvent { long AIRunId, string Code, string? ToolName }`; `AppDbContext.AIProgressEvents`.

- [ ] **Step 1: Append the queued status**

`server/FitMate.DB/Enums/AIRunStatus.cs`:

```csharp
namespace FitMate.DB.Enums;

public enum AIRunStatus
{
    Running = 1,
    Completed = 2,
    Failed = 3,
    Cancelled = 4,
    LimitExceeded = 5,

    /// <summary>Accepted and persisted, waiting for a worker to claim it. Appended: 1-5 are in production.</summary>
    Queued = 6,
}
```

- [ ] **Step 2: Extend `AIRun`**

`server/FitMate.DB/Entities/AIRun.cs` — add after `CompletedAt`:

```csharp
    /// <summary>Browser idempotency key; unique per user.</summary>
    public string ClientRequestId { get; set; } = string.Empty;

    /// <summary>Links the queued run to the AI chat unit reserved at enqueue time.</summary>
    public long? UsageReservationId { get; set; }

    public DateTime? QueuedAt { get; set; }

    /// <summary>Worker start, so queue delay is not counted as run duration.</summary>
    public DateTime? ProcessingStartedAt { get; set; }

    public DateTime? HeartbeatAt { get; set; }
    public string? LeaseOwner { get; set; }
    public DateTime? LeaseExpiresAt { get; set; }
    public int AttemptCount { get; set; }
    public DateTime? NextAttemptAt { get; set; }

    /// <summary>Model and numeric limits frozen at enqueue, so a settings change mid-queue cannot alter a run.</summary>
    public string? ExecutionBudgetJson { get; set; }

    /// <summary>
    /// Set once a tool has run or a proposal exists. A run past this point must never be replayed:
    /// re-running the loop could charge generation quota twice or create duplicate proposals.
    /// </summary>
    public bool HasSideEffects { get; set; }

    public ICollection<AIProgressEvent> ProgressEvents { get; set; } = [];
```

- [ ] **Step 3: Extend `AIConversation` and `AIMessage`**

`server/FitMate.DB/Entities/AIConversation.cs` — add before the navigation properties:

```csharp
    /// <summary>The one-active-run guard. Plain reference, cleared by every terminal path.</summary>
    public long? ActiveRunId { get; set; }

    /// <summary>Rolling summary of messages that fell outside the retained context window.</summary>
    public string? Summary { get; set; }

    public long? SummaryThroughMessageId { get; set; }
    public DateTime? SummaryUpdatedAt { get; set; }
```

`server/FitMate.DB/Entities/AIMessage.cs` — add after `MetadataJson`:

```csharp
    /// <summary>The run that produced this message. Null for messages written before durable runs.</summary>
    public long? AIRunId { get; set; }
```

- [ ] **Step 4: Create the progress event entity**

`server/FitMate.DB/Entities/AIProgressEvent.cs`:

```csharp
using FitMate.DB.Entities.Base;

namespace FitMate.DB.Entities;

/// <summary>
/// One sanitized, user-safe stage of a run. `Id` is the replay cursor, so rows are append-only and
/// never updated. Codes are stable identifiers, not localized copy — the client owns the wording.
/// </summary>
public class AIProgressEvent : BaseEntity
{
    public long AIRunId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string? ToolName { get; set; }

    public AIRun AIRun { get; set; } = null!;
}
```

- [ ] **Step 5: Configure the new entity and indexes**

`server/FitMate.DB/Configurations/AIProgressEventConfiguration.cs`:

```csharp
using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

public class AIProgressEventConfiguration : IEntityTypeConfiguration<AIProgressEvent>
{
    public void Configure(EntityTypeBuilder<AIProgressEvent> builder)
    {
        builder.Property(x => x.Code).HasMaxLength(50).IsRequired();
        builder.Property(x => x.ToolName).HasMaxLength(100);

        builder.HasOne(x => x.AIRun)
            .WithMany(x => x.ProgressEvents)
            .HasForeignKey(x => x.AIRunId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => new { x.AIRunId, x.Id });
    }
}
```

Append to `AIRunConfiguration.Configure`:

```csharp
        builder.Property(x => x.ClientRequestId).HasMaxLength(64);
        builder.Property(x => x.LeaseOwner).HasMaxLength(100);
        builder.Property(x => x.ExecutionBudgetJson).HasColumnType("jsonb");

        builder.HasIndex(x => new { x.UserId, x.ClientRequestId })
            .IsUnique()
            .HasFilter(null);

        builder.HasIndex(x => new { x.Status, x.NextAttemptAt, x.LeaseExpiresAt });
```

Append to `AIConversationConfiguration.Configure`:

```csharp
        builder.Property(x => x.Summary).HasMaxLength(4000);
```

Append to `AIMessageConfiguration.Configure`:

```csharp
        builder.HasIndex(x => new { x.AIRunId, x.Id });
```

Add to `server/FitMate.DB/AppDbContext.cs` next to the other AI DbSets (around line 47):

```csharp
    public DbSet<AIProgressEvent> AIProgressEvents => Set<AIProgressEvent>();
```

- [ ] **Step 6: Write the schema test**

`server/FitMate.Tests/Unit/Services/AIRunSchemaTests.cs`:

```csharp
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Tests.Unit.Services;

public class AIRunSchemaTests
{
    [Fact]
    public async Task DuplicateClientRequestIdForSameUser_IsRejected()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();

        var conversation = new AIConversation
        {
            UserId = SqliteTestDatabase.UserId,
            Status = AIConversationStatus.Active,
            LastMessageAt = DateTime.UtcNow,
        };
        context.AIConversations.Add(conversation);
        await context.SaveChangesAsync();

        context.AIRuns.Add(NewRun(conversation.Id, SqliteTestDatabase.UserId, "key-1"));
        await context.SaveChangesAsync();

        context.AIRuns.Add(NewRun(conversation.Id, SqliteTestDatabase.UserId, "key-1"));

        await Assert.ThrowsAnyAsync<DbUpdateException>(() => context.SaveChangesAsync());
    }

    [Fact]
    public async Task ProgressEvents_ReplayInInsertionOrder()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();

        var conversation = new AIConversation
        {
            UserId = SqliteTestDatabase.UserId,
            Status = AIConversationStatus.Active,
            LastMessageAt = DateTime.UtcNow,
        };
        context.AIConversations.Add(conversation);
        await context.SaveChangesAsync();

        var run = NewRun(conversation.Id, SqliteTestDatabase.UserId, "key-2");
        context.AIRuns.Add(run);
        await context.SaveChangesAsync();

        foreach (var code in new[] { "run_queued", "run_started", "tool_started", "run_completed" })
        {
            context.AIProgressEvents.Add(new AIProgressEvent { AIRunId = run.Id, Code = code });
            await context.SaveChangesAsync();
        }

        var codes = await context.AIProgressEvents
            .Where(x => x.AIRunId == run.Id)
            .OrderBy(x => x.Id)
            .Select(x => x.Code)
            .ToListAsync();

        Assert.Equal(["run_queued", "run_started", "tool_started", "run_completed"], codes);
    }

    private static AIRun NewRun(long conversationId, long userId, string clientRequestId) => new()
    {
        UserId = userId,
        ConversationId = conversationId,
        Status = AIRunStatus.Queued,
        Provider = "OpenAI",
        Model = "test-model",
        PromptVersion = "v2",
        ClientRequestId = clientRequestId,
        StartedAt = DateTime.UtcNow,
        QueuedAt = DateTime.UtcNow,
    };
}
```

- [ ] **Step 7: Run the schema tests and verify they fail**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter "FullyQualifiedName~AIRunSchemaTests"`
Expected: FAIL to compile before Steps 1–5 are applied; PASS after. If `DuplicateClientRequestIdForSameUser_IsRejected` passes but `ProgressEvents_ReplayInInsertionOrder` fails, the `DbSet` registration in Step 5 was missed.

- [ ] **Step 8: Generate the migration**

```powershell
dotnet ef migrations add AddDurableAIRuns --project server/FitMate.DB --startup-project server/FitMate.Web
```

Then **open the generated migration and verify by reading it**:
- Every new `AIRun`/`AIConversation`/`AIMessage` column is nullable or has a default. Existing production rows must remain readable. `ClientRequestId` is `NOT NULL` on the entity — the migration must add it with `defaultValue: ""`.
- `AttemptCount` and `HasSideEffects` add with defaults `0` and `false`.
- The unique index on `(UserId, ClientRequestId)` is created. **Backfill first**: existing rows all get `""`, which collides. Insert a raw SQL step *before* the index creation that gives historical rows distinct values:

```csharp
migrationBuilder.Sql(
    "UPDATE \"AIRuns\" SET \"ClientRequestId\" = 'legacy-' || \"Id\" WHERE \"ClientRequestId\" = '';");
```

- [ ] **Step 9: Verify the migration applies and the suite is green**

Run: `dotnet build server/FitMate.sln` then `dotnet test server/FitMate.Tests/FitMate.Tests.csproj`
Expected: build succeeds, all tests pass. `EnsureCreated()` in `SqliteTestDatabase` builds from the model, not migrations, so a broken migration will not surface here — the read-through in Step 8 is the real check.

---

## Task 3: Idempotent run starter

**Files:**
- Create: `server/FitMate.Services/AI/Runs/IAIRunStarter.cs`
- Create: `server/FitMate.Services/AI/Runs/AIRunStarter.cs`
- Create: `server/FitMate.Services/AI/Runs/IAIProgressService.cs`
- Create: `server/FitMate.Services/AI/Runs/AIProgressService.cs`
- Create: `server/FitMate.Services/AI/Runs/AIProgressCodes.cs`
- Modify: `server/FitMate.Services/AI/AIConversationService.cs`, `IAIConversationService.cs`
- Test: `server/FitMate.Tests/Unit/Services/AIRunStarterTests.cs`

**Interfaces:**
- Consumes: `StartAIRunResponse`, `SendAIMessageRequest.ClientRequestId` (Task 1); `AIRunStatus.Queued`, `AIRun` queue fields (Task 2).
- Produces: `IAIRunStarter.StartAsync(long conversationId, SendAIMessageRequest request, long userId) → Task<StartAIRunResponse>`; `IAIProgressService.PublishAsync(long runId, string code, string? toolName = null, CancellationToken ct = default) → Task`; `IAIProgressService.GetEventsAsync(long runId, long afterEventId, CancellationToken ct) → Task<IReadOnlyList<AIProgressEventModel>>`; `AIProgressCodes` constants; `IAIConversationService.AddUserMessageAsync(long, string, long, long? runId)`.

- [ ] **Step 1: Define the progress vocabulary**

`server/FitMate.Services/AI/Runs/AIProgressCodes.cs`:

```csharp
namespace FitMate.Services.AI.Runs;

/// <summary>
/// The complete set of stages the client can be told about. Codes are stable identifiers the UI
/// maps to copy; adding one here without adding a label leaves the UI showing the raw code.
/// </summary>
public static class AIProgressCodes
{
    public const string RunQueued = "run_queued";
    public const string RunStarted = "run_started";
    public const string ProviderThinking = "provider_thinking";
    public const string ToolStarted = "tool_started";
    public const string ToolCompleted = "tool_completed";
    public const string ToolFailed = "tool_failed";
    public const string ResponseComposing = "response_composing";
    public const string RunCompleted = "run_completed";
    public const string RunFailed = "run_failed";
    public const string RunLimited = "run_limited";
    public const string RunCancelled = "run_cancelled";

    private static readonly HashSet<string> Terminal =
        [RunCompleted, RunFailed, RunLimited, RunCancelled];

    public static bool IsTerminal(string code) => Terminal.Contains(code);
}
```

- [ ] **Step 2: Write the progress service**

`server/FitMate.Services/AI/Runs/IAIProgressService.cs`:

```csharp
using FitMate.Core.JsonModels.AI;

namespace FitMate.Services.AI.Runs;

/// <summary>Appends and reads the sanitized run timeline the client is allowed to see.</summary>
public interface IAIProgressService
{
    Task PublishAsync(long runId, string code, string? toolName = null, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AIProgressEventModel>> GetEventsAsync(
        long runId,
        long afterEventId,
        CancellationToken cancellationToken = default);
}
```

`server/FitMate.Services/AI/Runs/AIProgressService.cs`:

```csharp
using FitMate.Core.JsonModels.AI;
using FitMate.DB;
using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.AI.Runs;

public class AIProgressService : IAIProgressService
{
    private readonly AppDbContext dbContext;

    public AIProgressService(AppDbContext dbContext)
    {
        this.dbContext = dbContext;
    }

    public async Task PublishAsync(
        long runId,
        string code,
        string? toolName = null,
        CancellationToken cancellationToken = default)
    {
        dbContext.AIProgressEvents.Add(new AIProgressEvent
        {
            AIRunId = runId,
            Code = code,
            ToolName = toolName,
        });

        // Terminal events must land even when the run was cancelled, otherwise an observer
        // waits forever on a stream that will never close.
        await dbContext.SaveChangesAsync(
            AIProgressCodes.IsTerminal(code) ? CancellationToken.None : cancellationToken);
    }

    public async Task<IReadOnlyList<AIProgressEventModel>> GetEventsAsync(
        long runId,
        long afterEventId,
        CancellationToken cancellationToken = default) =>
        await dbContext.AIProgressEvents
            .AsNoTracking()
            .Where(x => x.AIRunId == runId && x.Id > afterEventId)
            .OrderBy(x => x.Id)
            .Select(x => new AIProgressEventModel
            {
                Id = x.Id,
                Code = x.Code,
                ToolName = x.ToolName,
                OccurredAt = x.DateCreated,
            })
            .ToListAsync(cancellationToken);
}
```

- [ ] **Step 3: Let the conversation service stamp messages with a run**

In `server/FitMate.Services/AI/AIConversationService.cs`, thread an optional `runId` through. Change the private helper signature and the four public writers:

```csharp
    private async Task<AIMessage> AddMessageAsync(
        AIConversation conversation,
        long userId,
        AIMessageRole role,
        string content,
        string? toolName = null,
        string? toolCallId = null,
        string? metadataJson = null,
        long? runId = null)
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
            AIRunId = runId,
        };

        dbContext.AIMessages.Add(message);
        conversation.LastMessageAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync();

        return message;
    }
```

Add `long? runId = null` as a trailing optional parameter to `AddUserMessageAsync`, `AddAssistantMessageAsync`, `AddToolCallMessageAsync` and `AddToolResultMessageAsync`, pass it into `AddMessageAsync`, and mirror the new parameter on `IAIConversationService`. Optional parameters keep every existing call site compiling unchanged.

- [ ] **Step 4: Write the failing starter tests**

`server/FitMate.Tests/Unit/Services/AIRunStarterTests.cs`:

```csharp
using FitMate.Core.JsonModels.AI;
using FitMate.DB;
using FitMate.DB.Enums;
using FitMate.Services.AI;
using FitMate.Services.AI.Runs;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Tests.Unit.Services;

public class AIRunStarterTests
{
    [Fact]
    public async Task Start_EnqueuesRunAndReturnsBeforeAnyProviderCall()
    {
        using var db = new SqliteTestDatabase();
        var harness = await StarterHarness.CreateAsync(db);

        var response = await harness.Starter.StartAsync(
            harness.ConversationId,
            new SendAIMessageRequest { Content = "hello", ClientRequestId = "req-1" },
            SqliteTestDatabase.UserId);

        Assert.Equal(AIRunStatus.Queued, response.Status);
        Assert.True(response.RunId > 0);
        Assert.Equal("hello", response.UserMessage.Content);
        Assert.Empty(harness.Provider.Requests);
    }

    [Fact]
    public async Task Start_WithDuplicateClientRequestId_ReturnsSameRunAndDoesNotReserveTwice()
    {
        using var db = new SqliteTestDatabase();
        var harness = await StarterHarness.CreateAsync(db);
        var request = new SendAIMessageRequest { Content = "hello", ClientRequestId = "req-1" };

        var first = await harness.Starter.StartAsync(harness.ConversationId, request, SqliteTestDatabase.UserId);
        var second = await harness.Starter.StartAsync(harness.ConversationId, request, SqliteTestDatabase.UserId);

        Assert.Equal(first.RunId, second.RunId);
        Assert.Equal(1, harness.Usage.ReserveCount);
        Assert.Equal(1, await harness.Context.AIRuns.CountAsync());
        Assert.Equal(1, await harness.Context.AIMessages.CountAsync(x => x.Role == AIMessageRole.User));
    }

    [Fact]
    public async Task Start_WhenAnotherRunIsActive_Throws()
    {
        using var db = new SqliteTestDatabase();
        var harness = await StarterHarness.CreateAsync(db);

        await harness.Starter.StartAsync(
            harness.ConversationId,
            new SendAIMessageRequest { Content = "first", ClientRequestId = "req-1" },
            SqliteTestDatabase.UserId);

        await Assert.ThrowsAsync<AIRunAlreadyActiveException>(() => harness.Starter.StartAsync(
            harness.ConversationId,
            new SendAIMessageRequest { Content = "second", ClientRequestId = "req-2" },
            SqliteTestDatabase.UserId));
    }

    [Fact]
    public async Task Start_WhenQuotaExhausted_CreatesNoMessageAndNoRun()
    {
        using var db = new SqliteTestDatabase();
        var harness = await StarterHarness.CreateAsync(db);
        harness.Usage.ThrowOnReserve = new Core.Exceptions.SubscriptionLimitExceededException("AIChat", 10, 10);

        await Assert.ThrowsAsync<Core.Exceptions.SubscriptionLimitExceededException>(() =>
            harness.Starter.StartAsync(
                harness.ConversationId,
                new SendAIMessageRequest { Content = "hello", ClientRequestId = "req-1" },
                SqliteTestDatabase.UserId));

        Assert.Equal(0, await harness.Context.AIRuns.CountAsync());
        Assert.Equal(0, await harness.Context.AIMessages.CountAsync());
    }

    [Fact]
    public async Task Start_PublishesQueuedProgressEvent()
    {
        using var db = new SqliteTestDatabase();
        var harness = await StarterHarness.CreateAsync(db);

        var response = await harness.Starter.StartAsync(
            harness.ConversationId,
            new SendAIMessageRequest { Content = "hello", ClientRequestId = "req-1" },
            SqliteTestDatabase.UserId);

        var codes = await harness.Context.AIProgressEvents
            .Where(x => x.AIRunId == response.RunId)
            .Select(x => x.Code)
            .ToListAsync();

        Assert.Equal([AIProgressCodes.RunQueued], codes);
    }

    [Fact]
    public async Task Start_LinksUserMessageAndReservationToTheRun()
    {
        using var db = new SqliteTestDatabase();
        var harness = await StarterHarness.CreateAsync(db);

        var response = await harness.Starter.StartAsync(
            harness.ConversationId,
            new SendAIMessageRequest { Content = "hello", ClientRequestId = "req-1" },
            SqliteTestDatabase.UserId);

        var run = await harness.Context.AIRuns.SingleAsync();
        Assert.Equal(response.UserMessage.Id, run.UserMessageId);
        Assert.NotNull(run.UsageReservationId);
        Assert.NotNull(run.ExecutionBudgetJson);

        var conversation = await harness.Context.AIConversations.SingleAsync();
        Assert.Equal(run.Id, conversation.ActiveRunId);
    }
}
```

Add `StarterHarness` to `server/FitMate.Tests/TestInfrastructure/StarterHarness.cs`, following the construction pattern already in `AIOrchestratorTests.CreateAsync` (same `AIRedactionService`, `AIConversationService`, `FakeAIBudgetResolver`, `FakeUsageService`, `FakeEntitlementService`, `AIPromptBuilder`). It exposes `Starter`, `Context`, `Provider`, `Usage`, `ConversationId`.

`FakeUsageService` needs `ReserveCount` and `ThrowOnReserve` if it does not already have them — add them rather than reshaping existing members.

- [ ] **Step 5: Run the starter tests and verify they fail**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter "FullyQualifiedName~AIRunStarterTests"`
Expected: FAIL to compile — `IAIRunStarter` and `AIRunAlreadyActiveException` do not exist.

- [ ] **Step 6: Add the conflict exception**

`server/FitMate.Services/AI/Runs/AIRunAlreadyActiveException.cs`:

```csharp
namespace FitMate.Services.AI.Runs;

/// <summary>
/// A conversation already has a run in flight. Overlapping turns would interleave tool traffic
/// and double-charge quota, so the second request is refused rather than queued.
/// </summary>
public class AIRunAlreadyActiveException : Exception
{
    public AIRunAlreadyActiveException(long conversationId, long activeRunId)
        : base("This conversation is still working on the previous message.")
    {
        ConversationId = conversationId;
        ActiveRunId = activeRunId;
    }

    public long ConversationId { get; }
    public long ActiveRunId { get; }
}
```

- [ ] **Step 7: Implement the starter**

`server/FitMate.Services/AI/Runs/IAIRunStarter.cs`:

```csharp
using FitMate.Core.JsonModels.AI;

namespace FitMate.Services.AI.Runs;

/// <summary>
/// Accepts a message and enqueues a run. Everything that can reject the request — plan, quota,
/// ownership, length — happens here, before a worker or a provider call is involved.
/// </summary>
public interface IAIRunStarter
{
    Task<StartAIRunResponse> StartAsync(long conversationId, SendAIMessageRequest request, long userId);
}
```

`server/FitMate.Services/AI/Runs/AIRunStarter.cs`:

```csharp
using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.AI;
using FitMate.Core.Settings;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Integrations.AI.Serialization;
using FitMate.Services.Subscriptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace FitMate.Services.AI.Runs;

public class AIRunStarter : IAIRunStarter
{
    private const int MaximumClientRequestIdLength = 64;

    private readonly AppDbContext dbContext;
    private readonly IAIConversationService conversationService;
    private readonly IAIBudgetResolver budgetResolver;
    private readonly IEntitlementService entitlementService;
    private readonly IUsageService usageService;
    private readonly IAIProgressService progressService;
    private readonly IAIPromptBuilder promptBuilder;
    private readonly AIOptions options;

    public AIRunStarter(
        AppDbContext dbContext,
        IAIConversationService conversationService,
        IAIBudgetResolver budgetResolver,
        IEntitlementService entitlementService,
        IUsageService usageService,
        IAIProgressService progressService,
        IAIPromptBuilder promptBuilder,
        IOptions<AIOptions> options)
    {
        this.dbContext = dbContext;
        this.conversationService = conversationService;
        this.budgetResolver = budgetResolver;
        this.entitlementService = entitlementService;
        this.usageService = usageService;
        this.progressService = progressService;
        this.promptBuilder = promptBuilder;
        this.options = options.Value;
    }

    public async Task<StartAIRunResponse> StartAsync(
        long conversationId,
        SendAIMessageRequest request,
        long userId)
    {
        if (string.IsNullOrWhiteSpace(request.Content))
        {
            throw new FitMateException("The message cannot be empty.");
        }

        if (string.IsNullOrWhiteSpace(request.ClientRequestId)
            || request.ClientRequestId.Length > MaximumClientRequestIdLength)
        {
            throw new FitMateException("The request is missing a valid client request id.");
        }

        var existing = await FindExistingAsync(userId, request.ClientRequestId);
        if (existing != null)
        {
            return existing;
        }

        await entitlementService.RequireFeatureAsync(userId, SubscriptionFeature.AIChat);

        var budget = await budgetResolver.ResolveAsync(userId);

        if (request.Content.Length > budget.MaximumMessageCharacters)
        {
            throw new FitMateException(
                $"That message is too long. Please keep it under {budget.MaximumMessageCharacters:N0} characters.");
        }

        var conversation = await dbContext.AIConversations
            .FirstOrDefaultAsync(x => x.Id == conversationId
                && x.UserId == userId
                && x.Status != AIConversationStatus.Deleted)
            ?? throw new FitMateException("Conversation not found.");

        if (conversation.ActiveRunId is { } activeRunId)
        {
            throw new AIRunAlreadyActiveException(conversationId, activeRunId);
        }

        // One transaction: a visible user message with no run and no recoverable reservation is
        // the one state the user cannot get out of.
        await using var transaction = await dbContext.Database.BeginTransactionAsync();

        try
        {
            var reservation = await usageService.ReserveAsync(userId, SubscriptionFeature.AIChat, 1);
            var userMessage = await conversationService.AddUserMessageAsync(conversationId, request.Content, userId);

            var now = DateTime.UtcNow;
            var run = new AIRun
            {
                UserId = userId,
                ConversationId = conversationId,
                UserMessageId = userMessage.Id,
                UsageReservationId = reservation.Id,
                ClientRequestId = request.ClientRequestId,
                Status = AIRunStatus.Queued,
                Provider = options.Provider,
                Model = budget.Model,
                PromptVersion = promptBuilder.SystemPromptVersion,
                ExecutionBudgetJson = AIJsonSerializer.Serialize(budget),
                StartedAt = now,
                QueuedAt = now,
                NextAttemptAt = now,
            };

            dbContext.AIRuns.Add(run);
            await dbContext.SaveChangesAsync();

            // Claim the conversation only if nobody else did between the read above and here.
            var claimed = await dbContext.AIConversations
                .Where(x => x.Id == conversationId && x.ActiveRunId == null)
                .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.ActiveRunId, run.Id));

            if (claimed != 1)
            {
                await transaction.RollbackAsync();
                throw new AIRunAlreadyActiveException(conversationId, 0);
            }

            await conversationService.SetRunOnMessageAsync(userMessage.Id, run.Id);
            await progressService.PublishAsync(run.Id, AIProgressCodes.RunQueued);

            await transaction.CommitAsync();

            return new StartAIRunResponse
            {
                ConversationId = conversationId,
                RunId = run.Id,
                Status = AIRunStatus.Queued,
                UserMessage = userMessage,
            };
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    private async Task<StartAIRunResponse?> FindExistingAsync(long userId, string clientRequestId)
    {
        var run = await dbContext.AIRuns
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.UserId == userId && x.ClientRequestId == clientRequestId);

        if (run == null)
        {
            return null;
        }

        var message = await dbContext.AIMessages
            .AsNoTracking()
            .Where(x => x.Id == run.UserMessageId)
            .Select(x => new AIMessageModel
            {
                Id = x.Id,
                Role = x.Role,
                Content = x.Content,
                ToolName = x.ToolName,
                DateCreated = x.DateCreated,
            })
            .FirstOrDefaultAsync();

        return new StartAIRunResponse
        {
            ConversationId = run.ConversationId,
            RunId = run.Id,
            Status = run.Status,
            UserMessage = message ?? new AIMessageModel { Id = 0, Role = AIMessageRole.User, Content = string.Empty },
        };
    }
}
```

Add `SetRunOnMessageAsync` to `IAIConversationService` and `AIConversationService`:

```csharp
    public async Task SetRunOnMessageAsync(long messageId, long runId)
    {
        await dbContext.AIMessages
            .Where(x => x.Id == messageId)
            .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.AIRunId, runId));
    }
```

**Verify before moving on:** `UsageService` must take `AppDbContext` by constructor injection (scoped, same instance) for `ReserveAsync` to enrol in the transaction opened above. Open `server/FitMate.Services/Subscriptions/UsageService.cs` and confirm. If it resolves its own context or opens its own transaction, refactor it to accept the caller's `AppDbContext` — do not work around this by moving the reservation outside the transaction.

- [ ] **Step 8: Run the starter tests and verify they pass**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter "FullyQualifiedName~AIRunStarterTests"`
Expected: all six PASS.

---

## Task 4: Queue claim and worker

**Files:**
- Create: `server/FitMate.Services/AI/Runs/IAIRunQueue.cs`
- Create: `server/FitMate.Services/AI/Runs/AIRunQueue.cs`
- Create: `server/FitMate.Services/AI/Runs/AIRunOptions.cs`
- Create: `server/FitMate.Web/Infrastructure/AIRunWorkerHostedService.cs`
- Modify: `server/FitMate.Web/Program.cs`
- Modify: `server/FitMate.Web/appsettings.json`
- Test: `server/FitMate.Tests/Unit/Services/AIRunQueueTests.cs`

**Interfaces:**
- Consumes: `AIRun` queue fields, `AIRunStatus.Queued` (Task 2); `AIProgressCodes` (Task 3).
- Produces: `IAIRunQueue.ClaimNextAsync(string workerId, DateTime utcNow, CancellationToken ct) → Task<long?>`; `RenewLeaseAsync(long runId, string workerId, DateTime utcNow, CancellationToken ct) → Task<bool>`; `RequeueSafeAsync(long runId, string workerId, DateTime nextAttemptAt, CancellationToken ct) → Task<bool>`; `ReclaimStaleAsync(DateTime utcNow, CancellationToken ct) → Task<int>`; `AIRunOptions`.

- [ ] **Step 1: Add the options type**

`server/FitMate.Services/AI/Runs/AIRunOptions.cs`:

```csharp
namespace FitMate.Services.AI.Runs;

public class AIRunOptions
{
    public const string SectionName = "AI:AsyncRuns";

    /// <summary>Turn off on an instance that should serve HTTP only. There is no second orchestration path.</summary>
    public bool WorkerEnabled { get; set; } = true;

    public int PollIntervalMilliseconds { get; set; } = 500;

    /// <summary>Must exceed one provider timeout plus margin, or a live run gets reclaimed under itself.</summary>
    public int LeaseSeconds { get; set; } = 180;

    /// <summary>Attempts allowed only while the run has produced no side effects.</summary>
    public int MaximumSafeAttempts { get; set; } = 2;

    public int RetryBackoffSeconds { get; set; } = 5;
}
```

- [ ] **Step 2: Write the failing queue tests**

`server/FitMate.Tests/Unit/Services/AIRunQueueTests.cs`:

```csharp
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.AI.Runs;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace FitMate.Tests.Unit.Services;

public class AIRunQueueTests
{
    private static readonly DateTime Now = new(2026, 8, 11, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task ClaimNext_ReturnsQueuedRun_AndMarksItRunning()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var runId = await SeedQueuedRunAsync(context);
        var queue = NewQueue(context);

        var claimed = await queue.ClaimNextAsync("worker-a", Now, CancellationToken.None);

        Assert.Equal(runId, claimed);

        var run = await context.AIRuns.AsNoTracking().SingleAsync();
        Assert.Equal(AIRunStatus.Running, run.Status);
        Assert.Equal("worker-a", run.LeaseOwner);
        Assert.Equal(1, run.AttemptCount);
        Assert.NotNull(run.ProcessingStartedAt);
        Assert.True(run.LeaseExpiresAt > Now);
    }

    [Fact]
    public async Task ClaimNext_TwoWorkers_OnlyOneWins()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        await SeedQueuedRunAsync(context);

        var first = await NewQueue(context).ClaimNextAsync("worker-a", Now, CancellationToken.None);
        var second = await NewQueue(db.CreateContext()).ClaimNextAsync("worker-b", Now, CancellationToken.None);

        Assert.NotNull(first);
        Assert.Null(second);
    }

    [Fact]
    public async Task ClaimNext_SkipsRunsWhoseNextAttemptIsInTheFuture()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        await SeedQueuedRunAsync(context, nextAttemptAt: Now.AddMinutes(5));
        var queue = NewQueue(context);

        Assert.Null(await queue.ClaimNextAsync("worker-a", Now, CancellationToken.None));
    }

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

    [Fact]
    public async Task ReclaimStale_RequeuesExpiredLeaseWithNoSideEffects_AndFailsOneWithThem()
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
        Assert.Equal(AIRunStatus.Failed, (await context.AIRuns.AsNoTracking().SingleAsync(x => x.Id == dirtyId)).Status);
    }

    private static AIRunQueue NewQueue(FitMate.DB.AppDbContext context, int maximumSafeAttempts = 2) =>
        new(context, Options.Create(new AIRunOptions { LeaseSeconds = 180, MaximumSafeAttempts = maximumSafeAttempts }));

    private static async Task<long> SeedQueuedRunAsync(
        FitMate.DB.AppDbContext context,
        DateTime? nextAttemptAt = null,
        string clientRequestId = "req-1")
    {
        var conversation = await context.AIConversations
            .FirstOrDefaultAsync(x => x.UserId == SqliteTestDatabase.UserId);

        if (conversation == null)
        {
            conversation = new AIConversation
            {
                UserId = SqliteTestDatabase.UserId,
                Status = AIConversationStatus.Active,
                LastMessageAt = Now,
            };
            context.AIConversations.Add(conversation);
            await context.SaveChangesAsync();
        }

        var run = new AIRun
        {
            UserId = SqliteTestDatabase.UserId,
            ConversationId = conversation.Id,
            Status = AIRunStatus.Queued,
            Provider = "OpenAI",
            Model = "test-model",
            PromptVersion = "v2",
            ClientRequestId = clientRequestId,
            StartedAt = Now,
            QueuedAt = Now,
            NextAttemptAt = nextAttemptAt ?? Now,
        };

        context.AIRuns.Add(run);
        await context.SaveChangesAsync();
        return run.Id;
    }
}
```

- [ ] **Step 3: Run the queue tests and verify they fail**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter "FullyQualifiedName~AIRunQueueTests"`
Expected: FAIL to compile — `AIRunQueue` does not exist.

- [ ] **Step 4: Implement the queue**

`server/FitMate.Services/AI/Runs/IAIRunQueue.cs`:

```csharp
namespace FitMate.Services.AI.Runs;

/// <summary>
/// The claim/lease protocol. Every state transition here is a single conditional UPDATE whose
/// affected-row count decides the outcome, so two workers can never both own one run.
/// </summary>
public interface IAIRunQueue
{
    /// <summary>Claims one eligible run, or null when the queue is empty. Returns the claimed run id.</summary>
    Task<long?> ClaimNextAsync(string workerId, DateTime utcNow, CancellationToken cancellationToken);

    /// <summary>Extends the lease. False means the lease was lost and the worker must stop.</summary>
    Task<bool> RenewLeaseAsync(long runId, string workerId, DateTime utcNow, CancellationToken cancellationToken);

    /// <summary>Returns a run to the queue. Refused once the run has side effects or attempts are spent.</summary>
    Task<bool> RequeueSafeAsync(long runId, string workerId, DateTime nextAttemptAt, CancellationToken cancellationToken);

    /// <summary>Requeues or fails runs whose lease expired. Returns how many were touched.</summary>
    Task<int> ReclaimStaleAsync(DateTime utcNow, CancellationToken cancellationToken);
}
```

`server/FitMate.Services/AI/Runs/AIRunQueue.cs`:

```csharp
using FitMate.DB;
using FitMate.DB.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace FitMate.Services.AI.Runs;

public class AIRunQueue : IAIRunQueue
{
    private readonly AppDbContext dbContext;
    private readonly AIRunOptions options;

    public AIRunQueue(AppDbContext dbContext, IOptions<AIRunOptions> options)
    {
        this.dbContext = dbContext;
        this.options = options.Value;
    }

    public async Task<long?> ClaimNextAsync(string workerId, DateTime utcNow, CancellationToken cancellationToken)
    {
        // Candidates are read unlocked and then claimed conditionally: losing the race costs one
        // wasted UPDATE, which is cheaper than holding a row lock across the whole loop.
        var candidates = await dbContext.AIRuns
            .AsNoTracking()
            .Where(x => x.Status == AIRunStatus.Queued
                && (x.NextAttemptAt == null || x.NextAttemptAt <= utcNow))
            .OrderBy(x => x.QueuedAt)
            .Select(x => x.Id)
            .Take(10)
            .ToListAsync(cancellationToken);

        foreach (var candidateId in candidates)
        {
            var claimed = await dbContext.AIRuns
                .Where(x => x.Id == candidateId && x.Status == AIRunStatus.Queued)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(x => x.Status, AIRunStatus.Running)
                    .SetProperty(x => x.LeaseOwner, workerId)
                    .SetProperty(x => x.LeaseExpiresAt, utcNow.AddSeconds(options.LeaseSeconds))
                    .SetProperty(x => x.HeartbeatAt, utcNow)
                    .SetProperty(x => x.ProcessingStartedAt, utcNow)
                    .SetProperty(x => x.AttemptCount, x => x.AttemptCount + 1),
                    cancellationToken);

            if (claimed == 1)
            {
                return candidateId;
            }
        }

        return null;
    }

    public async Task<bool> RenewLeaseAsync(
        long runId,
        string workerId,
        DateTime utcNow,
        CancellationToken cancellationToken)
    {
        var renewed = await dbContext.AIRuns
            .Where(x => x.Id == runId && x.LeaseOwner == workerId && x.Status == AIRunStatus.Running)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(x => x.HeartbeatAt, utcNow)
                .SetProperty(x => x.LeaseExpiresAt, utcNow.AddSeconds(options.LeaseSeconds)),
                cancellationToken);

        return renewed == 1;
    }

    public async Task<bool> RequeueSafeAsync(
        long runId,
        string workerId,
        DateTime nextAttemptAt,
        CancellationToken cancellationToken)
    {
        var requeued = await dbContext.AIRuns
            .Where(x => x.Id == runId
                && x.LeaseOwner == workerId
                && !x.HasSideEffects
                && x.AttemptCount < options.MaximumSafeAttempts)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(x => x.Status, AIRunStatus.Queued)
                .SetProperty(x => x.LeaseOwner, (string?)null)
                .SetProperty(x => x.LeaseExpiresAt, (DateTime?)null)
                .SetProperty(x => x.NextAttemptAt, nextAttemptAt),
                cancellationToken);

        return requeued == 1;
    }

    public async Task<int> ReclaimStaleAsync(DateTime utcNow, CancellationToken cancellationToken)
    {
        var safe = await dbContext.AIRuns
            .Where(x => x.Status == AIRunStatus.Running
                && x.LeaseExpiresAt != null
                && x.LeaseExpiresAt < utcNow
                && !x.HasSideEffects
                && x.AttemptCount < options.MaximumSafeAttempts)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(x => x.Status, AIRunStatus.Queued)
                .SetProperty(x => x.LeaseOwner, (string?)null)
                .SetProperty(x => x.LeaseExpiresAt, (DateTime?)null)
                .SetProperty(x => x.NextAttemptAt, utcNow),
                cancellationToken);

        // Anything past a tool call cannot be replayed: a second pass could create a duplicate
        // proposal or charge generation quota twice. Fail it and let the user retry deliberately.
        var abandoned = await dbContext.AIRuns
            .Where(x => x.Status == AIRunStatus.Running
                && x.LeaseExpiresAt != null
                && x.LeaseExpiresAt < utcNow)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(x => x.Status, AIRunStatus.Failed)
                .SetProperty(x => x.ErrorCode, "run_interrupted")
                .SetProperty(x => x.ErrorMessage, "The run was interrupted and could not be resumed.")
                .SetProperty(x => x.CompletedAt, utcNow)
                .SetProperty(x => x.LeaseOwner, (string?)null)
                .SetProperty(x => x.LeaseExpiresAt, (DateTime?)null),
                cancellationToken);

        return safe + abandoned;
    }
}
```

- [ ] **Step 5: Run the queue tests and verify they pass**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter "FullyQualifiedName~AIRunQueueTests"`
Expected: all eight PASS.

- [ ] **Step 6: Write the worker**

`server/FitMate.Web/Infrastructure/AIRunWorkerHostedService.cs`:

```csharp
using FitMate.Services.AI;
using FitMate.Services.AI.Runs;
using Microsoft.Extensions.Options;

namespace FitMate.Web.Infrastructure;

/// <summary>
/// Owns run execution independently of any HTTP request. One scope per claimed run, so a run gets
/// its own AppDbContext and cannot be affected by a request that has already ended.
/// </summary>
public class AIRunWorkerHostedService : BackgroundService
{
    private readonly IServiceScopeFactory scopeFactory;
    private readonly ILogger<AIRunWorkerHostedService> logger;
    private readonly AIRunOptions options;
    private readonly string workerId = $"{Environment.MachineName}-{Guid.NewGuid():N}"[..Math.Min(100, 100)];

    public AIRunWorkerHostedService(
        IServiceScopeFactory scopeFactory,
        ILogger<AIRunWorkerHostedService> logger,
        IOptions<AIRunOptions> options)
    {
        this.scopeFactory = scopeFactory;
        this.logger = logger;
        this.options = options.Value;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.WorkerEnabled)
        {
            logger.LogInformation("AI run worker disabled by configuration.");
            return;
        }

        logger.LogInformation("AI run worker {WorkerId} started.", workerId);

        var lastReclaim = DateTime.UtcNow;

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (DateTime.UtcNow - lastReclaim > TimeSpan.FromSeconds(options.LeaseSeconds))
                {
                    lastReclaim = DateTime.UtcNow;
                    await ReclaimStaleAsync(stoppingToken);
                }

                var processed = await ClaimAndProcessOneAsync(stoppingToken);
                if (!processed)
                {
                    await Task.Delay(options.PollIntervalMilliseconds, stoppingToken);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "AI run worker loop iteration failed.");
                await Task.Delay(options.PollIntervalMilliseconds, CancellationToken.None);
            }
        }

        logger.LogInformation("AI run worker {WorkerId} stopped.", workerId);
    }

    private async Task<bool> ClaimAndProcessOneAsync(CancellationToken stoppingToken)
    {
        using var scope = scopeFactory.CreateScope();
        var queue = scope.ServiceProvider.GetRequiredService<IAIRunQueue>();

        var runId = await queue.ClaimNextAsync(workerId, DateTime.UtcNow, stoppingToken);
        if (runId == null)
        {
            return false;
        }

        var orchestrator = scope.ServiceProvider.GetRequiredService<IAIOrchestrator>();

        try
        {
            await orchestrator.ProcessAsync(runId.Value, workerId, stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Shutdown mid-run: hand it back only when replay is provably safe. The orchestrator
            // has already written a coherent terminal state otherwise.
            await queue.RequeueSafeAsync(runId.Value, workerId, DateTime.UtcNow, CancellationToken.None);
            throw;
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "AI run {RunId} failed in the worker.", runId.Value);
        }

        return true;
    }

    private async Task ReclaimStaleAsync(CancellationToken stoppingToken)
    {
        using var scope = scopeFactory.CreateScope();
        var queue = scope.ServiceProvider.GetRequiredService<IAIRunQueue>();
        var reclaimed = await queue.ReclaimStaleAsync(DateTime.UtcNow, stoppingToken);

        if (reclaimed > 0)
        {
            logger.LogWarning("Reclaimed {Count} stale AI runs.", reclaimed);
        }
    }
}
```

- [ ] **Step 7: Register everything**

In `server/FitMate.Web/Program.cs`, alongside the other AI service registrations:

```csharp
builder.Services.Configure<AIRunOptions>(builder.Configuration.GetSection(AIRunOptions.SectionName));
builder.Services.AddScoped<IAIRunStarter, AIRunStarter>();
builder.Services.AddScoped<IAIRunQueue, AIRunQueue>();
builder.Services.AddScoped<IAIProgressService, AIProgressService>();
builder.Services.AddHostedService<AIRunWorkerHostedService>();
```

Add to `server/FitMate.Web/appsettings.json` inside the existing `"AI"` object:

```json
    "AsyncRuns": {
      "WorkerEnabled": true,
      "PollIntervalMilliseconds": 500,
      "LeaseSeconds": 180,
      "MaximumSafeAttempts": 2,
      "RetryBackoffSeconds": 5
    }
```

`AIOrchestrator.ProcessAsync` does not exist yet — Step 6 will not compile until Task 5. Write the worker now, then build at the end of Task 5.

---

## Task 5: Extract and instrument orchestration

**Files:**
- Modify: `server/FitMate.Services/AI/IAIOrchestrator.cs`
- Modify: `server/FitMate.Services/AI/AIOrchestrator.cs`
- Modify: `server/FitMate.Services/AI/IAIRunService.cs`, `AIRunService.cs`
- Modify: `server/FitMate.Services/AI/Tools/AIToolRegistry.cs`
- Modify: `server/FitMate.Tests/Unit/Services/AIOrchestratorTests.cs`
- Test: `server/FitMate.Tests/Unit/Services/AIRunProgressTests.cs`

**Interfaces:**
- Consumes: `IAIProgressService`, `AIProgressCodes` (Task 3); `IAIRunQueue` (Task 4).
- Produces: `IAIOrchestrator.ProcessAsync(long runId, string workerId, CancellationToken ct) → Task`; `IAIRunService.MarkSideEffectsAsync(long runId)`; `IAIRunService.ClearActiveRunAsync(long conversationId, long runId)`.

- [ ] **Step 1: Write the failing progress tests**

`server/FitMate.Tests/Unit/Services/AIRunProgressTests.cs`:

```csharp
using FitMate.Core.JsonModels.AI;
using FitMate.DB.Enums;
using FitMate.Services.AI.Runs;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Tests.Unit.Services;

public class AIRunProgressTests
{
    [Fact]
    public async Task NoToolRun_EmitsQueuedStartedThinkingCompleted()
    {
        using var db = new SqliteTestDatabase();
        var provider = new FakeAICompletionProvider().EnqueueText("Done.");
        var harness = await WorkerHarness.CreateAsync(db, provider);

        var start = await harness.Starter.StartAsync(
            harness.ConversationId,
            new SendAIMessageRequest { Content = "hi", ClientRequestId = "req-1" },
            SqliteTestDatabase.UserId);

        await harness.ProcessNextAsync();

        var codes = await harness.Context.AIProgressEvents
            .Where(x => x.AIRunId == start.RunId)
            .OrderBy(x => x.Id)
            .Select(x => x.Code)
            .ToListAsync();

        Assert.Equal(
            [
                AIProgressCodes.RunQueued,
                AIProgressCodes.RunStarted,
                AIProgressCodes.ProviderThinking,
                AIProgressCodes.RunCompleted,
            ],
            codes);
    }

    [Fact]
    public async Task ToolRun_EmitsToolStartedAndCompletedWithToolName_AndNoPayloads()
    {
        using var db = new SqliteTestDatabase();
        var provider = new FakeAICompletionProvider()
            .EnqueueToolCall("call-1", "get_training_profile", """{"secret":"do-not-leak"}""")
            .EnqueueText("Here you go.");
        var harness = await WorkerHarness.CreateAsync(db, provider, [new StubToolHandler("get_training_profile")]);

        var start = await harness.Starter.StartAsync(
            harness.ConversationId,
            new SendAIMessageRequest { Content = "profile?", ClientRequestId = "req-1" },
            SqliteTestDatabase.UserId);

        await harness.ProcessNextAsync();

        var events = await harness.Context.AIProgressEvents
            .Where(x => x.AIRunId == start.RunId)
            .OrderBy(x => x.Id)
            .ToListAsync();

        Assert.Contains(events, x => x.Code == AIProgressCodes.ToolStarted && x.ToolName == "get_training_profile");
        Assert.Contains(events, x => x.Code == AIProgressCodes.ToolCompleted && x.ToolName == "get_training_profile");
        Assert.Contains(events, x => x.Code == AIProgressCodes.ResponseComposing);
        Assert.All(events, x => Assert.DoesNotContain("secret", x.Code));
        Assert.All(events, x => Assert.DoesNotContain("do-not-leak", x.ToolName ?? string.Empty));
    }

    [Fact]
    public async Task CompletedRun_ClearsActiveRunAndCommitsQuotaOnce()
    {
        using var db = new SqliteTestDatabase();
        var provider = new FakeAICompletionProvider().EnqueueText("Done.");
        var harness = await WorkerHarness.CreateAsync(db, provider);

        await harness.Starter.StartAsync(
            harness.ConversationId,
            new SendAIMessageRequest { Content = "hi", ClientRequestId = "req-1" },
            SqliteTestDatabase.UserId);

        await harness.ProcessNextAsync();

        var conversation = await harness.Context.AIConversations.AsNoTracking().SingleAsync();
        Assert.Null(conversation.ActiveRunId);
        Assert.Equal(1, harness.Usage.CommitCount);
        Assert.Equal(0, harness.Usage.ReleaseCount);
    }

    [Fact]
    public async Task FailedRun_EmitsOneTerminalEvent_ReleasesQuota_AndClearsActiveRun()
    {
        using var db = new SqliteTestDatabase();
        var provider = new FakeAICompletionProvider { ThrowOnCall = new InvalidOperationException("boom") };
        var harness = await WorkerHarness.CreateAsync(db, provider);

        var start = await harness.Starter.StartAsync(
            harness.ConversationId,
            new SendAIMessageRequest { Content = "hi", ClientRequestId = "req-1" },
            SqliteTestDatabase.UserId);

        await harness.ProcessNextAsync();

        var terminal = await harness.Context.AIProgressEvents
            .Where(x => x.AIRunId == start.RunId && x.Code == AIProgressCodes.RunFailed)
            .CountAsync();

        Assert.Equal(1, terminal);
        Assert.Equal(1, harness.Usage.ReleaseCount);
        Assert.Equal(0, harness.Usage.CommitCount);

        var conversation = await harness.Context.AIConversations.AsNoTracking().SingleAsync();
        Assert.Null(conversation.ActiveRunId);

        var run = await harness.Context.AIRuns.AsNoTracking().SingleAsync();
        Assert.Equal(AIRunStatus.Failed, run.Status);
        Assert.DoesNotContain("boom", run.ErrorMessage ?? string.Empty);
    }

    [Fact]
    public async Task ToolExecution_SetsHasSideEffects()
    {
        using var db = new SqliteTestDatabase();
        var provider = new FakeAICompletionProvider()
            .EnqueueToolCall("call-1", "get_training_profile", "{}")
            .EnqueueText("Done.");
        var harness = await WorkerHarness.CreateAsync(db, provider, [new StubToolHandler("get_training_profile")]);

        await harness.Starter.StartAsync(
            harness.ConversationId,
            new SendAIMessageRequest { Content = "hi", ClientRequestId = "req-1" },
            SqliteTestDatabase.UserId);

        await harness.ProcessNextAsync();

        var run = await harness.Context.AIRuns.AsNoTracking().SingleAsync();
        Assert.True(run.HasSideEffects);
    }
}
```

Add `WorkerHarness` to `server/FitMate.Tests/TestInfrastructure/WorkerHarness.cs`. It builds the same graph as `StarterHarness` plus an `AIOrchestrator` and an `AIRunQueue`, and exposes `ProcessNextAsync()`:

```csharp
    public async Task ProcessNextAsync()
    {
        var runId = await Queue.ClaimNextAsync("test-worker", DateTime.UtcNow, CancellationToken.None);
        if (runId != null)
        {
            await Orchestrator.ProcessAsync(runId.Value, "test-worker", CancellationToken.None);
        }
    }
```

- [ ] **Step 2: Run the progress tests and verify they fail**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter "FullyQualifiedName~AIRunProgressTests"`
Expected: FAIL to compile — `ProcessAsync` does not exist.

- [ ] **Step 3: Add the run-service lifecycle methods**

Add to `IAIRunService` and `AIRunService`:

```csharp
    /// <summary>
    /// Marks the run as past the point of safe replay. Called before the first tool executes, not
    /// after: a crash mid-tool must still be treated as having had side effects.
    /// </summary>
    public async Task MarkSideEffectsAsync(long runId)
    {
        await dbContext.AIRuns
            .Where(x => x.Id == runId && !x.HasSideEffects)
            .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.HasSideEffects, true));
    }

    /// <summary>Releases the one-active-run guard. Safe to call twice.</summary>
    public async Task ClearActiveRunAsync(long conversationId, long runId)
    {
        await dbContext.AIConversations
            .Where(x => x.Id == conversationId && x.ActiveRunId == runId)
            .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.ActiveRunId, (long?)null));
    }
```

Also change `Finish` so duration measures worker execution, not queue wait:

```csharp
    private static void Finish(AIRun run)
    {
        run.CompletedAt = DateTime.UtcNow;
        var from = run.ProcessingStartedAt ?? run.StartedAt;
        run.DurationMilliseconds = (int)Math.Max(0, (run.CompletedAt.Value - from).TotalMilliseconds);
    }
```

- [ ] **Step 4: Publish tool progress from the registry**

In `AIToolRegistry`, inject `IAIProgressService` and publish inside the existing execution lifecycle so the audit row and the UI event cannot disagree. Add the field and constructor parameter, then:

After the initial `dbContext.SaveChangesAsync(cancellationToken)` that persists the `Running` execution row:

```csharp
        await progressService.PublishAsync(
            context.AIRunId, AIProgressCodes.ToolStarted, toolCall.Name, cancellationToken);
```

Inside `CompleteAsync`, after the save:

```csharp
        await progressService.PublishAsync(
            execution.AIRunId,
            status == AIToolExecutionStatus.Completed ? AIProgressCodes.ToolCompleted : AIProgressCodes.ToolFailed,
            execution.ToolName,
            cancellationToken);
```

Update `AIOrchestratorTests.CreateAsync` and any other `new AIToolRegistry(...)` call site to pass `new AIProgressService(context)`.

- [ ] **Step 5: Rewrite the orchestrator as a processor**

`server/FitMate.Services/AI/IAIOrchestrator.cs`:

```csharp
namespace FitMate.Services.AI;

/// <summary>
/// Runs one queued AI run to a terminal state. Never returns a user-facing payload: the client
/// reads the outcome from the run snapshot, so orchestration is independent of any HTTP request.
/// </summary>
public interface IAIOrchestrator
{
    Task ProcessAsync(long runId, string workerId, CancellationToken cancellationToken);
}
```

Rewrite `AIOrchestrator`. The tool loop body is unchanged from the current implementation — reuse it verbatim except for the substitutions listed below. Do not redesign the loop.

Changes to make:
1. Constructor: drop `IEntitlementService` if only used for `BuildUsageAsync` (the snapshot service builds usage now); add `IAIRunQueue`, `IAIProgressService`, `AppDbContext`.
2. `ProcessAsync` loads the run by id, deserializes `ExecutionBudgetJson` into `AIBudget` (falling back to `budgetResolver.ResolveAsync` if null), and derives `conversationId`/`userId`/`model` from the run row rather than parameters.
3. Emit `run_started` immediately after load; `provider_thinking` before the first `CompleteAsync`; `response_composing` before any `CompleteAsync` that follows a tool batch.
4. Before the `foreach (var toolCall in ...)` loop, call `await runService.MarkSideEffectsAsync(run.Id);`.
5. Pass `run.Id` as the new trailing `runId` argument to every `conversationService.Add*MessageAsync` call.
6. Combine the caller token with the budget timeout: `using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken); timeout.CancelAfter(TimeSpan.FromSeconds(budget.TimeoutSeconds));`
7. Renew the lease before each provider call and each tool batch: `if (!await runQueue.RenewLeaseAsync(run.Id, workerId, DateTime.UtcNow, cancellationToken)) { return; }` — a lost lease means another worker owns the run; stop without writing a terminal state.
8. Replace each `return new SendAIMessageResponse {...}` with the matching terminal sequence. Success:

```csharp
                    var assistantMessage = await conversationService.AddAssistantMessageAsync(
                        conversationId, providerResponse.Text, userId, runId: run.Id);

                    await runService.CompleteAsync(run.Id, assistantMessage.Id);
                    await usageService.CommitAsync(reservationId);
                    await FinishAsync(run, AIProgressCodes.RunCompleted);
                    return;
```

9. `StopWithNoticeAsync` keeps its body but returns `Task` and ends with `await FinishAsync(run, AIProgressCodes.RunLimited);`.
10. The `catch (Exception)` block keeps `FailAsync` + `ReleaseAsync` + the readable-thread assistant notice, then `await FinishAsync(run, AIProgressCodes.RunFailed);` and **does not rethrow** — the worker has no caller to surface an exception to, and rethrowing would bypass the terminal event.
11. Add a `catch (OperationCanceledException)` before the general catch that writes `AIRunStatus.Cancelled` and `run_cancelled` only when the run already has side effects; otherwise rethrow so the worker can requeue it safely.
12. Add the shared terminal helper:

```csharp
    /// <summary>
    /// Every exit path funnels through here, so the active-run guard is always released and the
    /// observer stream always sees exactly one terminal event.
    /// </summary>
    private async Task FinishAsync(AIRun run, string terminalCode)
    {
        await runService.ClearActiveRunAsync(run.ConversationId, run.Id);
        await progressService.PublishAsync(run.Id, terminalCode);
    }
```

- [ ] **Step 6: Update the characterization test to the new entry point**

In `AIOrchestratorTests`, replace direct `SendAsync(...)` calls with the `WorkerHarness` start-then-process pattern from Step 1. The assertions — quota committed once, run completed, tool executions recorded — must be unchanged. If any assertion has to be weakened to pass, stop: that is a behavior regression, not a test that needs updating.

- [ ] **Step 7: Build and run the full backend suite**

Run: `dotnet build server/FitMate.sln` then `dotnet test server/FitMate.Tests/FitMate.Tests.csproj`
Expected: build succeeds (the worker from Task 4 Step 6 now compiles), all tests pass. `AIController` still calls `orchestrator.SendAsync` and will not compile — fix it in Task 6 Step 4, or temporarily point it at `IAIRunStarter` now.

---

## Task 6: Snapshot, event stream and rehydration APIs

**Files:**
- Create: `server/FitMate.Services/AI/Runs/IAIRunSnapshotService.cs`, `AIRunSnapshotService.cs`
- Create: `server/FitMate.Web/Controllers/AIRunController.cs`
- Modify: `server/FitMate.Web/Controllers/AIController.cs`
- Modify: `server/FitMate.Services/AI/AIConversationService.cs`
- Delete: `server/FitMate.Core/JsonModels/AI/SendAIMessageResponse.cs`
- Test: `server/FitMate.Tests/Integration/AIRunApiTests.cs`

**Interfaces:**
- Consumes: `AIRunSnapshotModel`, `AIActiveRunModel` (Task 1); `IAIProgressService` (Task 3); `IAIRunStarter` (Task 3).
- Produces: `IAIRunSnapshotService.GetAsync(long runId, long userId, long afterEventId = 0) → Task<AIRunSnapshotModel?>`; routes `POST /api/ai/conversations/{id}/messages` (202), `GET /api/ai/runs/{runId}`, `GET /api/ai/runs/{runId}/events`.

- [ ] **Step 1: Write the failing API tests**

`server/FitMate.Tests/Integration/AIRunApiTests.cs`, following the existing `AIApiTests` fixture pattern:

```csharp
[Fact]
public async Task SendMessage_Returns202WithRunId()
{
    var client = factory.CreateAuthenticatedClient(SqliteTestDatabase.UserId);
    var conversation = await CreateConversationAsync(client);

    var response = await client.PostAsJsonAsync(
        $"/api/ai/conversations/{conversation.Id}/messages",
        new SendAIMessageRequest { Content = "hello", ClientRequestId = Guid.NewGuid().ToString() });

    Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
    var started = await ReadJsonDataAsync<StartAIRunResponse>(response);
    Assert.True(started.RunId > 0);
    Assert.Equal(AIRunStatus.Queued, started.Status);
}

[Fact]
public async Task GetRunSnapshot_ForAnotherUsersRun_ReturnsNotFound()
{
    var owner = factory.CreateAuthenticatedClient(SqliteTestDatabase.UserId);
    var conversation = await CreateConversationAsync(owner);
    var started = await StartRunAsync(owner, conversation.Id);

    var intruder = factory.CreateAuthenticatedClient(SqliteTestDatabase.OtherUserId);
    var response = await intruder.GetAsync($"/api/ai/runs/{started.RunId}");

    Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
}

[Fact]
public async Task GetRunSnapshot_ReplaysOnlyEventsAfterCursor()
{
    var client = factory.CreateAuthenticatedClient(SqliteTestDatabase.UserId);
    var conversation = await CreateConversationAsync(client);
    var started = await StartRunAsync(client, conversation.Id);

    var full = await ReadJsonDataAsync<AIRunSnapshotModel>(
        await client.GetAsync($"/api/ai/runs/{started.RunId}"));
    Assert.NotEmpty(full.Events);

    var after = await ReadJsonDataAsync<AIRunSnapshotModel>(
        await client.GetAsync($"/api/ai/runs/{started.RunId}?afterEventId={full.LastEventId}"));
    Assert.Empty(after.Events);
    Assert.Equal(full.LastEventId, after.LastEventId);
}

[Fact]
public async Task SecondMessageWhileRunActive_Returns409()
{
    var client = factory.CreateAuthenticatedClient(SqliteTestDatabase.UserId);
    var conversation = await CreateConversationAsync(client);
    await StartRunAsync(client, conversation.Id);

    var response = await client.PostAsJsonAsync(
        $"/api/ai/conversations/{conversation.Id}/messages",
        new SendAIMessageRequest { Content = "again", ClientRequestId = Guid.NewGuid().ToString() });

    Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
}

[Fact]
public async Task GetConversation_IncludesActiveRunAndPendingActions()
{
    var client = factory.CreateAuthenticatedClient(SqliteTestDatabase.UserId);
    var conversation = await CreateConversationAsync(client);
    var started = await StartRunAsync(client, conversation.Id);

    var reloaded = await ReadJsonDataAsync<AIConversationModel>(
        await client.GetAsync($"/api/ai/conversations/{conversation.Id}"));

    Assert.NotNull(reloaded.ActiveRun);
    Assert.Equal(started.RunId, reloaded.ActiveRun!.RunId);
    Assert.NotNull(reloaded.Actions);
}
```

The integration fixture must register a `FakeAICompletionProvider` and set `AI:AsyncRuns:WorkerEnabled` to `false`, so runs stay `Queued` and assertions are deterministic. Check how `AIApiTests` currently overrides services and follow the same mechanism.

- [ ] **Step 2: Run the API tests and verify they fail**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter "FullyQualifiedName~AIRunApiTests"`
Expected: FAIL — routes do not exist.

- [ ] **Step 3: Implement the snapshot service**

`server/FitMate.Services/AI/Runs/IAIRunSnapshotService.cs`:

```csharp
using FitMate.Core.JsonModels.AI;

namespace FitMate.Services.AI.Runs;

/// <summary>Assembles everything the client needs to rebuild a run's UI state from scratch.</summary>
public interface IAIRunSnapshotService
{
    Task<AIRunSnapshotModel?> GetAsync(long runId, long userId, long afterEventId = 0);
}
```

`server/FitMate.Services/AI/Runs/AIRunSnapshotService.cs`:

```csharp
using FitMate.Core.JsonModels.AI;
using FitMate.DB;
using FitMate.DB.Enums;
using FitMate.Services.AIActions;
using FitMate.Services.Subscriptions;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.AI.Runs;

public class AIRunSnapshotService : IAIRunSnapshotService
{
    private readonly AppDbContext dbContext;
    private readonly IAIProgressService progressService;
    private readonly IAIActionService actionService;
    private readonly IEntitlementService entitlementService;

    public AIRunSnapshotService(
        AppDbContext dbContext,
        IAIProgressService progressService,
        IAIActionService actionService,
        IEntitlementService entitlementService)
    {
        this.dbContext = dbContext;
        this.progressService = progressService;
        this.actionService = actionService;
        this.entitlementService = entitlementService;
    }

    public async Task<AIRunSnapshotModel?> GetAsync(long runId, long userId, long afterEventId = 0)
    {
        // Ownership is part of the lookup, so another user's run is indistinguishable from a missing one.
        var run = await dbContext.AIRuns
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == runId && x.UserId == userId);

        if (run == null)
        {
            return null;
        }

        var events = await progressService.GetEventsAsync(runId, afterEventId);

        var lastEventId = await dbContext.AIProgressEvents
            .Where(x => x.AIRunId == runId)
            .OrderByDescending(x => x.Id)
            .Select(x => x.Id)
            .FirstOrDefaultAsync();

        var currentCode = await dbContext.AIProgressEvents
            .Where(x => x.AIRunId == runId)
            .OrderByDescending(x => x.Id)
            .Select(x => x.Code)
            .FirstOrDefaultAsync() ?? AIProgressCodes.RunQueued;

        AIMessageModel? assistantMessage = null;
        if (run.AssistantMessageId is { } assistantMessageId)
        {
            assistantMessage = await dbContext.AIMessages
                .AsNoTracking()
                .Where(x => x.Id == assistantMessageId)
                .Select(x => new AIMessageModel
                {
                    Id = x.Id,
                    Role = x.Role,
                    Content = x.Content,
                    ToolName = x.ToolName,
                    DateCreated = x.DateCreated,
                })
                .FirstOrDefaultAsync();
        }

        var actions = await actionService.ListForConversationAsync(run.ConversationId, userId);
        var availability = await entitlementService.GetAvailabilityAsync(userId, SubscriptionFeature.AIChat);

        return new AIRunSnapshotModel
        {
            Id = run.Id,
            ConversationId = run.ConversationId,
            Status = run.Status,
            CurrentProgressCode = currentCode,
            LastEventId = lastEventId,
            Events = [.. events],
            AssistantMessage = assistantMessage,
            Actions = [.. actions],
            Usage = new AIUsageSummaryModel
            {
                Feature = nameof(SubscriptionFeature.AIChat),
                Used = availability.Used,
                Limit = availability.Limit,
                Remaining = availability.Remaining,
            },
            PublicErrorCode = run.Status is AIRunStatus.Failed or AIRunStatus.LimitExceeded
                ? run.ErrorCode
                : null,
        };
    }
}
```

- [ ] **Step 4: Switch the send route to `202`**

In `AIController`, replace `IAIOrchestrator orchestrator` with `IAIRunStarter runStarter` and rewrite `SendMessage`:

```csharp
    [HttpPost("conversations/{conversationId:long}/messages")]
    public async Task<ActionResult> SendMessage(long conversationId, [FromBody] SendAIMessageRequest request)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        try
        {
            var started = await runStarter.StartAsync(conversationId, request, userId.Value);
            return Accepted(this.ReturnJson(started));
        }
        catch (AIRunAlreadyActiveException)
        {
            return Conflict(this.ReturnJsonError("This conversation is still working on the previous message."));
        }
    }
```

Confirm the exact envelope `ReturnJson`/`ReturnJsonError` produce in `ControllerExtensions` and match it — the frontend `unwrap()` helper depends on that shape. If `Accepted(...)` cannot wrap the existing envelope cleanly, set `Response.StatusCode = StatusCodes.Status202Accepted;` and return `this.ReturnJson(started)` instead.

- [ ] **Step 5: Add the run controller with snapshot and SSE**

`server/FitMate.Web/Controllers/AIRunController.cs`:

```csharp
using FitMate.DB;
using FitMate.DB.Enums;
using FitMate.Services.AI.Runs;
using FitMate.Services.Users;
using FitMate.Web.Controllers.Base;
using FitMate.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text;

namespace FitMate.Web.Controllers;

[Authorize]
[Route("api/ai/runs")]
public class AIRunController : BaseApiController
{
    private static readonly TimeSpan HeartbeatInterval = TimeSpan.FromSeconds(15);
    private static readonly TimeSpan PollInterval = TimeSpan.FromMilliseconds(750);

    private readonly IAIRunSnapshotService snapshotService;
    private readonly IAIProgressService progressService;

    public AIRunController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService,
        IAIRunSnapshotService snapshotService,
        IAIProgressService progressService)
        : base(logger, dbContext, userService)
    {
        this.snapshotService = snapshotService;
        this.progressService = progressService;
    }

    [HttpGet("{runId:long}")]
    public async Task<ActionResult> GetSnapshot(long runId, [FromQuery] long afterEventId = 0)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var snapshot = await snapshotService.GetAsync(runId, userId.Value, afterEventId);

        return snapshot == null ? NotFound() : this.ReturnJson(snapshot);
    }

    /// <summary>
    /// Observer stream. RequestAborted stops this stream only — the run belongs to the worker and
    /// must never be cancelled because a browser tab closed.
    /// </summary>
    [HttpGet("{runId:long}/events")]
    public async Task StreamEvents(long runId, [FromQuery] long afterEventId = 0)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            Response.StatusCode = StatusCodes.Status401Unauthorized;
            return;
        }

        var owned = await DbContext.AIRuns.AsNoTracking()
            .AnyAsync(x => x.Id == runId && x.UserId == userId.Value);

        if (!owned)
        {
            Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }

        Response.ContentType = "text/event-stream";
        Response.Headers.CacheControl = "no-cache";
        Response.Headers.Connection = "keep-alive";
        Response.Headers["X-Accel-Buffering"] = "no";

        var cursor = ResolveCursor(afterEventId);
        var lastHeartbeat = DateTime.UtcNow;
        var streamToken = HttpContext.RequestAborted;

        while (!streamToken.IsCancellationRequested)
        {
            var events = await progressService.GetEventsAsync(runId, cursor, streamToken);

            foreach (var progressEvent in events)
            {
                cursor = progressEvent.Id;

                var payload = new StringBuilder()
                    .Append("id: ").Append(progressEvent.Id).Append('\n')
                    .Append("event: progress\n")
                    .Append("data: ")
                    .Append(System.Text.Json.JsonSerializer.Serialize(progressEvent))
                    .Append("\n\n")
                    .ToString();

                await Response.WriteAsync(payload, streamToken);
                await Response.Body.FlushAsync(streamToken);

                if (AIProgressCodes.IsTerminal(progressEvent.Code))
                {
                    return;
                }
            }

            if (DateTime.UtcNow - lastHeartbeat > HeartbeatInterval)
            {
                lastHeartbeat = DateTime.UtcNow;
                await Response.WriteAsync(": heartbeat\n\n", streamToken);
                await Response.Body.FlushAsync(streamToken);
            }

            // A run that reached a terminal state before this observer connected would otherwise
            // hold the connection open forever.
            var status = await DbContext.AIRuns.AsNoTracking()
                .Where(x => x.Id == runId)
                .Select(x => x.Status)
                .FirstOrDefaultAsync(streamToken);

            if (status is not (AIRunStatus.Queued or AIRunStatus.Running) && events.Count == 0)
            {
                return;
            }

            await Task.Delay(PollInterval, streamToken);
        }
    }

    private long ResolveCursor(long afterEventId)
    {
        if (Request.Headers.TryGetValue("Last-Event-ID", out var header)
            && long.TryParse(header.ToString(), out var fromHeader))
        {
            return fromHeader;
        }

        return afterEventId;
    }
}
```

Wrap the `while` loop in `try { ... } catch (OperationCanceledException) { }` so a disconnecting client does not log an error.

- [ ] **Step 6: Add active run and actions to conversation reads**

In `AIConversationService.GetByIdAsync`, after building `messages`:

```csharp
        AIActiveRunModel? activeRun = null;
        if (conversation.ActiveRunId is { } activeRunId)
        {
            activeRun = await dbContext.AIRuns
                .AsNoTracking()
                .Where(x => x.Id == activeRunId)
                .Select(x => new AIActiveRunModel
                {
                    RunId = x.Id,
                    Status = x.Status,
                    CurrentProgressCode = x.ProgressEvents
                        .OrderByDescending(e => e.Id)
                        .Select(e => e.Code)
                        .FirstOrDefault() ?? string.Empty,
                    LastEventId = x.ProgressEvents
                        .OrderByDescending(e => e.Id)
                        .Select(e => e.Id)
                        .FirstOrDefault(),
                })
                .FirstOrDefaultAsync();
        }

        var actions = await actionService.ListForConversationAsync(conversationId, userId);
```

Set both on the returned `AIConversationModel`. Inject `IAIActionService` into `AIConversationService`. **Check for a DI cycle first** — if `AIActionService` depends on `IAIConversationService`, do not inject it; query `dbContext.AIActions` directly in this method instead.

- [ ] **Step 7: Delete the obsolete response DTO**

Delete `server/FitMate.Core/JsonModels/AI/SendAIMessageResponse.cs`. Build and fix every reference — the compiler will list them.

- [ ] **Step 8: Register the snapshot service and run all backend checks**

Add to `Program.cs`: `builder.Services.AddScoped<IAIRunSnapshotService, AIRunSnapshotService>();`

Run: `dotnet build server/FitMate.sln` then `dotnet test server/FitMate.Tests/FitMate.Tests.csproj`
Expected: build succeeds, all tests pass including the five new API tests.

- [ ] **Step 9: Regenerate frontend types**

Run: `dotnet build server/FitMate.Web/FitMate.Web.csproj` then from `client/`: `npm run process-types`
Expected: `client/src/types/` gains `StartAIRunResponse`, `AIRunSnapshotModel`, `AIProgressEventModel`, `AIActiveRunModel`, and loses `SendAIMessageResponse`. Confirm by reading the generated file — do not hand-write any of these.

---

## Task 7: React progress UX

**Files:**
- Create: `client/src/pages/AICoach/progressLabels.ts`
- Create: `client/src/pages/AICoach/hooks/useAIRunProgress.ts`
- Modify: `client/src/services/aiService.ts`
- Modify: `client/src/pages/AICoach/hooks/useAICoachPage.ts`
- Modify: `client/src/pages/AICoach/AICoach.tsx`
- Modify: `client/src/pages/AICoach/components/ToolActivityIndicator.tsx`

**Interfaces:**
- Consumes: generated `StartAIRunResponse`, `AIRunSnapshotModel`, `AIProgressEventModel`, `AIActiveRunModel`, `AIRunStatus` (Task 6 Step 9).
- Produces: `useAIRunProgress({ runId, onTerminal }) → { events, currentCode, isActive }`; `aiService.startMessage`, `aiService.getRunSnapshot`.

- [ ] **Step 1: Add the label maps**

`client/src/pages/AICoach/progressLabels.ts`:

```ts
export const PROGRESS_LABELS: Record<string, string> = {
  run_queued: "Preparing your request",
  run_started: "Thinking",
  provider_thinking: "Planning the next step",
  response_composing: "Writing the answer",
};

export const TOOL_LABELS: Record<string, string> = {
  get_workout_creation_context: "Reviewing your workout context",
  get_training_profile: "Reviewing your training profile",
  get_recent_workouts: "Checking recent workouts",
  get_exercise_history: "Reviewing recent performance",
  search_exercises: "Finding suitable exercises",
  get_workout_templates: "Checking your workout templates",
  get_active_program: "Checking your active program",
  get_program_calendar: "Checking your training calendar",
  get_subscription_usage: "Checking your plan",
  propose_workout: "Preparing your workout suggestion",
  propose_workout_template: "Preparing your template suggestion",
  propose_program_plan: "Preparing your program suggestion",
  propose_program_update: "Preparing your program update",
  propose_exercise: "Preparing a new exercise",
  report_unsupported_request: "Noting your request",
};

export function progressLabel(code: string, toolName?: string | null): string | null {
  if (toolName) {
    return TOOL_LABELS[toolName] ?? "Working on your request";
  }

  return PROGRESS_LABELS[code] ?? null;
}
```

`tool_completed` and `tool_failed` deliberately have no run-level label — the tool name drives the copy, and an unmapped tool falls back to a generic line rather than leaking the raw tool identifier.

- [ ] **Step 2: Add the service calls**

Replace `sendMessage` in `client/src/services/aiService.ts` and add two calls. Import the generated types only:

```ts
  async startMessage(id: number, payload: SendAIMessageRequest) {
    return api.post<JsonData<StartAIRunResponse>>(`ai/conversations/${id}/messages`, payload);
  },

  async getRunSnapshot(runId: number, afterEventId = 0) {
    return api.get<JsonData<AIRunSnapshotModel>>(
      `ai/runs/${runId}?afterEventId=${afterEventId}`,
    );
  },

  runEventsUrl(runId: number, afterEventId = 0) {
    return `${api.defaults.baseURL ?? ""}ai/runs/${runId}/events?afterEventId=${afterEventId}`;
  },
```

Update the type import block to add `StartAIRunResponse` and `AIRunSnapshotModel` and drop `SendAIMessageResponse`. Verify `api.defaults.baseURL` matches how `client/src/lib/api.ts` is configured — `EventSource` cannot go through the Axios instance, so the URL must be built to the same origin and path prefix. Cookies are same-origin, so no auth header is needed.

- [ ] **Step 3: Write the progress hook**

`client/src/pages/AICoach/hooks/useAIRunProgress.ts`:

```ts
import { useEffect, useRef, useState } from "react";
import { unwrap } from "@/lib/unwrap";
import { aiService } from "@/services/aiService";
import { AIRunStatus, type AIProgressEventModel } from "@/types";

const TERMINAL_CODES = new Set(["run_completed", "run_failed", "run_limited", "run_cancelled"]);
const POLL_INTERVAL_MS = 1_200;

type UseAIRunProgressOptions = {
  runId: number | null;
  onTerminal: (runId: number) => void;
};

/// Observes one run. The EventSource is the fast path; polling takes over if it never opens or
/// drops, so a proxy that buffers SSE degrades to slightly slower updates rather than a stuck UI.
export function useAIRunProgress({ runId, onTerminal }: UseAIRunProgressOptions) {
  const [events, setEvents] = useState<AIProgressEventModel[]>([]);
  const cursorRef = useRef(0);
  const terminalRef = useRef(false);

  useEffect(() => {
    if (runId == null) {
      setEvents([]);
      cursorRef.current = 0;
      terminalRef.current = false;
      return;
    }

    let cancelled = false;
    let source: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    function accept(incoming: AIProgressEventModel[]) {
      if (cancelled || incoming.length === 0) {
        return;
      }

      cursorRef.current = Math.max(cursorRef.current, ...incoming.map((x) => x.id));
      setEvents((current) => [...current, ...incoming]);

      const terminal = incoming.find((x) => TERMINAL_CODES.has(x.code));
      if (terminal && !terminalRef.current) {
        terminalRef.current = true;
        onTerminal(runId!);
      }
    }

    async function pollOnce() {
      if (cancelled || terminalRef.current) {
        return;
      }

      try {
        const response = await aiService.getRunSnapshot(runId!, cursorRef.current);
        const snapshot = unwrap(response.data, "Unable to read run progress.");
        accept(snapshot.events);

        if (snapshot.status !== AIRunStatus.Queued && snapshot.status !== AIRunStatus.Running) {
          if (!terminalRef.current) {
            terminalRef.current = true;
            onTerminal(runId!);
          }
        }
      } catch {
        // Polling is the fallback of last resort; a failed tick simply retries on the next one.
      }
    }

    function startPolling() {
      if (pollTimer != null) {
        return;
      }

      pollTimer = setInterval(pollOnce, POLL_INTERVAL_MS);
      void pollOnce();
    }

    async function start() {
      // Replay first: a run that started before this component mounted has history to catch up on.
      await pollOnce();

      if (cancelled || terminalRef.current) {
        return;
      }

      try {
        source = new EventSource(aiService.runEventsUrl(runId!, cursorRef.current), {
          withCredentials: true,
        });

        source.addEventListener("progress", (message) => {
          const parsed = JSON.parse((message as MessageEvent<string>).data) as AIProgressEventModel;
          accept([parsed]);
        });

        source.onerror = () => {
          source?.close();
          source = null;
          startPolling();
        };
      } catch {
        startPolling();
      }
    }

    void start();

    return () => {
      cancelled = true;
      source?.close();

      if (pollTimer != null) {
        clearInterval(pollTimer);
      }
    };
  }, [runId, onTerminal]);

  const currentCode = events.length > 0 ? events[events.length - 1].code : "run_queued";

  return { events, currentCode, isActive: runId != null && !terminalRef.current };
}
```

Note the cleanup closes only the `EventSource` and clears the timer. It never calls a cancellation endpoint — leaving the page must not stop the run.

- [ ] **Step 4: Rewrite the page hook to start-and-observe**

In `client/src/pages/AICoach/hooks/useAICoachPage.ts`:

Replace `activeTools` state with `activeRunId`:

```ts
  const [activeRunId, setActiveRunId] = useState<number | null>(null);
```

Rewrite `send`:

```ts
  const send = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || activeRunId != null) {
        return;
      }

      setError(null);

      try {
        let target = activeConversation;
        if (!target) {
          const created = await aiService.createConversation();
          target = unwrap(created.data, "Unable to start a conversation.");
        }

        const response = await aiService.startMessage(target.id, {
          content: trimmed,
          clientRequestId: crypto.randomUUID(),
        });
        const started = unwrap(response.data, "The assistant could not accept that message.");

        setActiveConversation({ ...target, messages: [...target.messages, started.userMessage] });
        setActiveRunId(started.runId);
      } catch (sendError) {
        setError(
          sendError instanceof Error
            ? sendError.message
            : "The assistant is unavailable right now. Please try again.",
        );
      }
    },
    [activeConversation, activeRunId],
  );
```

The optimistic negative-id message is gone — the `202` already returns the persisted user message, so there is nothing to reconcile.

Add the terminal handler and wire the hook:

```ts
  const handleRunTerminal = useCallback(async () => {
    setActiveRunId(null);

    if (activeConversation) {
      await openConversation(activeConversation.id, true);
      await loadConversations();
    }
  }, [activeConversation, loadConversations, openConversation]);

  const { events, currentCode } = useAIRunProgress({
    runId: activeRunId,
    onTerminal: handleRunTerminal,
  });
```

In `openConversation`, adopt the server's active run and actions:

```ts
      const conversation = unwrap(response.data, "Unable to open the conversation.");
      setActiveConversation(conversation);
      setActions(conversation.actions);
      setActiveRunId(conversation.activeRun?.runId ?? null);
```

Delete the `keepActions` parameter and its call sites — actions now come from the server on every read, so there is nothing to preserve manually.

Return `progressEvents: events`, `currentProgressCode: currentCode`, `isSending: activeRunId != null` in the `state` object, and drop `activeTools`.

- [ ] **Step 5: Render event-keyed progress**

`client/src/pages/AICoach/components/ToolActivityIndicator.tsx`:

```tsx
import { progressLabel } from "../progressLabels";
import type { AIProgressEventModel } from "@/types";

type ToolActivityIndicatorProps = {
  events: AIProgressEventModel[];
  isSending: boolean;
};

export function ToolActivityIndicator({ events, isSending }: ToolActivityIndicatorProps) {
  if (!isSending) {
    return null;
  }

  const completed = events
    .filter((event) => event.code === "tool_completed")
    .map((event) => ({ id: event.id, label: progressLabel(event.code, event.toolName) }))
    .filter((entry): entry is { id: number; label: string } => entry.label != null);

  const latest = events[events.length - 1];
  const current = latest ? progressLabel(latest.code, latest.toolName) : null;

  return (
    <div className="px-1 py-2 text-xs text-muted">
      {completed.map((entry) => (
        <p key={entry.id} className="opacity-60">
          {entry.label}
        </p>
      ))}
      <p>{current ?? "Thinking"}</p>
    </div>
  );
}
```

Keying on `event.id` is what makes duplicate tool calls safe — two `search_exercises` calls in one run produced duplicate React keys under the old `tools: string[]` model.

- [ ] **Step 6: Update the page component**

In `client/src/pages/AICoach/AICoach.tsx`, change the `ToolActivityIndicator` usage from `tools={state.activeTools}` to `events={state.progressEvents}` and keep `isSending={state.isSending}`. Fix any other `activeTools` reference the compiler flags.

- [ ] **Step 7: Add the SSE proxy location**

In `client/nginx/default.conf.template`, add **before** the existing `location /api/` block (nginx prefers the longer prefix match, but ordering it first makes the intent explicit):

```nginx
    # SSE: the buffered /api/ proxy below would hold progress events until the response
    # completed, which defeats the point of streaming them.
    location /api/ai/runs/ {
        proxy_pass            ${BACKEND_ORIGIN};
        proxy_http_version    1.1;
        proxy_set_header      Host $proxy_host;
        proxy_set_header      X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header      X-Forwarded-Proto $scheme;
        proxy_ssl_server_name on;
        proxy_buffering       off;
        proxy_cache           off;
        proxy_read_timeout    300s;
        gzip                  off;
    }
```

- [ ] **Step 8: Lint, type-check and build the client**

Run from `client/`: `npm run lint`, then `npx tsc -b --noEmit`, then `npm run build`
Expected: all three clean. Fix every lint error before continuing.

- [ ] **Step 9: Manual verification**

Start the backend and client, then confirm each of these by hand:

1. Send a message, watch progress lines appear as tools run (not all at once at the end).
2. Mid-run, navigate to Workouts and back to AI Coach — the same run is still in progress and progress continues.
3. Mid-run, hard-refresh the page — the run reattaches and completes.
4. In DevTools, block the `/api/ai/runs/*/events` request; confirm the run still completes via polling.
5. Ask for a workout, and while the proposal is being prepared navigate away; return and confirm the action card is present.
6. Stop the backend mid-run, restart it, and confirm the run reaches a terminal state rather than hanging.

---

## Task 8: AI-specific query optimization

**Files:**
- Create: `server/FitMate.Services/AI/Context/AIContextModels.cs`
- Create: `server/FitMate.Services/AI/Context/IAITrainingContextQuery.cs`
- Create: `server/FitMate.Services/AI/Context/AITrainingContextQuery.cs`
- Modify: `server/FitMate.Services/AI/Tools/ReadOnly/GetWorkoutCreationContextToolHandler.cs`
- Modify: `server/FitMate.Services/AI/Tools/ReadOnly/GetRecentWorkoutsToolHandler.cs`
- Modify: `server/FitMate.Services/AI/Tools/ReadOnly/GetExerciseHistoryToolHandler.cs`
- Modify: `server/FitMate.Services/AI/Tools/Proposals/ProposeWorkoutToolHandler.cs`
- Modify: `server/FitMate.Web/Program.cs`
- Test: `server/FitMate.Tests/Unit/Services/AITrainingContextQueryTests.cs`

**Interfaces:**
- Consumes: nothing from earlier tasks — this is independent of the run pipeline.
- Produces: `IAITrainingContextQuery` with `GetRecentWorkoutsAsync`, `GetExerciseCandidatesAsync`, `GetLatestPerformanceAsync`, `GetMatchingTemplatesAsync`, `GetRecentMuscleExposureAsync`.

**Why:** `GetWorkoutCreationContextToolHandler` currently calls `workoutService.ListAsync(userId)` ([line 131](../../../server/FitMate.Services/AI/Tools/ReadOnly/GetWorkoutCreationContextToolHandler.cs#L131)), which materializes the user's entire workout graph including every set, then scans 12 workouts in memory. `GetRecentWorkoutsToolHandler` does the same to return 10. Both scale with total training history, not with what the model needs.

- [ ] **Step 1: Define the compact projections**

`server/FitMate.Services/AI/Context/AIContextModels.cs`:

```csharp
namespace FitMate.Services.AI.Context;

/// <summary>
/// AI-facing projections. Deliberately narrower than the UI models: no image or video URLs, no set
/// rows beyond the latest, no fields the prompt never reads.
/// </summary>
public sealed record AIRecentWorkoutModel(
    long Id,
    string? Title,
    DateTime? StartedAt,
    DateTime? FinishedAt,
    decimal? TotalVolumeKg,
    int? DurationSeconds,
    IReadOnlyList<AIRecentWorkoutExerciseModel> Exercises);

public sealed record AIRecentWorkoutExerciseModel(long ExerciseId, string ExerciseName, int SetCount);

public sealed record AIExerciseCandidateModel(
    long Id,
    string Name,
    long? PrimaryMuscleGroupId,
    string? PrimaryMuscleGroupName,
    string? SecondaryMuscleGroupName,
    string? Equipment,
    string? MovementPattern);

public sealed record AILatestExercisePerformanceModel(
    long ExerciseId,
    DateTime PerformedAt,
    decimal? WeightKg,
    IReadOnlyList<int> Reps);

public sealed record AIMatchingTemplateModel(long Id, string Name, int ExerciseCount);

public sealed record AIMuscleExposureModel(long MuscleGroupId, DateTime LastTrainedAt);
```

- [ ] **Step 2: Write the failing bounded-query tests**

`server/FitMate.Tests/Unit/Services/AITrainingContextQueryTests.cs`:

```csharp
using FitMate.Services.AI.Context;
using FitMate.Tests.TestInfrastructure;

namespace FitMate.Tests.Unit.Services;

public class AITrainingContextQueryTests
{
    [Fact]
    public async Task GetRecentWorkouts_RespectsTake_AndReturnsNewestFirst()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        await WorkoutSeed.AddWorkoutsAsync(context, SqliteTestDatabase.UserId, count: 30);

        var query = new AITrainingContextQuery(context);
        var result = await query.GetRecentWorkoutsAsync(SqliteTestDatabase.UserId, 10, CancellationToken.None);

        Assert.Equal(10, result.Count);
        Assert.True(result[0].StartedAt >= result[^1].StartedAt);
    }

    [Fact]
    public async Task GetExerciseCandidates_CapsResults_AndOmitsMediaUrls()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        await WorkoutSeed.AddExercisesAsync(context, count: 100, muscleGroupId: SqliteTestDatabase.ChestId);

        var query = new AITrainingContextQuery(context);
        var result = await query.GetExerciseCandidatesAsync(
            SqliteTestDatabase.UserId, [SqliteTestDatabase.ChestId], 12, CancellationToken.None);

        Assert.Equal(12, result.Count);
        Assert.All(result, x => Assert.False(string.IsNullOrWhiteSpace(x.Name)));
    }

    [Fact]
    public async Task GetLatestPerformance_ReturnsOnlyTheMostRecentRowPerExercise()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var exerciseId = await WorkoutSeed.AddExerciseWithHistoryAsync(
            context, SqliteTestDatabase.UserId, sessions: 5);

        var query = new AITrainingContextQuery(context);
        var result = await query.GetLatestPerformanceAsync(
            SqliteTestDatabase.UserId, [exerciseId], CancellationToken.None);

        Assert.Single(result);
        Assert.True(result.ContainsKey(exerciseId));
    }

    [Fact]
    public async Task GetLatestPerformance_WithEmptyIds_DoesNotQuery()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();

        var query = new AITrainingContextQuery(context);
        var result = await query.GetLatestPerformanceAsync(SqliteTestDatabase.UserId, [], CancellationToken.None);

        Assert.Empty(result);
    }

    [Fact]
    public async Task GetExerciseCandidates_CapsRequestedTakeToHardMaximum()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        await WorkoutSeed.AddExercisesAsync(context, count: 500, muscleGroupId: SqliteTestDatabase.ChestId);

        var query = new AITrainingContextQuery(context);
        var result = await query.GetExerciseCandidatesAsync(
            SqliteTestDatabase.UserId, [SqliteTestDatabase.ChestId], 10_000, CancellationToken.None);

        Assert.True(result.Count <= 100);
    }
}
```

Add `server/FitMate.Tests/TestInfrastructure/WorkoutSeed.cs` with `AddWorkoutsAsync`, `AddExercisesAsync` and `AddExerciseWithHistoryAsync`, matching the entity shapes in `server/FitMate.DB/Entities/Workout*.cs` and `Exercise.cs`. Read those entities before writing the seed rather than guessing property names.

- [ ] **Step 3: Run the query tests and verify they fail**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter "FullyQualifiedName~AITrainingContextQueryTests"`
Expected: FAIL to compile — `AITrainingContextQuery` does not exist.

- [ ] **Step 4: Implement the query service**

`server/FitMate.Services/AI/Context/IAITrainingContextQuery.cs`:

```csharp
namespace FitMate.Services.AI.Context;

/// <summary>
/// Bounded reads for AI context. Every method applies its ordering and limit in SQL, so cost tracks
/// the size of the answer rather than the size of the user's history.
/// </summary>
public interface IAITrainingContextQuery
{
    Task<IReadOnlyList<AIRecentWorkoutModel>> GetRecentWorkoutsAsync(
        long userId, int take, CancellationToken cancellationToken);

    Task<IReadOnlyList<AIExerciseCandidateModel>> GetExerciseCandidatesAsync(
        long userId, IReadOnlyCollection<long> muscleGroupIds, int take, CancellationToken cancellationToken);

    Task<IReadOnlyDictionary<long, AILatestExercisePerformanceModel>> GetLatestPerformanceAsync(
        long userId, IReadOnlyCollection<long> exerciseIds, CancellationToken cancellationToken);

    Task<IReadOnlyList<AIMatchingTemplateModel>> GetMatchingTemplatesAsync(
        long userId, IReadOnlyCollection<long> exerciseIds, int take, CancellationToken cancellationToken);

    Task<IReadOnlyList<AIMuscleExposureModel>> GetRecentMuscleExposureAsync(
        long userId, IReadOnlyCollection<long> muscleGroupIds, int workoutsToScan, CancellationToken cancellationToken);
}
```

`server/FitMate.Services/AI/Context/AITrainingContextQuery.cs`. The navigation path is `WorkoutExercise.WorkoutExerciseGroup.Workout` and sets are `WorkoutExercise.Sets` (`ExerciseSet`) — verified against the entity definitions, not assumed.

```csharp
using FitMate.DB;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.AI.Context;

public class AITrainingContextQuery : IAITrainingContextQuery
{
    private const int MaxWorkouts = 20;
    private const int MaxCandidates = 100;
    private const int MaxExerciseIds = 50;
    private const int MaxTemplates = 10;
    private const int MaxSetsPerExercise = 10;
    private const int MaxExercisesPerWorkout = 20;

    private readonly AppDbContext dbContext;

    public AITrainingContextQuery(AppDbContext dbContext)
    {
        this.dbContext = dbContext;
    }

    public async Task<IReadOnlyList<AIRecentWorkoutModel>> GetRecentWorkoutsAsync(
        long userId,
        int take,
        CancellationToken cancellationToken)
    {
        var limit = Math.Clamp(take, 1, MaxWorkouts);

        return await dbContext.Workouts
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.StartedAt ?? x.FinishedAt)
            .ThenByDescending(x => x.Id)
            .Take(limit)
            .Select(workout => new AIRecentWorkoutModel(
                workout.Id,
                workout.Title,
                workout.StartedAt,
                workout.FinishedAt,
                workout.TotalVolumeKg,
                workout.DurationSeconds,
                workout.ExerciseGroups
                    .OrderBy(group => group.SortOrder)
                    .SelectMany(group => group.Exercises)
                    .OrderBy(exercise => exercise.OrderIndex)
                    .Take(MaxExercisesPerWorkout)
                    .Select(exercise => new AIRecentWorkoutExerciseModel(
                        exercise.ExerciseId,
                        exercise.Exercise.Name,
                        exercise.Sets.Count))
                    .ToList()))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<AIExerciseCandidateModel>> GetExerciseCandidatesAsync(
        long userId,
        IReadOnlyCollection<long> muscleGroupIds,
        int take,
        CancellationToken cancellationToken)
    {
        var limit = Math.Clamp(take, 1, MaxCandidates);
        var groupIds = muscleGroupIds.Distinct().ToList();

        var query = dbContext.Exercises
            .AsNoTracking()
            .Where(x => x.IsPublic || x.UserId == userId);

        if (groupIds.Count > 0)
        {
            query = query.Where(x => groupIds.Contains(x.PrimaryMuscleGroupId)
                || (x.SecondaryMuscleGroupId != null && groupIds.Contains(x.SecondaryMuscleGroupId.Value)));
        }

        // No ImageUrl or VideoUrl: the model never sees media, and resolving them costs a
        // storage round trip per row in the UI path this deliberately does not reuse.
        return await query
            .OrderBy(x => x.Name)
            .Take(limit)
            .Select(x => new AIExerciseCandidateModel(
                x.Id,
                x.Name,
                x.PrimaryMuscleGroupId,
                x.PrimaryMuscleGroup.Name,
                x.SecondaryMuscleGroup != null ? x.SecondaryMuscleGroup.Name : null,
                x.Equipment != null ? x.Equipment.ToString() : null,
                x.MovementPattern != null ? x.MovementPattern.ToString() : null))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyDictionary<long, AILatestExercisePerformanceModel>> GetLatestPerformanceAsync(
        long userId,
        IReadOnlyCollection<long> exerciseIds,
        CancellationToken cancellationToken)
    {
        var ids = exerciseIds.Distinct().Take(MaxExerciseIds).ToList();
        if (ids.Count == 0)
        {
            return new Dictionary<long, AILatestExercisePerformanceModel>();
        }

        // Step one: the newest session id per exercise, decided in SQL. Grouping by exercise and
        // taking a max keeps this to one row per exercise instead of the full history.
        var newest = await dbContext.WorkoutExercises
            .AsNoTracking()
            .Where(x => ids.Contains(x.ExerciseId)
                && x.WorkoutExerciseGroup.Workout.UserId == userId
                && x.WorkoutExerciseGroup.Workout.StartedAt != null)
            .GroupBy(x => x.ExerciseId)
            .Select(group => new
            {
                ExerciseId = group.Key,
                PerformedAt = group.Max(x => x.WorkoutExerciseGroup.Workout.StartedAt!.Value),
            })
            .ToListAsync(cancellationToken);

        if (newest.Count == 0)
        {
            return new Dictionary<long, AILatestExercisePerformanceModel>();
        }

        var newestByExercise = newest.ToDictionary(x => x.ExerciseId, x => x.PerformedAt);

        // Step two: fetch only the rows that matched, with a capped set projection.
        var rows = await dbContext.WorkoutExercises
            .AsNoTracking()
            .Where(x => ids.Contains(x.ExerciseId)
                && x.WorkoutExerciseGroup.Workout.UserId == userId
                && x.WorkoutExerciseGroup.Workout.StartedAt != null)
            .Select(x => new
            {
                x.ExerciseId,
                PerformedAt = x.WorkoutExerciseGroup.Workout.StartedAt!.Value,
                Sets = x.Sets
                    .OrderBy(set => set.OrderIndex)
                    .Take(MaxSetsPerExercise)
                    .Select(set => new { set.WeightKg, set.Reps })
                    .ToList(),
            })
            .ToListAsync(cancellationToken);

        return rows
            .Where(x => newestByExercise.TryGetValue(x.ExerciseId, out var performedAt)
                && x.PerformedAt == performedAt)
            .GroupBy(x => x.ExerciseId)
            .ToDictionary(
                group => group.Key,
                group => new AILatestExercisePerformanceModel(
                    group.Key,
                    group.First().PerformedAt,
                    group.First().Sets.Select(set => set.WeightKg).FirstOrDefault(weight => weight != null),
                    group.First().Sets.Where(set => set.Reps != null).Select(set => set.Reps!.Value).ToList()));
    }

    public async Task<IReadOnlyList<AIMatchingTemplateModel>> GetMatchingTemplatesAsync(
        long userId,
        IReadOnlyCollection<long> exerciseIds,
        int take,
        CancellationToken cancellationToken)
    {
        var ids = exerciseIds.Distinct().Take(MaxExerciseIds).ToList();
        if (ids.Count == 0)
        {
            return [];
        }

        var limit = Math.Clamp(take, 1, MaxTemplates);

        return await dbContext.WorkoutTemplates
            .AsNoTracking()
            .Where(template => (template.IsPublic || template.UserId == userId)
                && template.ExerciseGroups
                    .SelectMany(group => group.Exercises)
                    .Any(exercise => ids.Contains(exercise.ExerciseId)))
            .OrderBy(template => template.Name)
            .Take(limit)
            .Select(template => new AIMatchingTemplateModel(
                template.Id,
                template.Name,
                template.ExerciseGroups.SelectMany(group => group.Exercises).Count()))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<AIMuscleExposureModel>> GetRecentMuscleExposureAsync(
        long userId,
        IReadOnlyCollection<long> muscleGroupIds,
        int workoutsToScan,
        CancellationToken cancellationToken)
    {
        var scan = Math.Clamp(workoutsToScan, 1, MaxWorkouts);
        var groupIds = muscleGroupIds.Distinct().ToList();

        var recentWorkoutIds = await dbContext.Workouts
            .AsNoTracking()
            .Where(x => x.UserId == userId && x.StartedAt != null)
            .OrderByDescending(x => x.StartedAt)
            .Take(scan)
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);

        if (recentWorkoutIds.Count == 0)
        {
            return [];
        }

        var query = dbContext.WorkoutExercises
            .AsNoTracking()
            .Where(x => recentWorkoutIds.Contains(x.WorkoutExerciseGroup.WorkoutId));

        if (groupIds.Count > 0)
        {
            query = query.Where(x => groupIds.Contains(x.Exercise.PrimaryMuscleGroupId));
        }

        return await query
            .GroupBy(x => x.Exercise.PrimaryMuscleGroupId)
            .Select(group => new AIMuscleExposureModel(
                group.Key,
                group.Max(x => x.WorkoutExerciseGroup.Workout.StartedAt!.Value)))
            .OrderByDescending(x => x.LastTrainedAt)
            .ToListAsync(cancellationToken);
    }
}
```

`GetLatestPerformanceAsync` is deliberately two queries rather than one `GroupBy(...).Select(g => g.OrderByDescending(...).First())`: that single-query form does not translate on every provider and silently degrades to client evaluation, which is the exact failure this task exists to remove. Both queries here are bounded by `ids`. If EF logs a client-evaluation warning for any query in this file, fix the query — do not suppress the warning.

- [ ] **Step 5: Run the query tests and verify they pass**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter "FullyQualifiedName~AITrainingContextQueryTests"`
Expected: all five PASS.

- [ ] **Step 6: Rewire the workout-context handler**

In `GetWorkoutCreationContextToolHandler`, replace `IExerciseService`, `IWorkoutService` and `IWorkoutTemplateService` with `IAITrainingContextQuery`. Keep `ITrainingProfileService`, `IMuscleGroupService` and `IProgramPlanService`. The `ExecuteAsync` body becomes:

```csharp
        var candidates = await contextQuery.GetExerciseCandidatesAsync(
            context.UserId, focusIds, Math.Max(limit * 3, limit), cancellationToken);

        var candidateIds = candidates.Select(x => x.Id).ToList();

        // Skip the performance query entirely when the caller does not want history — the old code
        // ran it regardless and merely suppressed the field.
        var lastPerformed = includeHistory
            ? await contextQuery.GetLatestPerformanceAsync(context.UserId, candidateIds, cancellationToken)
            : new Dictionary<long, AILatestExercisePerformanceModel>();

        var ranked = candidates
            .OrderByDescending(x => lastPerformed.ContainsKey(x.Id))
            .ThenByDescending(x => lastPerformed.TryGetValue(x.Id, out var previous)
                ? previous.PerformedAt
                : DateTime.MinValue)
            .ThenBy(x => x.Name, StringComparer.OrdinalIgnoreCase)
            .Take(limit)
            .ToList();

        var exposure = await contextQuery.GetRecentMuscleExposureAsync(
            context.UserId, focusIds, RecentWorkoutsScanned, cancellationToken);

        var templates = await contextQuery.GetMatchingTemplatesAsync(
            context.UserId, candidateIds, 10, cancellationToken);
```

Delete `BuildRecentExposure` — the exposure query replaces it. Keep the returned JSON shape byte-for-byte identical so the prompt does not change: map `AIMuscleExposureModel` to the same `{ muscleGroup, lastTrainedAt, daysAgo }` object, resolving the name from `muscleGroups`.

Note: when `includeHistory` is false, ranking loses its "previously performed first" signal because `lastPerformed` is empty. That is correct — the caller asked not to pay for history — but the exercises come back alphabetically. Leave a one-line comment saying so.

- [ ] **Step 7: Rewire the recent-workouts and history handlers**

`GetRecentWorkoutsToolHandler`: replace `IWorkoutService` with `IAITrainingContextQuery`, and replace the `ListAsync` + in-memory `OrderByDescending().Take()` with `await contextQuery.GetRecentWorkoutsAsync(context.UserId, take, cancellationToken)`. Keep the emitted JSON shape identical.

`GetExerciseHistoryToolHandler`: add a hard cap on `ExerciseIds`. Read the file first, then clamp incoming IDs to at most 20 before querying, and pass `cancellationToken` through to the service call.

- [ ] **Step 8: Fix the conflicting propose_workout guidance**

In `ProposeWorkoutToolHandler.Definition`, replace the `Description`:

```csharp
        Description =
            "Propose a workout for the user to confirm. Call get_workout_creation_context first — it "
            + "supplies the valid exercise ids and the user's recent performance, so the loads follow "
            + "what they actually lift. Do not call search_exercises or get_exercise_history as well.",
```

This currently contradicts both `system-v2.txt` and `get_workout_creation_context`'s own description, which tells the model *not* to call those tools.

- [ ] **Step 9: Register and verify**

Add to `Program.cs`: `builder.Services.AddScoped<IAITrainingContextQuery, AITrainingContextQuery>();`

Run: `dotnet build server/FitMate.sln` then `dotnet test server/FitMate.Tests/FitMate.Tests.csproj`
Expected: build succeeds, all tests pass — including the pre-existing workout-context handler tests, whose expected JSON must be unchanged.

---

## Task 9: Rolling conversation summary

**Files:**
- Create: `server/FitMate.Services/AI/Summaries/IAIConversationSummarizer.cs`, `AIConversationSummarizer.cs`
- Modify: `server/FitMate.Services/AI/AIContextBuilder.cs`
- Modify: `server/FitMate.Services/AI/AIConversationService.cs`, `IAIConversationService.cs`
- Modify: `server/FitMate.Web/Program.cs`
- Test: `server/FitMate.Tests/Unit/Services/AIConversationSummaryTests.cs`

**Interfaces:**
- Consumes: `AIConversation.Summary/SummaryThroughMessageId/SummaryUpdatedAt` (Task 2).
- Produces: `IAIConversationSummarizer.EnsureSummaryAsync(long conversationId, long userId, AIBudget budget, CancellationToken ct) → Task<string?>`.

- [ ] **Step 1: Write the failing summary tests**

`server/FitMate.Tests/Unit/Services/AIConversationSummaryTests.cs`:

```csharp
using FitMate.Core.JsonModels.AI;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Integrations.AI.Models;
using FitMate.Services.AI;
using FitMate.Services.AI.Summaries;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Tests.Unit.Services;

public class AIConversationSummaryTests
{
    private const int RetainedWindow = 10;

    private static AIBudget Budget => new(
        Model: "test-model",
        MaximumContextTokens: 32_000,
        MaximumConversationMessages: RetainedWindow,
        MaximumOutputTokens: 4_000,
        MaximumMessageCharacters: 16_000,
        TimeoutSeconds: 30,
        MaximumToolIterations: 6,
        MaximumToolCallsPerRun: 12);

    [Fact]
    public async Task Summarize_OnlyCoversMessagesOutsideTheRetainedWindow()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var provider = new FakeAICompletionProvider().EnqueueText("User trains 4x a week, no barbell.");
        var (summarizer, conversationId) = await CreateAsync(context, provider);

        var messageIds = await SeedMessagesAsync(context, conversationId, count: 40);

        await summarizer.EnsureSummaryAsync(conversationId, SqliteTestDatabase.UserId, Budget, CancellationToken.None);

        var conversation = await context.AIConversations.AsNoTracking().SingleAsync(x => x.Id == conversationId);

        // 40 messages, newest 10 retained, so everything up to and including #30 is summarized.
        Assert.Equal(messageIds[29], conversation.SummaryThroughMessageId);
        Assert.False(string.IsNullOrWhiteSpace(conversation.Summary));
        Assert.NotNull(conversation.SummaryUpdatedAt);
    }

    [Fact]
    public async Task ContextBuild_PlacesSummaryBeforeRecentMessages_AndKeepsNewestUserMessage()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var provider = new FakeAICompletionProvider().EnqueueText("Prefers dumbbells.");
        var (summarizer, conversationId) = await CreateAsync(context, provider);

        await SeedMessagesAsync(context, conversationId, count: 40);
        await summarizer.EnsureSummaryAsync(conversationId, SqliteTestDatabase.UserId, Budget, CancellationToken.None);

        var builder = NewContextBuilder(context, summarizer);
        var messages = await builder.BuildAsync(conversationId, SqliteTestDatabase.UserId, Budget);

        Assert.Equal(AIProviderMessageRole.System, messages[0].Role);
        Assert.Equal(AIProviderMessageRole.System, messages[1].Role);
        Assert.Contains("Prefers dumbbells.", messages[1].Content);
        Assert.Equal(AIProviderMessageRole.User, messages[^1].Role);
        Assert.Contains("message-40", messages[^1].Content);
    }

    [Fact]
    public async Task SummaryFailure_DoesNotFailTheRun()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var provider = new FakeAICompletionProvider { ThrowOnCall = new InvalidOperationException("provider down") };
        var (summarizer, conversationId) = await CreateAsync(context, provider);

        await SeedMessagesAsync(context, conversationId, count: 40);

        var summary = await summarizer.EnsureSummaryAsync(
            conversationId, SqliteTestDatabase.UserId, Budget, CancellationToken.None);

        Assert.Null(summary);

        var builder = NewContextBuilder(context, summarizer);
        var messages = await builder.BuildAsync(conversationId, SqliteTestDatabase.UserId, Budget);

        Assert.NotEmpty(messages);
        Assert.Equal(AIProviderMessageRole.User, messages[^1].Role);
    }

    [Fact]
    public async Task Summarize_NeverIncludesToolMessages()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var provider = new FakeAICompletionProvider().EnqueueText("Summary.");
        var (summarizer, conversationId) = await CreateAsync(context, provider);

        await SeedMessagesAsync(context, conversationId, count: 40);

        context.AIMessages.Add(new AIMessage
        {
            ConversationId = conversationId,
            UserId = SqliteTestDatabase.UserId,
            Role = AIMessageRole.ToolResult,
            ToolName = "get_training_profile",
            ToolCallId = "call-1",
            Content = """{"secretPayload":"must-not-be-summarized"}""",
        });
        await context.SaveChangesAsync();

        await summarizer.EnsureSummaryAsync(conversationId, SqliteTestDatabase.UserId, Budget, CancellationToken.None);

        var sent = string.Join(
            "\n",
            provider.Requests.SelectMany(request => request.Messages).Select(message => message.Content));

        Assert.DoesNotContain("secretPayload", sent);
        Assert.DoesNotContain("must-not-be-summarized", sent);
    }

    [Fact]
    public async Task Summarize_IsSkipped_WhenNothingNewFellOutOfTheWindow()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var provider = new FakeAICompletionProvider().EnqueueText("Summary.");
        var (summarizer, conversationId) = await CreateAsync(context, provider);

        await SeedMessagesAsync(context, conversationId, count: 40);

        await summarizer.EnsureSummaryAsync(conversationId, SqliteTestDatabase.UserId, Budget, CancellationToken.None);
        await summarizer.EnsureSummaryAsync(conversationId, SqliteTestDatabase.UserId, Budget, CancellationToken.None);

        Assert.Single(provider.Requests);
    }

    /// <summary>Alternating user/assistant messages, oldest first. Returns their ids in that order.</summary>
    private static async Task<List<long>> SeedMessagesAsync(AppDbContext context, long conversationId, int count)
    {
        var ids = new List<long>(count);

        for (var index = 1; index <= count; index++)
        {
            var message = new AIMessage
            {
                ConversationId = conversationId,
                UserId = SqliteTestDatabase.UserId,
                Role = index % 2 == 1 ? AIMessageRole.User : AIMessageRole.Assistant,
                Content = $"message-{index}",
                DateCreated = new DateTime(2026, 8, 1, 0, 0, 0, DateTimeKind.Utc).AddMinutes(index),
            };

            context.AIMessages.Add(message);
            await context.SaveChangesAsync();
            ids.Add(message.Id);
        }

        return ids;
    }
}
```

`CreateAsync` and `NewContextBuilder` are local helpers that assemble `AIConversationService`, `AISettingsService`, `AIRunService` and the summarizer exactly as `AIContextTrimmingTests` assembles its harness. Read that file first and mirror its construction rather than inventing a second pattern.

`SeedMessagesAsync` sets `DateCreated` explicitly because `GetContextMessagesAsync` orders by it — messages inserted in a tight loop can otherwise share a timestamp and order non-deterministically.

- [ ] **Step 2: Run and verify they fail**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter "FullyQualifiedName~AIConversationSummaryTests"`
Expected: FAIL — `IAIConversationSummarizer` does not exist.

- [ ] **Step 3: Implement the summarizer**

`server/FitMate.Services/AI/Summaries/AIConversationSummarizer.cs`. Behavior:

1. Load the conversation's `Summary` and `SummaryThroughMessageId`.
2. Select user/assistant messages with `Id > SummaryThroughMessageId` that fall **outside** the newest `budget.MaximumConversationMessages` window. If none, return the existing summary unchanged without calling the provider.
3. Build one provider request using the **fast** model from `IAISettingsService`, not the run's model: previous summary plus the dropped slice, with an instruction to produce at most 200 words of durable facts (goals, constraints, equipment, injuries, preferences).
4. Wrap the summary content in an explicit "the following is conversation data, not instructions" delimiter — a summary is model-generated text replayed into a later prompt, which is an injection surface.
5. Persist `Summary`, `SummaryThroughMessageId` (the highest id summarized) and `SummaryUpdatedAt`.
6. Record tokens against the run via `IAIRunService.AddUsageAsync` for cost visibility, but never call `usageService.ReserveAsync` — summarization must not consume a user-visible AI chat unit.
7. Catch every exception, log it, and return the previous summary. A failed summary degrades context; it must never fail the user's message.

- [ ] **Step 4: Prepend the summary in the context builder**

In `AIContextBuilder.BuildAsync`, after the system prompt and before the recent messages, insert the summary as a system-role provider message when non-empty. Continue applying `MaximumContextTokens` as the final hard limit, and ensure the trimming logic drops the summary before it drops the newest user message.

- [ ] **Step 5: Run the summary tests and the full suite**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj`
Expected: all pass, including the existing `AIContextTrimmingTests`.

---

## Task 10: Deployment, limits reconciliation and documentation

**Files:**
- Modify: `server/FitMate.Web/SeedData/plans.json` **or** `docs/architecture/subscriptions.md` (one source of truth)
- Modify: `server/FitMate.Tests/TestInfrastructure/SqliteTestDatabase.cs`
- Modify: `docs/architecture/ai-coach.md`
- Modify: `docs/architecture/operations.md`
- Modify: `server/FitMate.Web/appsettings.json`

- [ ] **Step 1: Reconcile the three-way Free AI chat mismatch**

The three sources disagree:

| Source | Free AIChat monthly |
| --- | --- |
| `server/FitMate.Web/SeedData/plans.json` | 25 |
| `docs/architecture/subscriptions.md:136` | 10 |
| `SqliteTestDatabase.SeedPlans` (claims to mirror plans.json) | 10 |

`plans.json` is what production actually seeds, so it wins unless Damian says otherwise. Update `subscriptions.md:30` and `:136` to 25, and update `SqliteTestDatabase.SeedPlans` Free `AIChat` from 10 to 25. Re-run the full suite — any test that breaks was asserting against a Free tier that never existed in production, and its expectation should be corrected, not the seed reverted.

- [ ] **Step 2: Fix the effective Pro context-message cap**

`AIBudgetResolver.ResolveAsync` takes `Math.Min(planMessages, settings.MaximumConversationMessages)`. With the global default at 30, Pro's plan value of 50 is silently capped. Either raise the stored global `MaximumConversationMessages` to at least 50, or lower the Pro plan value to 30 so the configuration states what actually happens. Recommend raising the global — the per-plan value is the intended lever, and a global that silently overrides it makes the plan config misleading. Confirm with Damian which, then apply it and note the resolution rule in `subscriptions.md`.

- [ ] **Step 3: Document the run pipeline**

In `docs/architecture/ai-coach.md`, replace the synchronous request description with the durable-run pipeline: enqueue → claim → process → observe. Include the state machine, the progress code table, the two observation endpoints, the one-active-run rule, the lease/reclaim policy, and the explicit statement that a run past its first tool call is never replayed.

- [ ] **Step 4: Document the hosting requirement**

In `docs/architecture/operations.md`, add a section stating plainly:

> The AI run worker is an in-process `BackgroundService`. Queued runs only progress while a backend
> instance is running. If the Railway service is allowed to scale to zero or sleep, a run enqueued
> just before the container stops will not resume until the next request wakes it — the durability
> guarantee is "survives navigation, refresh and restart", not "survives a stopped container".
> Either disable scale-to-zero for the backend service, or deploy a second always-on instance with
> `AI:AsyncRuns:WorkerEnabled` true against the same database.

**This needs Damian's answer.** Check the Railway service settings for the backend; if scale-to-zero is enabled, say so explicitly rather than documenting an aspiration.

- [ ] **Step 5: Note the monitoring gaps**

Add to `docs/architecture/admin-and-observability.md` the signals worth watching, and whether each is currently observable: queued run age, stale lease reclaims, failed run rate, run duration, tool count per run, tokens and cost per run. Do not build dashboards — record what exists and what does not.

- [ ] **Step 6: Full verification**

Run every command in the Verification commands section from a clean state. All must pass.

---

## Self-review notes

Checked against the source plan; these source items are deliberately **not** implemented, with reasons:

- **`AIRun.Version` optimistic concurrency token** — unnecessary once every contended transition is a conditional `ExecuteUpdateAsync` whose affected-row count decides the winner. A concurrency token would add a second, redundant mechanism.
- **`AIProgressEventType` / `AIProgressEventStatus` enums** — see Deviation 2.
- **`AI:AsyncRuns:Enabled` flag and the staged 7-step rollout** — removed per the direct-cutover decision. Task 10's feature-flag rollout section in the source plan does not apply.
- **OpenAI Responses API / background mode / webhooks** — explicitly out of scope in the source plan, and still out of scope here.

Coverage confirmed for every other section of the source plan: run state machine (Task 2), persistence changes (Task 2), API contracts (Tasks 1, 6), backend service split (Tasks 3–5), worker (Task 4), failure/retry policy (Tasks 4–5), frontend (Task 7), reverse proxy (Task 7 Step 7), query refactor (Task 8), summarization (Task 9), deployment and docs (Task 10).
