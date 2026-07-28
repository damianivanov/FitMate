# Hardening: Background Jobs, Retention, Rate Limits and Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Production-harden everything Plans 01–10 shipped: a DB-backed maintenance runner (missed days, action/reservation expiry, temp-upload cleanup, retries, retention, cost alert) triggerable both in-process and by platform cron, a conversation export path, rate limiting on AI and auth endpoints, an idempotency and security audit with named tests, and index/query-budget performance work.

**Architecture:** A single `MaintenanceJobService` (FitMate.Services/Maintenance/) exposes one idempotent method per job plus a name-keyed registry (`RunJobAsync`/`RunAllAsync`). It is invoked two ways: (a) `MaintenanceSchedulerHostedService`, a `BackgroundService` timer registered when `Maintenance:EnableInProcessScheduler` is true (default), and (b) `POST api/admin/maintenance/run/{jobName}` guarded by admin auth **or** an `X-Maintenance-Key` header for platform cron. Rate limiting uses the built-in ASP.NET Core rate limiter (`Microsoft.AspNetCore.RateLimiting`, in-framework, no package) with per-user "ai" and per-IP "auth" policies whose 429s emit the standard `CommonJsonModel` envelope. Audits (idempotency, security, query budgets, caps) become named tests and a committed checklist document.

**Deployment reality (inspected 2026-07-27):** There is **no** `server/FitMate.Web/Dockerfile` and **no worker project** — the only backend deployable is `server/Dockerfile`, a Railway container image (build stage publishes `FitMate.Web` with `RtDisable=true`; runtime `CMD ASPNETCORE_URLS=http://0.0.0.0:$PORT dotnet FitMate.Web.dll`). `Program.cs` comments state the host log stream is captured by "the (serverless) host", the host FS is read-only (no file sink), and `IBlobStorageService.GetWriteUrlAsync` docs mention "the container is scaled to zero / on the serverless runtime". Conclusion: the process is a normal Kestrel container **but may be scaled to zero**, so an in-process timer alone is not sufficient — hence the dual exposure above, plus a catch-up run shortly after each cold start. `appsettings.json` has no Maintenance/RateLimiting/Ai sections yet (Plans 04–10 add the `Ai`/`Stripe` ones).

**Tech Stack:** .NET 9, EF Core + Npgsql (Sqlite in tests), built-in `Microsoft.AspNetCore.RateLimiting` + `System.Threading.RateLimiting`, Serilog (console + `SerilogDatabaseSink` → Errors table), Azure Blob Storage SDK, xUnit with `SqliteTestDatabase`/`TestWebApplicationFactory`.

## Global Constraints

- Follow repo conventions (roadmap D4): services take `(request, long userId)` and no CancellationToken; controllers extend `BaseApiController` and use `this.ReturnJson(...)`/`this.ReturnJsonError(...)`; DTOs in `FitMate.Core/JsonModels/<Feature>/`; entity configs in `FitMate.DB/Configurations`; DI registrations in the `builder.Services.AddScoped<...>()` block of `server/FitMate.Web/Program.cs` (~line 250–263).
- **Documented deviation:** maintenance job methods are system-scoped (no user), so they take `(DateTime utcNow)` instead of `(request, long userId)`. Passing `utcNow` in keeps every job deterministic in tests. This is the only signature style used in `IMaintenanceJobService`.
- Every job must be **idempotent**: running it twice in a row returns `0` affected on the second run, and running it must never throw for "nothing to do".
- Jobs must **never** touch billing/usage/security records (`UsageEntry`, `UsageBucket` totals other than the specified `Reserved` decrement, `AiRun`, `BillingWebhookEvent`, `Errors`, tokens) — retention trims conversations/actions only.
- `AppDbContext.SaveChangesAsync()` stamps `DateCreated`/`DateModified` — never set them manually in production code. In tests, backdate rows with `ExecuteUpdateAsync(s => s.SetProperty(x => x.DateModified, ...))` **after** the initial save (the stamper only runs through the change tracker).
- Plans 01–10 have all landed before this plan runs. Canonical entity/enum/service names come from the roadmap Shared Contracts (`AiAction`, `AiActionStatus`, `UsageReservation`, `UsageReservationStatus`, `AiConversation`, `AiConversationStatus`, `AiJob`, `AiJobStatus`, `AiMessage`, `AiRun`, `ProgramPlanDay`, `IProgramPlanDayService`, `IUsageService`, ...). Where a *member/property* name below is a best guess, the step carries a one-line "verify against `<file>`" note — resolve it against the landed code, do not invent parallel names.
- Backend commands: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter <Name>`; `dotnet build server/FitMate.sln`. After changing DTOs: `dotnet build server/FitMate.Web/FitMate.Web.csproj` then `cd client && npm run process-types`. Frontend checks: `cd client && npm run lint && npx tsc -b --noEmit`.
- All commands run from repo root `c:\Users\damian\Documents\Github\FitMate`. Do not run git commands other than the commit steps written below.

## File Structure

```
server/FitMate.Core/
├── JsonModels/Maintenance/MaintenanceJobResult.cs                 (Task 1)
├── JsonModels/Ai/AiConversationExportModel.cs                     (Task 8)
└── Settings/ApplicationSettings.cs (modify: maintenance/retention/cost keys)  (Task 1)

server/FitMate.Services/
├── Maintenance/MaintenanceJobNames.cs                             (Task 1)
├── Maintenance/IMaintenanceJobService.cs                          (Task 1)
├── Maintenance/MaintenanceJobService.cs                           (Task 1, jobs filled in Tasks 2–6)
├── Storage/Blobs/BlobItemInfo.cs                                  (Task 4)
├── Storage/Blobs/IBlobStorageService.cs (modify: ListAsync)       (Task 4)
├── Storage/Blobs/AzureBlobStorageService.cs (modify: ListAsync)   (Task 4)
└── Ai/AiConversationService.cs (modify: ExportAsync)              (Task 8)

server/FitMate.Web/
├── Attributes/MaintenanceGuardAttribute.cs                        (Task 7)
├── Infrastructure/MaintenanceSchedulerHostedService.cs            (Task 7)
├── Controllers/Admin/MaintenanceController.cs                     (Task 7)
├── Controllers/AiConversationController.cs (modify: export route) (Task 8)
├── Controllers/AuthController.cs (modify: [EnableRateLimiting])   (Task 9)
├── Program.cs (modify: DI + hosted service + rate limiter)        (Tasks 7, 9)
└── appsettings.json (modify: Maintenance/RateLimiting/Ai keys)    (Tasks 1, 9)

server/FitMate.DB/
├── Configurations/WorkoutConfiguration.cs (modify),
│   AiMessageConfiguration.cs (modify), UsageEntryConfiguration.cs (modify)  (Task 10)
└── Migrations/xxx_AddHardeningIndexes.cs (generated)              (Task 10)

server/FitMate.Tests/
├── TestInfrastructure/FakeAiJobProcessor.cs                       (Task 1)
├── TestInfrastructure/CapturingLogger.cs                          (Task 1)
├── TestInfrastructure/FakeBlobStorageService.cs (modify)          (Task 4)
├── TestInfrastructure/TestWebApplicationFactory.cs (modify: extraSettings)  (Task 7)
├── TestInfrastructure/QueryCountingInterceptor.cs                 (Task 10)
├── TestInfrastructure/SqliteTestDatabase.cs (modify: interceptor overload)  (Task 10)
├── Unit/Services/MaintenanceJobServiceTests.cs                    (Tasks 1–6)
├── Integration/MaintenanceApiTests.cs                             (Task 7)
├── Unit/Services/AiConversationExportTests.cs                     (Task 8)
├── Integration/RateLimitingApiTests.cs                            (Task 9)
├── Unit/Services/QueryBudgetTests.cs                              (Task 10)
├── Unit/Services/IdempotencyAuditTests.cs (only for gaps found)   (Task 11)
└── Integration/ControllerAuthorizationConventionTests.cs          (Task 12)

client/src/services/aiService.ts (modify: export download)         (Task 8)
docs/DATA-RETENTION.md                                             (Task 8)
docs/SECURITY-CHECKLIST.md                                         (Task 12)
```

---

### Task 1: Maintenance service skeleton — names, result DTO, registry, settings, DI

**Files:**
- Create: `server/FitMate.Services/Maintenance/MaintenanceJobNames.cs`, `IMaintenanceJobService.cs`, `MaintenanceJobService.cs`
- Create: `server/FitMate.Core/JsonModels/Maintenance/MaintenanceJobResult.cs`
- Create: `server/FitMate.Tests/TestInfrastructure/FakeAiJobProcessor.cs`, `CapturingLogger.cs`
- Modify: `server/FitMate.Core/Settings/ApplicationSettings.cs`, `server/FitMate.Web/appsettings.json`, `server/FitMate.Web/Program.cs` (one DI line)
- Test: `server/FitMate.Tests/Unit/Services/MaintenanceJobServiceTests.cs`

**Interfaces:**
- Consumes: `AppDbContext`, `IProgramPlanDayService` (Plan 01), `IBlobStorageService`, the Plan 10 AI-job processing service, `ApplicationSettings`.
- Produces (full interface — Tasks 2–6 add no signatures, only implementations; Task 7's controller and scheduler depend on these exact names):

```csharp
using FitMate.Core.JsonModels.Maintenance;

namespace FitMate.Services.Maintenance;

public interface IMaintenanceJobService
{
    IReadOnlyList<string> JobNames { get; }
    Task<MaintenanceJobResult> RunJobAsync(string jobName, DateTime utcNow);
    Task<IReadOnlyList<MaintenanceJobResult>> RunAllAsync(DateTime utcNow);

    Task<int> MarkOverdueProgramPlanDaysAsync(DateTime utcNow);
    Task<int> ExpireAiActionsAsync(DateTime utcNow);
    Task<int> ExpireUsageReservationsAsync(DateTime utcNow);
    Task<int> RetryFailedAiJobsAsync(DateTime utcNow);
    Task<int> DeleteTemporaryAiUploadsAsync(DateTime utcNow);
    Task<int> CleanupExpiredActionRecordsAsync(DateTime utcNow);
    Task<int> TrimConversationHistoryAsync(DateTime utcNow);
    Task<int> DailyCostCheckAsync(DateTime utcNow);
}
```

- [ ] **Step 1: Write the job-name constants** (`MaintenanceJobNames.cs`) — these strings are the public contract of the `run/{jobName}` endpoint and MUST NOT change later:

```csharp
namespace FitMate.Services.Maintenance;

public static class MaintenanceJobNames
{
    public const string MarkOverdueProgramPlanDays = "mark-overdue-program-plan-days";
    public const string ExpireAiActions = "expire-ai-actions";
    public const string ExpireUsageReservations = "expire-usage-reservations";
    public const string RetryFailedAiJobs = "retry-failed-ai-jobs";
    public const string DeleteTemporaryAiUploads = "delete-temporary-ai-uploads";
    public const string CleanupExpiredActionRecords = "cleanup-expired-action-records";
    public const string TrimConversationHistory = "trim-conversation-history";
    public const string DailyCostCheck = "daily-cost-check";

    /// Run order for RunAllAsync: expiries before cleanups, cost check last.
    public static readonly IReadOnlyList<string> All =
    [
        MarkOverdueProgramPlanDays,
        ExpireAiActions,
        ExpireUsageReservations,
        RetryFailedAiJobs,
        DeleteTemporaryAiUploads,
        CleanupExpiredActionRecords,
        TrimConversationHistory,
        DailyCostCheck,
    ];
}
```

- [ ] **Step 2: Write the result DTO** (`server/FitMate.Core/JsonModels/Maintenance/MaintenanceJobResult.cs`)

```csharp
namespace FitMate.Core.JsonModels.Maintenance;

public class MaintenanceJobResult
{
    public string JobName { get; set; } = string.Empty;
    public bool Success { get; set; }
    public int AffectedCount { get; set; }
    public string? Error { get; set; }
    public DateTime StartedAtUtc { get; set; }
    public double DurationMs { get; set; }
}
```

- [ ] **Step 3: Extend `ApplicationSettings`** — add after the `SmtpHost`/email block, following the existing `GetSetting`/`ParseOrDefault` style:

```csharp
    public bool MaintenanceEnableInProcessScheduler =>
        !"false".Equals(GetSetting("Maintenance:EnableInProcessScheduler"), StringComparison.OrdinalIgnoreCase);
    public int MaintenanceSchedulerIntervalMinutes => ParseOrDefault(GetSetting("Maintenance:SchedulerIntervalMinutes"), 60);
    public string MaintenanceApiKey => GetSetting("Maintenance:ApiKey") ?? string.Empty;

    public int AiTemporaryUploadRetentionHours => ParseOrDefault(GetSetting("Ai:Retention:TemporaryUploadRetentionHours"), 24);
    public int AiExpiredActionRetentionDays => ParseOrDefault(GetSetting("Ai:Retention:ExpiredActionRetentionDays"), 30);
    public int AiConversationRetentionDays => ParseOrDefault(GetSetting("Ai:Retention:ConversationRetentionDays"), 365);
    public decimal AiDailyCostAlertThreshold => ParseDecimalOrDefault(GetSetting("Ai:DailyCostAlertThreshold"), 0m);

    private static decimal ParseDecimalOrDefault(string? value, decimal defaultValue)
    {
        return decimal.TryParse(value, System.Globalization.NumberStyles.Number,
            System.Globalization.CultureInfo.InvariantCulture, out var parsed) ? parsed : defaultValue;
    }
```

> Verify against `server/FitMate.Core/Settings/ApplicationSettings.cs` at execution time: Plan 05 may already have added retention properties (possibly under `Ai:TemporaryUploadRetentionHours` without the `Retention` segment) — if so, reuse the landed key names and properties instead of adding duplicates.

Add the matching empty defaults to `server/FitMate.Web/appsettings.json` (merge into the existing object; do not remove keys added by Plans 04–10):

```json
  "Maintenance": {
    "EnableInProcessScheduler": "true",
    "SchedulerIntervalMinutes": "60",
    "ApiKey": ""
  },
  "Ai": {
    "DailyCostAlertThreshold": "",
    "Retention": {
      "TemporaryUploadRetentionHours": "24",
      "ExpiredActionRetentionDays": "30",
      "ConversationRetentionDays": "365"
    }
  }
```

- [ ] **Step 4: Write the test fakes**

`server/FitMate.Tests/TestInfrastructure/FakeAiJobProcessor.cs` (interface name best-guess — see Step 6 note):

```csharp
using FitMate.Services.Ai;

namespace FitMate.Tests.TestInfrastructure;

public sealed class FakeAiJobProcessor : IAiJobProcessor
{
    public List<long> ProcessedJobIds { get; } = [];

    public Task ProcessAsync(long aiJobId)
    {
        ProcessedJobIds.Add(aiJobId);
        return Task.CompletedTask;
    }
}
```

`server/FitMate.Tests/TestInfrastructure/CapturingLogger.cs`:

```csharp
using Microsoft.Extensions.Logging;

namespace FitMate.Tests.TestInfrastructure;

public sealed class CapturingLogger<T> : ILogger<T>
{
    public List<(LogLevel Level, string Message)> Entries { get; } = [];

    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

    public bool IsEnabled(LogLevel logLevel) => true;

    public void Log<TState>(LogLevel logLevel, EventId eventId, TState state,
        Exception? exception, Func<TState, Exception?, string> formatter)
        => Entries.Add((logLevel, formatter(state, exception)));
}
```

- [ ] **Step 5: Write failing tests** (`server/FitMate.Tests/Unit/Services/MaintenanceJobServiceTests.cs`) — this file grows through Task 6; start it with the shared helpers every later task reuses:

```csharp
using FitMate.Core.Settings;
using FitMate.DB;
using FitMate.Services.Maintenance;
using FitMate.Services.ProgramPlans;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;

namespace FitMate.Tests.Unit.Services;

public class MaintenanceJobServiceTests
{
    internal static ApplicationSettings CreateSettings(Dictionary<string, string?>? overrides = null)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(overrides ?? [])
            .Build();
        return new ApplicationSettings(configuration);
    }

    internal static MaintenanceJobService CreateService(
        AppDbContext context,
        FakeBlobStorageService? blobs = null,
        FakeAiJobProcessor? jobProcessor = null,
        Dictionary<string, string?>? settings = null,
        ILogger<MaintenanceJobService>? logger = null)
    {
        return new MaintenanceJobService(
            context,
            new ProgramPlanDayService(context, TestWorkoutServiceFactory.Create(context)),
            blobs ?? new FakeBlobStorageService(),
            jobProcessor ?? new FakeAiJobProcessor(),
            CreateSettings(settings),
            logger ?? NullLogger<MaintenanceJobService>.Instance);
    }

    [Fact]
    public void JobNames_ExposesAllEightRegisteredJobs()
    {
        using var db = new SqliteTestDatabase();
        using var context = db.CreateContext();
        var service = CreateService(context);

        Assert.Equal(MaintenanceJobNames.All, service.JobNames);
        Assert.Equal(8, service.JobNames.Count);
    }

    [Fact]
    public async Task RunJob_UnknownName_ReturnsFailedResultWithoutThrowing()
    {
        using var db = new SqliteTestDatabase();
        using var context = db.CreateContext();
        var service = CreateService(context);

        var result = await service.RunJobAsync("no-such-job", DateTime.UtcNow);

        Assert.False(result.Success);
        Assert.Equal("no-such-job", result.JobName);
        Assert.Contains("Unknown maintenance job", result.Error);
    }

    [Fact]
    public async Task RunAll_ReturnsOneResultPerJob_AndSurvivesIndividualFailures()
    {
        using var db = new SqliteTestDatabase();
        using var context = db.CreateContext();
        var service = CreateService(context);

        // Empty database: every implemented job affects 0 rows; stubbed jobs (until Tasks 2-6
        // land) surface as Success=false results rather than exceptions.
        var results = await service.RunAllAsync(DateTime.UtcNow);

        Assert.Equal(MaintenanceJobNames.All.Count, results.Count);
        Assert.Equal(MaintenanceJobNames.All, results.Select(r => r.JobName).ToList());
    }
}
```

> Verify against Plan 01's test suite at execution time: `TestWorkoutServiceFactory` and the exact `ProgramPlanDayService` constructor `(AppDbContext, IWorkoutService)` come from Plan 01 (its Task 9 note names both). If Plan 01 landed a different helper name, substitute it in `CreateService` — do not build a second workout-service factory.

- [ ] **Step 6: Run tests to verify they fail**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter MaintenanceJobServiceTests`
Expected: FAIL — `MaintenanceJobService` does not exist.

- [ ] **Step 7: Implement the skeleton** (`server/FitMate.Services/Maintenance/MaintenanceJobService.cs`) — registry + dispatch complete, job bodies are `throw new NotImplementedException();` placeholders replaced one-by-one in Tasks 2–6:

```csharp
using System.Diagnostics;
using FitMate.Core.JsonModels.Maintenance;
using FitMate.Core.Settings;
using FitMate.DB;
using FitMate.Services.Ai;
using FitMate.Services.ProgramPlans;
using FitMate.Services.Storage.Blobs;
using Microsoft.Extensions.Logging;

namespace FitMate.Services.Maintenance;

public class MaintenanceJobService : IMaintenanceJobService
{
    private readonly AppDbContext dbContext;
    private readonly IProgramPlanDayService programPlanDayService;
    private readonly IBlobStorageService blobStorageService;
    private readonly IAiJobProcessor aiJobProcessor;
    private readonly ApplicationSettings settings;
    private readonly ILogger<MaintenanceJobService> logger;
    private readonly Dictionary<string, Func<DateTime, Task<int>>> jobs;

    public MaintenanceJobService(
        AppDbContext dbContext,
        IProgramPlanDayService programPlanDayService,
        IBlobStorageService blobStorageService,
        IAiJobProcessor aiJobProcessor,
        ApplicationSettings settings,
        ILogger<MaintenanceJobService> logger)
    {
        this.dbContext = dbContext;
        this.programPlanDayService = programPlanDayService;
        this.blobStorageService = blobStorageService;
        this.aiJobProcessor = aiJobProcessor;
        this.settings = settings;
        this.logger = logger;

        jobs = new Dictionary<string, Func<DateTime, Task<int>>>(StringComparer.OrdinalIgnoreCase)
        {
            [MaintenanceJobNames.MarkOverdueProgramPlanDays] = MarkOverdueProgramPlanDaysAsync,
            [MaintenanceJobNames.ExpireAiActions] = ExpireAiActionsAsync,
            [MaintenanceJobNames.ExpireUsageReservations] = ExpireUsageReservationsAsync,
            [MaintenanceJobNames.RetryFailedAiJobs] = RetryFailedAiJobsAsync,
            [MaintenanceJobNames.DeleteTemporaryAiUploads] = DeleteTemporaryAiUploadsAsync,
            [MaintenanceJobNames.CleanupExpiredActionRecords] = CleanupExpiredActionRecordsAsync,
            [MaintenanceJobNames.TrimConversationHistory] = TrimConversationHistoryAsync,
            [MaintenanceJobNames.DailyCostCheck] = DailyCostCheckAsync,
        };
    }

    public IReadOnlyList<string> JobNames => MaintenanceJobNames.All;

    public async Task<MaintenanceJobResult> RunJobAsync(string jobName, DateTime utcNow)
    {
        var startedAt = DateTime.UtcNow;
        if (!jobs.TryGetValue(jobName, out var job))
        {
            return new MaintenanceJobResult
            {
                JobName = jobName,
                Success = false,
                Error = $"Unknown maintenance job '{jobName}'.",
                StartedAtUtc = startedAt,
            };
        }

        var stopwatch = Stopwatch.StartNew();
        try
        {
            var affected = await job(utcNow);
            logger.LogInformation(
                "Maintenance job {JobName} affected {AffectedCount} records in {DurationMs}ms",
                jobName, affected, stopwatch.ElapsedMilliseconds);
            return new MaintenanceJobResult
            {
                JobName = jobName,
                Success = true,
                AffectedCount = affected,
                StartedAtUtc = startedAt,
                DurationMs = stopwatch.Elapsed.TotalMilliseconds,
            };
        }
        catch (Exception ex)
        {
            // Warning+ lands in the Errors table via SerilogDatabaseSink — ops visibility for free.
            logger.LogError(ex, "Maintenance job {JobName} failed", jobName);
            return new MaintenanceJobResult
            {
                JobName = jobName,
                Success = false,
                Error = ex.Message,
                StartedAtUtc = startedAt,
                DurationMs = stopwatch.Elapsed.TotalMilliseconds,
            };
        }
    }

    public async Task<IReadOnlyList<MaintenanceJobResult>> RunAllAsync(DateTime utcNow)
    {
        var results = new List<MaintenanceJobResult>();
        foreach (var jobName in MaintenanceJobNames.All)
        {
            results.Add(await RunJobAsync(jobName, utcNow));
        }

        return results;
    }

    public Task<int> MarkOverdueProgramPlanDaysAsync(DateTime utcNow) => throw new NotImplementedException();
    public Task<int> ExpireAiActionsAsync(DateTime utcNow) => throw new NotImplementedException();
    public Task<int> ExpireUsageReservationsAsync(DateTime utcNow) => throw new NotImplementedException();
    public Task<int> RetryFailedAiJobsAsync(DateTime utcNow) => throw new NotImplementedException();
    public Task<int> DeleteTemporaryAiUploadsAsync(DateTime utcNow) => throw new NotImplementedException();
    public Task<int> CleanupExpiredActionRecordsAsync(DateTime utcNow) => throw new NotImplementedException();
    public Task<int> TrimConversationHistoryAsync(DateTime utcNow) => throw new NotImplementedException();
    public Task<int> DailyCostCheckAsync(DateTime utcNow) => throw new NotImplementedException();
}
```

> Verify against Plan 10's landed code at execution time: the AI-job processing service is best-guessed here as `FitMate.Services.Ai.IAiJobProcessor` with `Task ProcessAsync(long aiJobId)`. Use Plan 10's real interface + method (whatever executes/retries an `AiJob` image generation on demand); if Plan 10 exposes no on-demand entry point, drop this ctor dependency and implement Task 5's retry as a requeue (`Status -> Pending`).

- [ ] **Step 8: Register DI** — in `Program.cs` after the `IAdminErrorService` line:

```csharp
builder.Services.AddScoped<IMaintenanceJobService, MaintenanceJobService>();
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter MaintenanceJobServiceTests`
Expected: PASS (3 tests). Then `dotnet build server/FitMate.sln` — OK.

- [ ] **Step 10: Commit**

```bash
git add server/FitMate.Core server/FitMate.Services server/FitMate.Web server/FitMate.Tests
git commit -m "feat(maintenance): job service skeleton, registry, settings and DI"
```

---

### Task 2: MarkOverdueProgramPlanDays job

**Files:**
- Modify: `server/FitMate.Services/Maintenance/MaintenanceJobService.cs`
- Test: `server/FitMate.Tests/Unit/Services/MaintenanceJobServiceTests.cs` (append)

**Interfaces:**
- Consumes: `IProgramPlanDayService.MarkMissedDaysAsync(long userId, DateOnly referenceDate)` (Plan 01 — single source of truth for the missed/skipped rules; the request-boundary calls in `GetTodayAsync`/`GetCalendarAsync` stay as belt-and-braces).
- Produces: `MarkOverdueProgramPlanDaysAsync(DateTime utcNow)` implementation.

- [ ] **Step 1: Write failing tests** (append to `MaintenanceJobServiceTests`):

```csharp
    private static async Task<long> SeedActivePlanWithOverdueDaysAsync(SqliteTestDatabase db)
    {
        await using var context = db.CreateContext();
        var plan = new FitMate.DB.Entities.ProgramPlan
        {
            UserId = SqliteTestDatabase.UserId,
            Name = "Hardening plan",
            Goal = FitMate.DB.Enums.TrainingGoal.GeneralFitness,
            Status = FitMate.DB.Enums.ProgramPlanStatus.Active,
            ScheduleType = FitMate.DB.Enums.ProgramScheduleType.FixedWeekdays,
            StartDate = new DateOnly(2026, 7, 1),
            TargetWorkoutsPerWeek = 3,
        };
        context.ProgramPlans.Add(plan);
        await context.SaveChangesAsync();

        context.ProgramPlanDays.AddRange(
            new FitMate.DB.Entities.ProgramPlanDay
            {
                ProgramPlanId = plan.Id,
                ScheduledDate = new DateOnly(2026, 7, 20),
                DayType = FitMate.DB.Enums.ProgramPlanDayType.Workout,
                Status = FitMate.DB.Enums.ProgramPlanDayStatus.Scheduled,
            },
            new FitMate.DB.Entities.ProgramPlanDay
            {
                ProgramPlanId = plan.Id,
                ScheduledDate = new DateOnly(2026, 7, 21),
                DayType = FitMate.DB.Enums.ProgramPlanDayType.OptionalWorkout,
                Status = FitMate.DB.Enums.ProgramPlanDayStatus.Scheduled,
            },
            new FitMate.DB.Entities.ProgramPlanDay
            {
                ProgramPlanId = plan.Id,
                ScheduledDate = new DateOnly(2026, 8, 3),
                DayType = FitMate.DB.Enums.ProgramPlanDayType.Workout,
                Status = FitMate.DB.Enums.ProgramPlanDayStatus.Scheduled,
            });
        await context.SaveChangesAsync();
        return plan.Id;
    }

    [Fact]
    public async Task MarkOverdueProgramPlanDays_MarksPastDays_LeavesFutureDays()
    {
        using var db = new SqliteTestDatabase();
        var planId = await SeedActivePlanWithOverdueDaysAsync(db);
        await using var context = db.CreateContext();
        var service = CreateService(context);

        var affected = await service.MarkOverdueProgramPlanDaysAsync(new DateTime(2026, 7, 27, 8, 0, 0, DateTimeKind.Utc));

        Assert.Equal(2, affected);
        await using var verify = db.CreateContext();
        var days = await verify.ProgramPlanDays
            .Where(d => d.ProgramPlanId == planId)
            .OrderBy(d => d.ScheduledDate)
            .ToListAsync();
        Assert.Equal(FitMate.DB.Enums.ProgramPlanDayStatus.Missed, days[0].Status);   // overdue Workout
        Assert.Equal(FitMate.DB.Enums.ProgramPlanDayStatus.Skipped, days[1].Status);  // overdue OptionalWorkout
        Assert.Equal(FitMate.DB.Enums.ProgramPlanDayStatus.Scheduled, days[2].Status); // future untouched
    }

    [Fact]
    public async Task MarkOverdueProgramPlanDays_SecondRun_AffectsNothing()
    {
        using var db = new SqliteTestDatabase();
        await SeedActivePlanWithOverdueDaysAsync(db);
        await using var context = db.CreateContext();
        var service = CreateService(context);
        var utcNow = new DateTime(2026, 7, 27, 8, 0, 0, DateTimeKind.Utc);
        await service.MarkOverdueProgramPlanDaysAsync(utcNow);

        await using var secondContext = db.CreateContext();
        var secondRun = await CreateService(secondContext).MarkOverdueProgramPlanDaysAsync(utcNow);

        Assert.Equal(0, secondRun);
    }
```

> Verify against Plan 01's landed `MarkMissedDaysAsync` semantics at execution time: overdue `Workout` → `Missed`, overdue `OptionalWorkout` → `Skipped`, `Rescheduled` past days → `Missed` (Plan 01 Task 8). The assertions above mirror that plan.

- [ ] **Step 2: Run — expect FAIL** (`NotImplementedException`)

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter MaintenanceJobServiceTests`

- [ ] **Step 3: Implement** — replace the stub in `MaintenanceJobService`:

```csharp
    public async Task<int> MarkOverdueProgramPlanDaysAsync(DateTime utcNow)
    {
        var referenceDate = DateOnly.FromDateTime(utcNow);

        // Count first so the return value reflects what this run transitioned; the actual
        // status rules live in ONE place: ProgramPlanDayService.MarkMissedDaysAsync (Plan 01).
        var overdueQuery = dbContext.ProgramPlanDays
            .Where(d => d.ProgramPlan.Status == FitMate.DB.Enums.ProgramPlanStatus.Active
                && d.ScheduledDate < referenceDate
                && (d.Status == FitMate.DB.Enums.ProgramPlanDayStatus.Scheduled
                    || d.Status == FitMate.DB.Enums.ProgramPlanDayStatus.Rescheduled));

        var affected = await overdueQuery.CountAsync();
        if (affected == 0)
        {
            return 0;
        }

        var userIds = await overdueQuery
            .Select(d => d.ProgramPlan.UserId)
            .Distinct()
            .ToListAsync();

        foreach (var userId in userIds)
        {
            await programPlanDayService.MarkMissedDaysAsync(userId, referenceDate);
        }

        return affected;
    }
```

(Use plain `using FitMate.DB.Enums;` at the top of the file and drop the qualifiers — shown fully qualified here only for unambiguity.)

- [ ] **Step 4: Run — expect PASS**, then commit

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter MaintenanceJobServiceTests`

```bash
git add server/FitMate.Services server/FitMate.Tests
git commit -m "feat(maintenance): mark-overdue-program-plan-days job"
```

---

### Task 3: ExpireAiActions + ExpireUsageReservations jobs

**Files:**
- Modify: `server/FitMate.Services/Maintenance/MaintenanceJobService.cs`
- Test: `server/FitMate.Tests/Unit/Services/MaintenanceJobServiceTests.cs` (append)

**Interfaces:**
- Consumes: `AiAction` + `AiActionStatus` (Plan 06), `UsageReservation`/`UsageBucket` + `UsageReservationStatus` (Plan 04).
- Produces: `ExpireAiActionsAsync`, `ExpireUsageReservationsAsync` implementations.

- [ ] **Step 1: Write failing tests** (append):

```csharp
    [Fact]
    public async Task ExpireAiActions_ExpiresOnlyPendingPastExpiry()
    {
        using var db = new SqliteTestDatabase();
        var utcNow = new DateTime(2026, 7, 27, 8, 0, 0, DateTimeKind.Utc);
        await using (var seed = db.CreateContext())
        {
            seed.AiActions.AddRange(
                new AiAction { UserId = SqliteTestDatabase.UserId, ActionType = AiActionType.CreateExercise, Status = AiActionStatus.PendingConfirmation, ExpiresAt = utcNow.AddMinutes(-5), PayloadJson = "{}" },
                new AiAction { UserId = SqliteTestDatabase.UserId, ActionType = AiActionType.CreateExercise, Status = AiActionStatus.PendingConfirmation, ExpiresAt = utcNow.AddMinutes(30), PayloadJson = "{}" },
                new AiAction { UserId = SqliteTestDatabase.UserId, ActionType = AiActionType.CreateExercise, Status = AiActionStatus.Executed, ExpiresAt = utcNow.AddDays(-1), PayloadJson = "{}" });
            await seed.SaveChangesAsync();
        }

        await using var context = db.CreateContext();
        var affected = await CreateService(context).ExpireAiActionsAsync(utcNow);

        Assert.Equal(1, affected);
        await using var verify = db.CreateContext();
        Assert.Equal(1, await verify.AiActions.CountAsync(a => a.Status == AiActionStatus.Expired));
        Assert.Equal(1, await verify.AiActions.CountAsync(a => a.Status == AiActionStatus.PendingConfirmation));
        Assert.Equal(1, await verify.AiActions.CountAsync(a => a.Status == AiActionStatus.Executed));
    }

    [Fact]
    public async Task ExpireUsageReservations_ExpiresAndReleasesBucketReservation()
    {
        using var db = new SqliteTestDatabase();
        var utcNow = new DateTime(2026, 7, 27, 8, 0, 0, DateTimeKind.Utc);
        long bucketId;
        await using (var seed = db.CreateContext())
        {
            var bucket = new UsageBucket
            {
                UserId = SqliteTestDatabase.UserId,
                Feature = SubscriptionFeature.AiCoachMessages,
                Used = 4,
                Reserved = 3,
            };
            seed.UsageBuckets.Add(bucket);
            await seed.SaveChangesAsync();
            bucketId = bucket.Id;

            seed.UsageReservations.AddRange(
                new UsageReservation { UsageBucketId = bucket.Id, UserId = SqliteTestDatabase.UserId, Feature = SubscriptionFeature.AiCoachMessages, Quantity = 2, Status = UsageReservationStatus.Active, ExpiresAt = utcNow.AddMinutes(-10) },
                new UsageReservation { UsageBucketId = bucket.Id, UserId = SqliteTestDatabase.UserId, Feature = SubscriptionFeature.AiCoachMessages, Quantity = 1, Status = UsageReservationStatus.Active, ExpiresAt = utcNow.AddMinutes(10) });
            await seed.SaveChangesAsync();
        }

        await using var context = db.CreateContext();
        var affected = await CreateService(context).ExpireUsageReservationsAsync(utcNow);

        Assert.Equal(1, affected);
        await using var verify = db.CreateContext();
        var bucketAfter = await verify.UsageBuckets.SingleAsync(b => b.Id == bucketId);
        Assert.Equal(1, bucketAfter.Reserved);   // 3 - expired quantity 2
        Assert.Equal(4, bucketAfter.Used);       // committed usage NEVER touched
        Assert.Equal(1, await verify.UsageReservations.CountAsync(r => r.Status == UsageReservationStatus.Expired));

        await using var secondContext = db.CreateContext();
        Assert.Equal(0, await CreateService(secondContext).ExpireUsageReservationsAsync(utcNow)); // idempotent
    }
```

> Verify against the landed Plan 06 `AiAction` (property names `Status`, `ExpiresAt`, `PayloadJson`, `ActionType`; enum members `PendingConfirmation`/`Expired`/`Executed`) and Plan 04 `UsageReservation`/`UsageBucket` (whether the reservation carries a `UsageBucketId` FK or is matched by `(UserId, Feature, PeriodStart)`; fields `Quantity`, `Reserved`, `Used`). Adjust seeding/assertions to the real shapes — the semantics (only Active+past expire; Reserved decremented by Quantity, floored at 0; Used untouched) must not change.

- [ ] **Step 2: Run — expect FAIL**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter MaintenanceJobServiceTests`

- [ ] **Step 3: Implement** (with `using FitMate.DB.Enums;` / `using FitMate.DB.Entities;`):

```csharp
    public async Task<int> ExpireAiActionsAsync(DateTime utcNow)
    {
        var actions = await dbContext.AiActions
            .Where(a => a.Status == AiActionStatus.PendingConfirmation
                && a.ExpiresAt != null
                && a.ExpiresAt <= utcNow)
            .ToListAsync();

        foreach (var action in actions)
        {
            action.Status = AiActionStatus.Expired;
        }

        await dbContext.SaveChangesAsync();
        return actions.Count;
    }

    public async Task<int> ExpireUsageReservationsAsync(DateTime utcNow)
    {
        var reservations = await dbContext.UsageReservations
            .Include(r => r.UsageBucket)
            .Where(r => r.Status == UsageReservationStatus.Active && r.ExpiresAt <= utcNow)
            .ToListAsync();

        foreach (var reservation in reservations)
        {
            reservation.Status = UsageReservationStatus.Expired;
            if (reservation.UsageBucket != null)
            {
                reservation.UsageBucket.Reserved =
                    Math.Max(0, reservation.UsageBucket.Reserved - reservation.Quantity);
            }
        }

        await dbContext.SaveChangesAsync();
        return reservations.Count;
    }
```

> Verify against Plan 04's `UsageService` at execution time: if it already exposes a release/expire method with status guards that also decrements `Reserved`, delegate to it per reservation instead of duplicating the bucket math here.

- [ ] **Step 4: Run — expect PASS**, then commit

```bash
git add server/FitMate.Services server/FitMate.Tests
git commit -m "feat(maintenance): expire-ai-actions and expire-usage-reservations jobs"
```

---

### Task 4: Blob listing + DeleteTemporaryAiUploads job (AggregateDailyAiMetrics: skipped)

**Files:**
- Create: `server/FitMate.Services/Storage/Blobs/BlobItemInfo.cs`
- Modify: `server/FitMate.Services/Storage/Blobs/IBlobStorageService.cs`, `AzureBlobStorageService.cs`
- Modify: `server/FitMate.Tests/TestInfrastructure/FakeBlobStorageService.cs`
- Modify: `server/FitMate.Services/Maintenance/MaintenanceJobService.cs`
- Test: `server/FitMate.Tests/Unit/Services/MaintenanceJobServiceTests.cs` (append)

**Interfaces:**
- Consumes: existing `IBlobStorageService` (`DeleteAsync`), `ApplicationSettings.AiTemporaryUploadRetentionHours`.
- Produces:

```csharp
namespace FitMate.Services.Storage.Blobs;

public sealed record BlobItemInfo(string Path, DateTimeOffset? LastModifiedUtc);

// Added to IBlobStorageService:
Task<IReadOnlyList<BlobItemInfo>> ListAsync(string prefix);
```

**Decision — AggregateDailyAiMetrics is skipped in v1:** the Plan 08 admin overview computes daily aggregates on demand from `AiRun` rows, which are already indexed by date; a materialized daily table adds a second source of truth with no current reader. Leave a comment in `MaintenanceJobService` (Step 3) so the omission is deliberate and discoverable; revisit only if the admin dashboard becomes slow.

- [ ] **Step 1: Extend the blob abstraction.** Add the record file, the interface member, and the Azure implementation (mirror `DeleteByPrefixAsync`'s container handling):

```csharp
    public async Task<IReadOnlyList<BlobItemInfo>> ListAsync(string prefix)
    {
        var container = GetContainerClient();
        if (!await container.ExistsAsync())
        {
            return [];
        }

        var results = new List<BlobItemInfo>();
        await foreach (var blob in container.GetBlobsAsync(prefix: prefix))
        {
            results.Add(new BlobItemInfo(blob.Name, blob.Properties.LastModified));
        }

        return results;
    }
```

Extend `FakeBlobStorageService`:

```csharp
    public List<BlobItemInfo> Items { get; } = [];

    public Task<IReadOnlyList<BlobItemInfo>> ListAsync(string prefix) =>
        Task.FromResult<IReadOnlyList<BlobItemInfo>>(
            Items.Where(i => i.Path.StartsWith(prefix, StringComparison.Ordinal)).ToList());
```

> Verify at execution time: Plan 10 may already have added a listing method to `IBlobStorageService` for its temp-blob lifecycle. If one exists, reuse it (adapting the job code below) instead of adding a second.

- [ ] **Step 2: Write failing tests** (append):

```csharp
    [Fact]
    public async Task DeleteTemporaryAiUploads_DeletesOnlyOldTempBlobs()
    {
        using var db = new SqliteTestDatabase();
        var utcNow = new DateTime(2026, 7, 27, 8, 0, 0, DateTimeKind.Utc);
        var blobs = new FakeBlobStorageService();
        blobs.Items.AddRange(
        [
            new BlobItemInfo("ai-temp/old-upload.jpg", new DateTimeOffset(utcNow.AddHours(-30))),
            new BlobItemInfo("ai-temp/fresh-upload.jpg", new DateTimeOffset(utcNow.AddHours(-1))),
            new BlobItemInfo("exercises/permanent.jpg", new DateTimeOffset(utcNow.AddDays(-90))),
        ]);
        await using var context = db.CreateContext();
        var service = CreateService(context, blobs: blobs);

        var affected = await service.DeleteTemporaryAiUploadsAsync(utcNow);

        Assert.Equal(1, affected);
        Assert.Equal(["ai-temp/old-upload.jpg"], blobs.DeletedPaths);
    }

    [Fact]
    public async Task DeleteTemporaryAiUploads_HonorsConfiguredRetentionHours()
    {
        using var db = new SqliteTestDatabase();
        var utcNow = new DateTime(2026, 7, 27, 8, 0, 0, DateTimeKind.Utc);
        var blobs = new FakeBlobStorageService();
        blobs.Items.Add(new BlobItemInfo("ai-temp/two-hours-old.jpg", new DateTimeOffset(utcNow.AddHours(-2))));
        await using var context = db.CreateContext();
        var service = CreateService(context, blobs: blobs,
            settings: new Dictionary<string, string?> { ["Ai:Retention:TemporaryUploadRetentionHours"] = "1" });

        var affected = await service.DeleteTemporaryAiUploadsAsync(utcNow);

        Assert.Equal(1, affected);
    }
```

- [ ] **Step 3: Run — expect FAIL**, then implement:

```csharp
    // NOTE: AggregateDailyAiMetrics (spec §66) is intentionally NOT implemented in v1.
    // The admin overview (Plan 08) aggregates AiRun rows on demand; add a materialized
    // daily-metrics job only if that dashboard becomes measurably slow.

    /// Temp uploads (exercise-recognition photos) live under this prefix per Plan 10.
    public const string TemporaryUploadPrefix = "ai-temp/";

    public async Task<int> DeleteTemporaryAiUploadsAsync(DateTime utcNow)
    {
        var cutoff = utcNow.AddHours(-settings.AiTemporaryUploadRetentionHours);
        var blobs = await blobStorageService.ListAsync(TemporaryUploadPrefix);

        var deleted = 0;
        foreach (var blob in blobs)
        {
            // Blobs with no LastModified metadata are treated as stale (defensive).
            if (blob.LastModifiedUtc == null || blob.LastModifiedUtc.Value.UtcDateTime <= cutoff)
            {
                await blobStorageService.DeleteAsync(blob.Path);
                deleted++;
            }
        }

        return deleted;
    }
```

> Verify against Plan 10 at execution time: if `BlobPathBuilder` (or a Plan 10 constant) already defines the temp prefix, reference that constant instead of redeclaring `"ai-temp/"` here.

- [ ] **Step 4: Run — expect PASS** (`--filter MaintenanceJobServiceTests`), plus `dotnet build server/FitMate.sln` (the Fake and Azure implementations must both compile), then commit

```bash
git add server/FitMate.Services server/FitMate.Tests
git commit -m "feat(maintenance): blob listing and delete-temporary-ai-uploads job"
```

---

### Task 5: RetryFailedAiJobs + CleanupExpiredActionRecords + TrimConversationHistory jobs

**Files:**
- Modify: `server/FitMate.Services/Maintenance/MaintenanceJobService.cs`
- Test: `server/FitMate.Tests/Unit/Services/MaintenanceJobServiceTests.cs` (append)

**Interfaces:**
- Consumes: `AiJob`/`AiJobStatus` (Plan 10), `AiAction` (Plan 06), `AiConversation`/`AiConversationStatus`/`AiMessage` (Plan 05), `UsageEntry` (Plan 04), the Plan 10 job processor.
- Produces: the three remaining retention/retry implementations.

- [ ] **Step 1: Write failing tests** (append):

```csharp
    [Fact]
    public async Task RetryFailedAiJobs_DispatchesOnlyFailedJobsWithRemainingAttempts()
    {
        using var db = new SqliteTestDatabase();
        long retryableId;
        await using (var seed = db.CreateContext())
        {
            var retryable = new AiJob { UserId = SqliteTestDatabase.UserId, Type = AiJobType.ExerciseImageGeneration, Status = AiJobStatus.Failed, AttemptCount = 1 };
            var exhausted = new AiJob { UserId = SqliteTestDatabase.UserId, Type = AiJobType.ExerciseImageGeneration, Status = AiJobStatus.Failed, AttemptCount = 3 };
            var succeeded = new AiJob { UserId = SqliteTestDatabase.UserId, Type = AiJobType.ExerciseImageGeneration, Status = AiJobStatus.Succeeded, AttemptCount = 1 };
            seed.AiJobs.AddRange(retryable, exhausted, succeeded);
            await seed.SaveChangesAsync();
            retryableId = retryable.Id;
        }

        var processor = new FakeAiJobProcessor();
        await using var context = db.CreateContext();
        var affected = await CreateService(context, jobProcessor: processor).RetryFailedAiJobsAsync(DateTime.UtcNow);

        Assert.Equal(1, affected);
        Assert.Equal([retryableId], processor.ProcessedJobIds);
    }

    [Fact]
    public async Task CleanupExpiredActionRecords_DeletesOnlyOldExpiredActions()
    {
        using var db = new SqliteTestDatabase();
        var utcNow = new DateTime(2026, 7, 27, 8, 0, 0, DateTimeKind.Utc);
        long oldExpiredId;
        await using (var seed = db.CreateContext())
        {
            var oldExpired = new AiAction { UserId = SqliteTestDatabase.UserId, ActionType = AiActionType.CreateExercise, Status = AiActionStatus.Expired, PayloadJson = "{}" };
            var freshExpired = new AiAction { UserId = SqliteTestDatabase.UserId, ActionType = AiActionType.CreateExercise, Status = AiActionStatus.Expired, PayloadJson = "{}" };
            var oldExecuted = new AiAction { UserId = SqliteTestDatabase.UserId, ActionType = AiActionType.CreateExercise, Status = AiActionStatus.Executed, PayloadJson = "{}" };
            seed.AiActions.AddRange(oldExpired, freshExpired, oldExecuted);
            await seed.SaveChangesAsync();
            oldExpiredId = oldExpired.Id;

            // Backdate via ExecuteUpdate — AddTimestamps() would overwrite DateModified on SaveChanges.
            await seed.AiActions
                .Where(a => a.Id == oldExpired.Id || a.Id == oldExecuted.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(a => a.DateModified, utcNow.AddDays(-40)));
        }

        await using var context = db.CreateContext();
        var affected = await CreateService(context).CleanupExpiredActionRecordsAsync(utcNow);

        Assert.Equal(1, affected);
        await using var verify = db.CreateContext();
        Assert.False(await verify.AiActions.AnyAsync(a => a.Id == oldExpiredId));
        Assert.Equal(2, await verify.AiActions.CountAsync()); // fresh Expired + old Executed survive
    }

    [Fact]
    public async Task TrimConversationHistory_SoftDeletesOldConversations_NeverTouchesUsageRecords()
    {
        using var db = new SqliteTestDatabase();
        var utcNow = new DateTime(2026, 7, 27, 8, 0, 0, DateTimeKind.Utc);
        long oldConversationId;
        await using (var seed = db.CreateContext())
        {
            var oldConversation = new AiConversation { UserId = SqliteTestDatabase.UserId, Status = AiConversationStatus.Active, Title = "Old" };
            var freshConversation = new AiConversation { UserId = SqliteTestDatabase.UserId, Status = AiConversationStatus.Active, Title = "Fresh" };
            seed.AiConversations.AddRange(oldConversation, freshConversation);
            seed.UsageEntries.Add(new UsageEntry { UserId = SqliteTestDatabase.UserId, Feature = SubscriptionFeature.AiCoachMessages, Quantity = 1, EntryType = UsageEntryType.Commit });
            await seed.SaveChangesAsync();
            oldConversationId = oldConversation.Id;
            seed.AiMessages.Add(new AiMessage { ConversationId = oldConversation.Id, Role = AiMessageRole.User, Content = "hello" });
            await seed.SaveChangesAsync();

            await seed.AiConversations
                .Where(c => c.Id == oldConversation.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.DateModified, utcNow.AddDays(-400)));
        }

        await using var context = db.CreateContext();
        var affected = await CreateService(context).TrimConversationHistoryAsync(utcNow);

        Assert.Equal(1, affected);
        await using var verify = db.CreateContext();
        Assert.Equal(AiConversationStatus.Deleted,
            (await verify.AiConversations.SingleAsync(c => c.Id == oldConversationId)).Status);
        Assert.Equal(1, await verify.UsageEntries.CountAsync());              // billing survives
        Assert.Equal(1, await verify.AiMessages.CountAsync());                // soft delete: rows remain
        Assert.Equal(1, await verify.AiConversations.CountAsync(c => c.Status == AiConversationStatus.Active));
    }
```

> Verify against landed code at execution time: (a) `AiJob` property names (`Type`, `Status`, `AttemptCount`) and `AiJobStatus`/`AiJobType` members per Plan 10; (b) `AiConversation` soft-delete mechanism per Plan 05's `DELETE api/ai/conversations/{id}` — if it uses an `IsDeleted` flag or a `DeletedAt` timestamp instead of `Status = Deleted`, use that exact mechanism in both test and job; (c) `UsageEntry` required members per Plan 04.

- [ ] **Step 2: Run — expect FAIL**, then implement:

```csharp
    public async Task<int> RetryFailedAiJobsAsync(DateTime utcNow)
    {
        const int maxAttempts = 3;
        var failedJobIds = await dbContext.AiJobs
            .Where(j => j.Status == AiJobStatus.Failed && j.AttemptCount < maxAttempts)
            .Select(j => j.Id)
            .ToListAsync();

        foreach (var jobId in failedJobIds)
        {
            // The processor owns AttemptCount increments and terminal status transitions (Plan 10);
            // a job that fails again stays Failed with AttemptCount+1 and will be retried next tick
            // until it exhausts maxAttempts.
            await aiJobProcessor.ProcessAsync(jobId);
        }

        return failedJobIds.Count;
    }

    public async Task<int> CleanupExpiredActionRecordsAsync(DateTime utcNow)
    {
        var cutoff = utcNow.AddDays(-settings.AiExpiredActionRetentionDays);
        return await dbContext.AiActions
            .Where(a => a.Status == AiActionStatus.Expired && a.DateModified < cutoff)
            .ExecuteDeleteAsync();
    }

    public async Task<int> TrimConversationHistoryAsync(DateTime utcNow)
    {
        var cutoff = utcNow.AddDays(-settings.AiConversationRetentionDays);
        var conversations = await dbContext.AiConversations
            .Where(c => c.Status != AiConversationStatus.Deleted && c.DateModified < cutoff)
            .ToListAsync();

        foreach (var conversation in conversations)
        {
            // Soft delete only. AiMessage/AiRun/UsageEntry/BillingWebhookEvent rows are billing and
            // security records and are NEVER deleted by retention (spec §88).
            conversation.Status = AiConversationStatus.Deleted;
        }

        await dbContext.SaveChangesAsync();
        return conversations.Count;
    }
```

> Verify against Plan 06 at execution time: `CleanupExpiredActionRecords` hard-deletes `Expired` rows — confirm no FK (`ProgramPlan.SourceAiActionId`, Plan 06) can reference an *Expired* action (only Executed actions are linked). If it can, switch the FK's delete behavior check or exclude referenced rows in the `Where`.

- [ ] **Step 3: Run — expect PASS**, then commit

```bash
git add server/FitMate.Services server/FitMate.Tests
git commit -m "feat(maintenance): retry, expired-action cleanup and conversation retention jobs"
```

---

### Task 6: DailyCostCheck job (cost alert via Serilog Warning)

**Files:**
- Modify: `server/FitMate.Services/Maintenance/MaintenanceJobService.cs`
- Test: `server/FitMate.Tests/Unit/Services/MaintenanceJobServiceTests.cs` (append)

**Interfaces:**
- Consumes: `AiRun` cost data (Plan 05/08), `ApplicationSettings.AiDailyCostAlertThreshold`.
- Produces: `DailyCostCheckAsync` — returns `1` when the alert fired, else `0`. Ops alerting hooks onto the Serilog Warning (which also lands in the Errors table via `SerilogDatabaseSink`) — no external alerting dependency.

- [ ] **Step 1: Write failing tests** (append):

```csharp
    private static async Task SeedAiRunCostAsync(SqliteTestDatabase db, decimal costUsd)
    {
        await using var seed = db.CreateContext();
        seed.AiRuns.Add(new AiRun
        {
            UserId = SqliteTestDatabase.UserId,
            Status = AiRunStatus.Succeeded,
            EstimatedCostUsd = costUsd,
        });
        await seed.SaveChangesAsync();
    }

    [Fact]
    public async Task DailyCostCheck_OverThreshold_LogsWarningAndReturnsOne()
    {
        using var db = new SqliteTestDatabase();
        await SeedAiRunCostAsync(db, 6.50m);
        var logger = new CapturingLogger<MaintenanceJobService>();
        await using var context = db.CreateContext();
        var service = CreateService(context, logger: logger,
            settings: new Dictionary<string, string?> { ["Ai:DailyCostAlertThreshold"] = "5.00" });

        var fired = await service.DailyCostCheckAsync(DateTime.UtcNow);

        Assert.Equal(1, fired);
        Assert.Contains(logger.Entries, e => e.Level == LogLevel.Warning && e.Message.Contains("cost"));
    }

    [Fact]
    public async Task DailyCostCheck_UnderThresholdOrDisabled_DoesNotFire()
    {
        using var db = new SqliteTestDatabase();
        await SeedAiRunCostAsync(db, 1.00m);
        var logger = new CapturingLogger<MaintenanceJobService>();
        await using var context = db.CreateContext();

        var underThreshold = await CreateService(context, logger: logger,
            settings: new Dictionary<string, string?> { ["Ai:DailyCostAlertThreshold"] = "5.00" })
            .DailyCostCheckAsync(DateTime.UtcNow);
        var disabled = await CreateService(context, logger: logger)
            .DailyCostCheckAsync(DateTime.UtcNow); // no threshold configured => disabled

        Assert.Equal(0, underThreshold);
        Assert.Equal(0, disabled);
        Assert.DoesNotContain(logger.Entries, e => e.Level == LogLevel.Warning);
    }
```

- [ ] **Step 2: Run — expect FAIL**, then implement:

```csharp
    public async Task<int> DailyCostCheckAsync(DateTime utcNow)
    {
        var threshold = settings.AiDailyCostAlertThreshold;
        if (threshold <= 0)
        {
            return 0; // alerting disabled
        }

        var dayStartUtc = utcNow.Date;
        var todaysCostUsd = await dbContext.AiRuns
            .Where(r => r.DateCreated >= dayStartUtc)
            .SumAsync(r => (decimal?)r.EstimatedCostUsd) ?? 0m;

        if (todaysCostUsd < threshold)
        {
            return 0;
        }

        logger.LogWarning(
            "AI daily cost {DailyCostUsd} USD exceeds alert threshold {ThresholdUsd} USD (UTC day {Day})",
            todaysCostUsd, threshold, dayStartUtc.ToString("yyyy-MM-dd"));
        return 1;
    }
```

> Verify against Plan 08's admin overview at execution time: the per-run cost field is best-guessed as `AiRun.EstimatedCostUsd`. If cost is instead derived (tokens × `AiModelPricing`), extract Plan 08's cost computation into a shared helper in `FitMate.Services/Ai` and call it from both places — never fork the cost formula.

- [ ] **Step 3: Run — expect PASS** (full `--filter MaintenanceJobServiceTests` suite now green), then commit

```bash
git add server/FitMate.Services server/FitMate.Tests
git commit -m "feat(maintenance): daily-cost-check alert job"
```

---

### Task 7: Scheduler hosted service + protected maintenance endpoint

**Files:**
- Create: `server/FitMate.Web/Infrastructure/MaintenanceSchedulerHostedService.cs`
- Create: `server/FitMate.Web/Attributes/MaintenanceGuardAttribute.cs`
- Create: `server/FitMate.Web/Controllers/Admin/MaintenanceController.cs`
- Modify: `server/FitMate.Web/Program.cs`
- Modify: `server/FitMate.Tests/TestInfrastructure/TestWebApplicationFactory.cs` (per-instance `extraSettings`)
- Test: `server/FitMate.Tests/Integration/MaintenanceApiTests.cs`

**Interfaces:**
- Consumes: `IMaintenanceJobService`, `ApplicationSettings` (Task 1), `IUserService.LoggedInUserId`/`LoggedInUserIsAdmin` (existing, same usage as `AdminGuardAttribute`).
- Produces the HTTP surface (used by platform cron and the Task 12 checklist):

```
GET  /api/admin/maintenance/jobs               → string[] (job names)
POST /api/admin/maintenance/run/{jobName}      → MaintenanceJobResult (Success=false envelope for unknown/failed jobs)
POST /api/admin/maintenance/run-all            → MaintenanceJobResult[]
Auth: admin user OR header X-Maintenance-Key == Maintenance:ApiKey (non-empty).
```

- [ ] **Step 1: Add `extraSettings` to `TestWebApplicationFactory`** so tests can set per-instance configuration (env vars are process-global and unsafe under xUnit parallelism). Add a ctor parameter and one line in `ConfigureWebHost`:

```csharp
    private readonly Dictionary<string, string?> extraSettings;

    public TestWebApplicationFactory(Dictionary<string, string?>? extraSettings = null)
    {
        this.extraSettings = extraSettings ?? [];
        // ... existing ctor body unchanged ...
    }

    // First line inside ConfigureWebHost, before builder.UseEnvironment("Testing"):
    builder.ConfigureAppConfiguration((_, configuration) => configuration.AddInMemoryCollection(extraSettings));
```

- [ ] **Step 2: Write failing integration tests** (`server/FitMate.Tests/Integration/MaintenanceApiTests.cs`; helper API confirmed against `IntegrationTestExtensions.cs`/`ApiResponse.cs`):

```csharp
using System.Net;
using System.Net.Http.Json;
using FitMate.Core.JsonModels.Maintenance;
using FitMate.Tests.TestInfrastructure;

namespace FitMate.Tests.Integration;

public class MaintenanceApiTests
{
    private static Dictionary<string, string?> WithApiKey(string key) => new()
    {
        ["Maintenance:ApiKey"] = key,
    };

    [Fact]
    public async Task RunJob_WithoutAuthOrKey_Returns401()
    {
        using var factory = new TestWebApplicationFactory(WithApiKey("cron-secret"));
        var client = factory.CreateApiClient();

        var response = await client.PostAsync("/api/admin/maintenance/run/expire-ai-actions", content: null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task RunJob_WithWrongKey_Returns401()
    {
        using var factory = new TestWebApplicationFactory(WithApiKey("cron-secret"));
        var client = factory.CreateApiClient();
        client.DefaultRequestHeaders.Add("X-Maintenance-Key", "wrong");

        var response = await client.PostAsync("/api/admin/maintenance/run/expire-ai-actions", content: null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task RunJob_WithValidKey_RunsAndReturnsResult()
    {
        using var factory = new TestWebApplicationFactory(WithApiKey("cron-secret"));
        var client = factory.CreateApiClient();
        client.DefaultRequestHeaders.Add("X-Maintenance-Key", "cron-secret");

        var response = await client.PostAsync("/api/admin/maintenance/run/expire-ai-actions", content: null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<MaintenanceJobResult>>();
        Assert.True(body!.Success);
        Assert.Equal("expire-ai-actions", body.Data!.JobName);
        Assert.Equal(0, body.Data.AffectedCount);
    }

    [Fact]
    public async Task RunJob_AsNonAdminUser_Returns403()
    {
        using var factory = new TestWebApplicationFactory(WithApiKey("cron-secret"));
        var client = await factory.CreateUserClientAsync("maintenance-nonadmin@test.local");

        var response = await client.PostAsync("/api/admin/maintenance/run/expire-ai-actions", content: null);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task RunJob_AsAdmin_Returns200()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateAdminClientAsync();

        var response = await client.PostAsync("/api/admin/maintenance/run/expire-ai-actions", content: null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task RunJob_UnknownName_ReturnsErrorEnvelope()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateAdminClientAsync();

        var response = await client.PostAsync("/api/admin/maintenance/run/definitely-not-a-job", content: null);

        var body = await response.Content.ReadFromJsonAsync<ApiResponse<MaintenanceJobResult>>();
        Assert.False(body!.Success);
        Assert.Contains("Unknown maintenance job", body.Error);
    }

    [Fact]
    public async Task JobsList_AsAdmin_ReturnsAllEightNames()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateAdminClientAsync();

        var response = await client.GetAsync("/api/admin/maintenance/jobs");

        var body = await response.Content.ReadFromJsonAsync<ApiResponse<List<string>>>();
        Assert.Equal(8, body!.Data!.Count);
    }
}
```

- [ ] **Step 3: Run — expect FAIL** (`dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter MaintenanceApiTests` — 404s, controller missing)

- [ ] **Step 4: Implement the guard** (`server/FitMate.Web/Attributes/MaintenanceGuardAttribute.cs` — same envelope/status pattern as `AdminGuardAttribute`):

```csharp
using System.Security.Cryptography;
using System.Text;
using FitMate.Core.Common;
using FitMate.Core.Settings;
using FitMate.Services.Users;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace FitMate.Web.Attributes;

/// <summary>
/// Allows a request when it carries a valid X-Maintenance-Key header (platform cron on
/// serverless hosts) OR when the caller is an authenticated admin. Key comparison is
/// constant-time; an empty configured key disables header auth entirely.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class MaintenanceGuardAttribute : Attribute, IAuthorizationFilter
{
    public const string ApiKeyHeaderName = "X-Maintenance-Key";

    public void OnAuthorization(AuthorizationFilterContext context)
    {
        var settings = context.HttpContext.RequestServices.GetRequiredService<ApplicationSettings>();
        var configuredKey = settings.MaintenanceApiKey;
        var providedKey = context.HttpContext.Request.Headers[ApiKeyHeaderName].FirstOrDefault();

        if (!string.IsNullOrEmpty(configuredKey)
            && !string.IsNullOrEmpty(providedKey)
            && CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(configuredKey),
                Encoding.UTF8.GetBytes(providedKey)))
        {
            return;
        }

        var userService = context.HttpContext.RequestServices.GetRequiredService<IUserService>();
        if (userService.LoggedInUserId == null)
        {
            context.Result = Error("Authentication is required.", StatusCodes.Status401Unauthorized);
            return;
        }

        if (!userService.LoggedInUserIsAdmin)
        {
            context.Result = Error("Administrator access is required.", StatusCodes.Status403Forbidden);
        }
    }

    private static JsonResult Error(string message, int statusCode) =>
        new(new CommonJsonModel<object?>(message)) { StatusCode = statusCode };
}
```

- [ ] **Step 5: Implement the controller** (`server/FitMate.Web/Controllers/Admin/MaintenanceController.cs`):

```csharp
using FitMate.DB;
using FitMate.Services.Maintenance;
using FitMate.Services.Users;
using FitMate.Web.Attributes;
using FitMate.Web.Controllers.Base;
using FitMate.Web.Extensions;
using Microsoft.AspNetCore.Mvc;

namespace FitMate.Web.Controllers.Admin;

[MaintenanceGuard]
[Route("api/admin/maintenance")]
public class MaintenanceController : BaseApiController
{
    private readonly IMaintenanceJobService maintenanceJobService;

    public MaintenanceController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService,
        IMaintenanceJobService maintenanceJobService)
        : base(logger, dbContext, userService)
    {
        this.maintenanceJobService = maintenanceJobService;
    }

    [HttpGet("jobs")]
    public ActionResult ListJobs() => this.ReturnJson(maintenanceJobService.JobNames);

    [HttpPost("run/{jobName}")]
    public async Task<ActionResult> Run(string jobName)
    {
        var result = await maintenanceJobService.RunJobAsync(jobName, DateTime.UtcNow);
        return result.Success
            ? this.ReturnJson(result)
            : this.ReturnJsonError(result.Error ?? "Maintenance job failed.", result);
    }

    [HttpPost("run-all")]
    public async Task<ActionResult> RunAll()
    {
        var results = await maintenanceJobService.RunAllAsync(DateTime.UtcNow);
        return this.ReturnJson(results);
    }
}
```

- [ ] **Step 6: Implement the scheduler** (`server/FitMate.Web/Infrastructure/MaintenanceSchedulerHostedService.cs`):

```csharp
using FitMate.Core.Settings;
using FitMate.Services.Maintenance;

namespace FitMate.Web.Infrastructure;

/// <summary>
/// In-process maintenance scheduler for hostings that keep the process alive (VPS/container).
/// Runs a catch-up pass one minute after startup (covers scale-to-zero wakes on Railway),
/// then every Maintenance:SchedulerIntervalMinutes. Serverless/cron platforms disable this
/// (Maintenance:EnableInProcessScheduler=false) and hit POST api/admin/maintenance/run-all instead.
/// </summary>
public class MaintenanceSchedulerHostedService : BackgroundService
{
    private readonly IServiceScopeFactory scopeFactory;
    private readonly ILogger<MaintenanceSchedulerHostedService> logger;
    private readonly TimeSpan interval;

    public MaintenanceSchedulerHostedService(
        IServiceScopeFactory scopeFactory,
        ApplicationSettings settings,
        ILogger<MaintenanceSchedulerHostedService> logger)
    {
        this.scopeFactory = scopeFactory;
        this.logger = logger;
        interval = TimeSpan.FromMinutes(Math.Max(1, settings.MaintenanceSchedulerIntervalMinutes));
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        using var timer = new PeriodicTimer(interval);
        do
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var maintenanceJobService = scope.ServiceProvider.GetRequiredService<IMaintenanceJobService>();
                await maintenanceJobService.RunAllAsync(DateTime.UtcNow);
            }
            catch (Exception ex)
            {
                // Individual job failures are already handled inside RunAllAsync; this guards
                // scope/DbContext construction failures so the timer loop never dies.
                logger.LogError(ex, "Maintenance scheduler tick failed");
            }
        }
        while (await WaitForNextTickSafeAsync(timer, stoppingToken));
    }

    private static async Task<bool> WaitForNextTickSafeAsync(PeriodicTimer timer, CancellationToken stoppingToken)
    {
        try
        {
            return await timer.WaitForNextTickAsync(stoppingToken);
        }
        catch (OperationCanceledException)
        {
            return false;
        }
    }
}
```

Register in `Program.cs` right after the DI block (never in the Testing environment — integration tests must stay deterministic):

```csharp
if (builder.Configuration.GetValue("Maintenance:EnableInProcessScheduler", defaultValue: true)
    && !builder.Environment.IsEnvironment("Testing"))
{
    builder.Services.AddHostedService<MaintenanceSchedulerHostedService>();
}
```

- [ ] **Step 7: Run — expect PASS**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter MaintenanceApiTests` (7 tests), then the full suite `dotnet test server/FitMate.sln` (the factory ctor change must not break existing tests — the parameter is optional).
Then regenerate types (new `MaintenanceJobResult` DTO): `dotnet build server/FitMate.Web/FitMate.Web.csproj` and `cd client && npm run process-types && npx tsc -b --noEmit`.

- [ ] **Step 8: Commit**

```bash
git add server/FitMate.Web server/FitMate.Tests client/src/types
git commit -m "feat(maintenance): scheduler hosted service and cron-triggerable admin endpoint"
```

---

### Task 8: Conversation export endpoint + data-retention documentation

**Files:**
- Create: `server/FitMate.Core/JsonModels/Ai/AiConversationExportModel.cs`
- Modify: `server/FitMate.Services/Ai/AiConversationService.cs` (+ its interface) — add `ExportAsync`
- Modify: `server/FitMate.Web/Controllers/AiConversationController.cs` — add export route
- Modify: `client/src/services/aiService.ts` — download helper + UI hook
- Create: `docs/DATA-RETENTION.md`
- Test: `server/FitMate.Tests/Unit/Services/AiConversationExportTests.cs`

**Interfaces:**
- Consumes: Plan 05's `AiConversation`/`AiMessage` and its conversation service + controller (best-guess file names above — verify against the landed Plan 05 files; the service may be named `AiConversationService` or live beside the orchestrator; add `ExportAsync` to whichever service owns conversation reads).
- Produces:

```csharp
// FitMate.Core/JsonModels/Ai/AiConversationExportModel.cs
using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.Ai;

public class AiConversationExportModel
{
    public long ConversationId { get; set; }
    public string? Title { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime ExportedAt { get; set; }
    public List<AiConversationExportMessageModel> Messages { get; set; } = [];
}

public class AiConversationExportMessageModel
{
    public AiMessageRole Role { get; set; }
    public string Content { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
```

and service method `Task<AiConversationExportModel?> ExportAsync(long conversationId, long userId)` (null = not found / not owned / soft-deleted), plus HTTP `GET api/ai/conversations/{id}/export` returning a JSON **file download**.

- [ ] **Step 1: Write failing tests** (`AiConversationExportTests.cs`):

```csharp
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.Ai;
using FitMate.Tests.TestInfrastructure;

namespace FitMate.Tests.Unit.Services;

public class AiConversationExportTests
{
    private static async Task<long> SeedConversationAsync(SqliteTestDatabase db, long userId)
    {
        await using var context = db.CreateContext();
        var conversation = new AiConversation { UserId = userId, Status = AiConversationStatus.Active, Title = "Leg day advice" };
        context.AiConversations.Add(conversation);
        await context.SaveChangesAsync();
        context.AiMessages.AddRange(
            new AiMessage { ConversationId = conversation.Id, Role = AiMessageRole.User, Content = "What should I train today?" },
            new AiMessage { ConversationId = conversation.Id, Role = AiMessageRole.Assistant, Content = "Leg day: squats first." });
        await context.SaveChangesAsync();
        return conversation.Id;
    }

    [Fact]
    public async Task Export_OwnConversation_ReturnsAllMessagesInOrder()
    {
        using var db = new SqliteTestDatabase();
        var conversationId = await SeedConversationAsync(db, SqliteTestDatabase.UserId);
        await using var context = db.CreateContext();
        var service = new AiConversationService(context); // verify ctor against landed Plan 05 service

        var export = await service.ExportAsync(conversationId, SqliteTestDatabase.UserId);

        Assert.NotNull(export);
        Assert.Equal(conversationId, export!.ConversationId);
        Assert.Equal("Leg day advice", export.Title);
        Assert.Equal(2, export.Messages.Count);
        Assert.Equal(AiMessageRole.User, export.Messages[0].Role);
    }

    [Fact]
    public async Task Export_OtherUsersConversation_ReturnsNull()
    {
        using var db = new SqliteTestDatabase();
        var conversationId = await SeedConversationAsync(db, SqliteTestDatabase.OtherUserId);
        await using var context = db.CreateContext();
        var service = new AiConversationService(context);

        Assert.Null(await service.ExportAsync(conversationId, SqliteTestDatabase.UserId));
    }
}
```

> Verify against Plan 05's landed service at execution time: its constructor likely takes more dependencies (redaction, snapshot, provider) — construct it the same way `AiConversationServiceTests` from Plan 05 does, or extract export into the leanest conversation-read service Plan 05 provides.

- [ ] **Step 2: Run — expect FAIL**, then implement `ExportAsync` on the conversation service:

```csharp
    public async Task<AiConversationExportModel?> ExportAsync(long conversationId, long userId)
    {
        var conversation = await dbContext.AiConversations
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == conversationId
                && c.UserId == userId
                && c.Status != AiConversationStatus.Deleted);
        if (conversation == null)
        {
            return null;
        }

        var messages = await dbContext.AiMessages
            .AsNoTracking()
            .Where(m => m.ConversationId == conversationId)
            .OrderBy(m => m.DateCreated)
            .ThenBy(m => m.Id)
            .Select(m => new AiConversationExportMessageModel
            {
                Role = m.Role,
                Content = m.Content,
                CreatedAt = m.DateCreated,
            })
            .ToListAsync();

        return new AiConversationExportModel
        {
            ConversationId = conversation.Id,
            Title = conversation.Title,
            CreatedAt = conversation.DateCreated,
            ExportedAt = DateTime.UtcNow,
            Messages = messages,
        };
    }
```

Messages are stored **post-redaction** (Plan 05), so the export contains exactly what the system retains — no additional filtering needed.

- [ ] **Step 3: Add the controller route** to the landed AI conversation controller (file download, deliberately NOT the `ReturnJson` envelope — the response body IS the artifact the user saves):

```csharp
    [HttpGet("{id}/export")]
    public async Task<ActionResult> Export(long id)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var export = await aiConversationService.ExportAsync(id, userId.Value);
        if (export == null)
        {
            return this.ReturnJsonError("Conversation not found.");
        }

        var bytes = System.Text.Json.JsonSerializer.SerializeToUtf8Bytes(export,
            new System.Text.Json.JsonSerializerOptions
            {
                PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase,
                WriteIndented = true,
                Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() },
            });
        return File(bytes, "application/json", $"fitmate-conversation-{id}.json");
    }
```

- [ ] **Step 4: Frontend download helper.** Add to the landed AI service module (`client/src/services/aiService.ts` best-guess — verify Plan 05's actual file). Use the repo's shared axios client `api` from `@/lib/api` (cookie auth + refresh interceptor; paths are relative to its `/api` base URL, see `workoutService.ts`) — the repo has no fetch-style helper:

```typescript
import api from "@/lib/api";

export async function exportAiConversation(conversationId: number): Promise<void> {
  const response = await api.get<Blob>(`ai/conversations/${conversationId}/export`, {
    responseType: "blob",
  });
  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `fitmate-conversation-${conversationId}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
```

Wire an "Export" menu item next to the existing Delete action in the conversation page component (verify the landed Plan 05 component under `client/src/pages/` at execution time). No handwritten TS interfaces — the endpoint returns a file, and `AiConversationExportModel` reaches `backend.ts` via type generation anyway.

- [ ] **Step 5: Write `docs/DATA-RETENTION.md`** (complete content):

```markdown
# FitMate Data Retention & Privacy

## Retention windows (configured in appsettings, enforced by maintenance jobs)

| Data | Config key | Default | Enforced by job |
|---|---|---|---|
| Temporary AI uploads (`ai-temp/` blobs) | `Ai:Retention:TemporaryUploadRetentionHours` | 24h | `delete-temporary-ai-uploads` |
| Expired AI action records | `Ai:Retention:ExpiredActionRetentionDays` | 30d | `cleanup-expired-action-records` |
| AI conversations (soft delete) | `Ai:Retention:ConversationRetentionDays` | 365d | `trim-conversation-history` |

## User-facing controls
- **Delete a conversation:** `DELETE /api/ai/conversations/{id}` — soft delete; it disappears from
  the user's lists immediately.
- **Export a conversation:** `GET /api/ai/conversations/{id}/export` — downloads the user's own
  conversation (title + messages) as JSON. Content is post-redaction: what you export is exactly
  what the system stores.

## What deletion does NOT remove
Deleting or ageing-out a conversation removes it from user-visible surfaces only. The following are
**billing, security and audit records** and always survive conversation deletion and retention jobs:
- `UsageEntry` / `UsageBucket` (subscription usage and quota accounting)
- `AiRun` / `AiToolExecution` (cost, token and tool audit trail)
- `BillingWebhookEvent`, `BillingCustomer`, `UserSubscription` (billing authority records)
- `Errors` (operational log sink) and auth token records

## Triggering maintenance
- Container/VPS: in-process scheduler (`Maintenance:EnableInProcessScheduler=true`, default) runs
  all jobs every `Maintenance:SchedulerIntervalMinutes` (default 60) plus once ~1 minute after boot.
- Serverless/cron: `POST /api/admin/maintenance/run-all` with header `X-Maintenance-Key:
  <Maintenance:ApiKey>` (or an admin session). Individual jobs: `POST /api/admin/maintenance/run/{jobName}`.
```

- [ ] **Step 6: Run everything**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter AiConversationExportTests` — PASS.
Then: `dotnet build server/FitMate.Web/FitMate.Web.csproj`, `cd client && npm run process-types && npm run lint && npx tsc -b --noEmit` — clean.

- [ ] **Step 7: Commit**

```bash
git add server/FitMate.Core server/FitMate.Services server/FitMate.Web server/FitMate.Tests client docs/DATA-RETENTION.md
git commit -m "feat(ai): conversation export endpoint and data-retention documentation"
```

---

### Task 9: Rate limiting ("ai" per-user, "auth" per-IP) with envelope 429s

**Files:**
- Modify: `server/FitMate.Web/Program.cs` (limiter registration + `app.UseRateLimiter()`)
- Modify: `server/FitMate.Web/Controllers/AuthController.cs` (attributes)
- Modify: the landed AI conversation controller (messages POST) and the exercise-recognition controller (Plan 10) (attributes)
- Modify: `server/FitMate.Web/appsettings.json`, `server/FitMate.Tests/TestInfrastructure/TestWebApplicationFactory.cs`
- Test: `server/FitMate.Tests/Integration/RateLimitingApiTests.cs`

**Interfaces:**
- Consumes: built-in `Microsoft.AspNetCore.RateLimiting` / `System.Threading.RateLimiting` (no NuGet package), `CommonJsonModel` envelope.
- Produces: policies `"ai"` (fixed window per user-id claim, fallback per-IP; defaults 10 req/60s) and `"auth"` (fixed window per IP; defaults 10 req/60s); config keys `RateLimiting:Ai:PermitLimit`, `RateLimiting:Ai:WindowSeconds`, `RateLimiting:Auth:PermitLimit`, `RateLimiting:Auth:WindowSeconds`.

- [ ] **Step 1: Write failing tests** (`RateLimitingApiTests.cs`):

```csharp
using System.Net;
using System.Net.Http.Json;
using FitMate.Tests.TestInfrastructure;

namespace FitMate.Tests.Integration;

public class RateLimitingApiTests
{
    [Fact]
    public async Task Login_OverAuthLimit_Returns429WithErrorEnvelope()
    {
        using var factory = new TestWebApplicationFactory(new Dictionary<string, string?>
        {
            ["RateLimiting:Auth:PermitLimit"] = "3",
        });
        var client = factory.CreateApiClient();

        HttpResponseMessage? last = null;
        for (var i = 0; i < 4; i++)
        {
            last = await client.LoginAsync($"ratelimit{i}@test.local", "WrongPassword1!");
        }

        Assert.Equal((HttpStatusCode)429, last!.StatusCode);
        var body = await last.Content.ReadFromJsonAsync<ApiResponse<object?>>();
        Assert.False(body!.Success);
        Assert.False(string.IsNullOrWhiteSpace(body.Error));
    }

    [Fact]
    public async Task AiMessages_OverAiLimit_Returns429()
    {
        using var factory = new TestWebApplicationFactory(new Dictionary<string, string?>
        {
            ["RateLimiting:Ai:PermitLimit"] = "3",
        });
        var client = await factory.CreateUserClientAsync("ai-ratelimit@test.local");

        HttpResponseMessage? last = null;
        for (var i = 0; i < 4; i++)
        {
            // A nonexistent conversation still counts: the limiter runs before the action.
            last = await client.PostAsJsonAsync("/api/ai/conversations/999999/messages", new { content = "hi" });
        }

        Assert.Equal((HttpStatusCode)429, last!.StatusCode);
    }

    [Fact]
    public async Task Login_UnderLimit_IsNotRateLimited()
    {
        using var factory = new TestWebApplicationFactory();
        var client = factory.CreateApiClient();

        var response = await client.LoginAsync("under-limit@test.local", "WrongPassword1!");

        Assert.NotEqual((HttpStatusCode)429, response.StatusCode);
    }
}
```

> Verify the messages route/body against the landed Plan 05 controller (`POST api/ai/conversations/{id}/messages`, request field name) at execution time.

- [ ] **Step 2: Run — expect FAIL** (no 429s; `--filter RateLimitingApiTests`)

- [ ] **Step 3: Register the limiter in `Program.cs`** (after `builder.Services.AddAuthorization();`):

```csharp
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;

var aiPermitLimit = builder.Configuration.GetValue("RateLimiting:Ai:PermitLimit", 10);
var aiWindowSeconds = builder.Configuration.GetValue("RateLimiting:Ai:WindowSeconds", 60);
var authPermitLimit = builder.Configuration.GetValue("RateLimiting:Auth:PermitLimit", 10);
var authWindowSeconds = builder.Configuration.GetValue("RateLimiting:Auth:WindowSeconds", 60);

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        // 429s use the standard error envelope (spec §71).
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        context.HttpContext.Response.ContentType = "application/json";
        context.HttpContext.Response.Headers.RetryAfter = "60";
        await context.HttpContext.Response.WriteAsJsonAsync(
            new CommonJsonModel<object?>(error: "Too many requests. Please wait a moment and try again.", data: null),
            cancellationToken);
    };

    // "ai": per authenticated user (falls back to IP for the unauthenticated edge case).
    options.AddPolicy("ai", httpContext => RateLimitPartition.GetFixedWindowLimiter(
        partitionKey: httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? httpContext.Connection.RemoteIpAddress?.ToString()
            ?? "anonymous",
        factory: _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = aiPermitLimit,
            Window = TimeSpan.FromSeconds(aiWindowSeconds),
            QueueLimit = 0,
        }));

    // "auth": per IP — protects credential endpoints before any identity exists.
    options.AddPolicy("auth", httpContext => RateLimitPartition.GetFixedWindowLimiter(
        partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "anonymous",
        factory: _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = authPermitLimit,
            Window = TimeSpan.FromSeconds(authWindowSeconds),
            QueueLimit = 0,
        }));
});
```

And in the pipeline, after `app.UseAuthorization();` (the "ai" partition key needs the authenticated `User`):

```csharp
app.UseRateLimiter();
```

- [ ] **Step 4: Apply the policies**

`AuthController` — add `using Microsoft.AspNetCore.RateLimiting;` and `[EnableRateLimiting("auth")]` on exactly these actions: `Register`, `Login`, `GoogleLogin`, `ForgotPassword`, `ResetPassword` (NOT `RefreshToken`/`Logout`/`ChangePassword` — `Logout`/`ChangePassword` are `[Authorize]`-guarded, `RefreshToken` is guarded by the rotating refresh-token cookie, and all three are legitimately chatty).

AI endpoints — `[EnableRateLimiting("ai")]` on the landed `POST api/ai/conversations/{id}/messages` action (Plan 05 controller) and the exercise-recognition upload action (Plan 10 — verify its controller/action name at execution time).

- [ ] **Step 5: Keep existing integration tests green.** In `TestWebApplicationFactory`'s ctor (with the other `Environment.SetEnvironmentVariable` calls) raise the default test limits so unrelated suites never trip them; the rate-limit tests above override per-instance via `extraSettings` (in-memory config is added later in the chain, so it wins):

```csharp
        Environment.SetEnvironmentVariable("RateLimiting__Auth__PermitLimit", "1000");
        Environment.SetEnvironmentVariable("RateLimiting__Ai__PermitLimit", "1000");
```

- [ ] **Step 6: Run — expect PASS**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter RateLimitingApiTests`, then the full suite `dotnet test server/FitMate.sln` (no collateral 429s).
Add the config keys with empty/default values to `appsettings.json` (`"RateLimiting": { "Ai": { "PermitLimit": "10", "WindowSeconds": "60" }, "Auth": { "PermitLimit": "10", "WindowSeconds": "60" } }`).

- [ ] **Step 7: Commit**

```bash
git add server/FitMate.Web server/FitMate.Tests
git commit -m "feat(security): rate limiting for AI and auth endpoints with envelope 429s"
```

---

### Task 10: Performance — indexes, query budgets, pagination caps, AI context caps

**Files:**
- Modify: `server/FitMate.DB/Configurations/WorkoutConfiguration.cs`, `AiMessageConfiguration.cs`, `UsageEntryConfiguration.cs` (the latter two landed with Plans 05/04)
- Create: migration `AddHardeningIndexes`
- Create: `server/FitMate.Tests/TestInfrastructure/QueryCountingInterceptor.cs`
- Modify: `server/FitMate.Tests/TestInfrastructure/SqliteTestDatabase.cs` (interceptor overload)
- Test: `server/FitMate.Tests/Unit/Services/QueryBudgetTests.cs`

**Interfaces:**
- Consumes: `ProgramPlanService.GetTodayAsync`/`GetCalendarAsync` (Plan 01), landed admin AI list services (Plan 08), landed snapshot/tool services (Plan 05).
- Produces: `QueryCountingInterceptor` (reusable), composite indexes, budget/caps tests.

- [ ] **Step 1: Index review and additions.** Current state verified in this repo: `Workouts` has separate indexes on `UserId` and `StartedAt` but **no composite** `(UserId, StartedAt)` — the workout-list/calendar/snapshot queries filter by user and order by date, so add it. For the Plan 04/05 tables, first check the landed configurations (`rg "HasIndex" server/FitMate.DB/Configurations`) and add only what is missing:

In `WorkoutConfiguration.cs` (keep the existing single-column indexes):

```csharp
        builder.HasIndex(x => new { x.UserId, x.StartedAt });
```

In `AiMessageConfiguration.cs` (if not already present):

```csharp
        builder.HasIndex(x => new { x.ConversationId, x.DateCreated });
```

In `UsageEntryConfiguration.cs` (if not already present):

```csharp
        builder.HasIndex(x => new { x.UserId, x.Feature, x.DateCreated });
```

Then: `dotnet ef migrations add AddHardeningIndexes --project server/FitMate.DB --startup-project server/FitMate.Web`
Expected: migration contains only `CreateIndex` operations (no drops). Inspect it.

- [ ] **Step 2: Query-counting infrastructure.**

`server/FitMate.Tests/TestInfrastructure/QueryCountingInterceptor.cs`:

```csharp
using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace FitMate.Tests.TestInfrastructure;

public sealed class QueryCountingInterceptor : DbCommandInterceptor
{
    public List<string> Commands { get; } = [];

    public int SelectCount => Commands.Count(c =>
        c.TrimStart().StartsWith("SELECT", StringComparison.OrdinalIgnoreCase));

    public void Reset() => Commands.Clear();

    public override InterceptionResult<DbDataReader> ReaderExecuting(
        DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result)
    {
        Commands.Add(command.CommandText);
        return base.ReaderExecuting(command, eventData, result);
    }

    public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
        DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result,
        CancellationToken cancellationToken = default)
    {
        Commands.Add(command.CommandText);
        return base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
    }
}
```

Add to `SqliteTestDatabase` (alongside the existing parameterless `CreateContext`):

```csharp
    public AppDbContext CreateContext(QueryCountingInterceptor interceptor)
    {
        var interceptedOptions = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(connection)
            .AddInterceptors(interceptor)
            .Options;
        return new AppDbContext(interceptedOptions);
    }
```

- [ ] **Step 3: Write the budget tests** (`QueryBudgetTests.cs`) — spec §87: today ≤ 4 SELECTs, calendar ≤ 3:

```csharp
using FitMate.Services.ProgramPlans;
using FitMate.Tests.TestInfrastructure;

namespace FitMate.Tests.Unit.Services;

public class QueryBudgetTests
{
    // SeedActivatedPlanAsync: private local helper — seed an ACTIVE fixed-weekday plan with
    // generated days exactly the way Plan 01's ProgramPlanServiceTests private helper
    // SeedPlanWithDaysAsync does (Plan 01 helpers are private statics inside their test
    // classes, so copy the seeding shape here; do NOT invent a shared seeding class).

    [Fact]
    public async Task GetToday_ActivePlan_ExecutesAtMostFourSelects()
    {
        using var db = new SqliteTestDatabase();
        var planId = await SeedActivatedPlanAsync(db); // local helper, copied from Plan 01's SeedPlanWithDaysAsync
        var interceptor = new QueryCountingInterceptor();
        await using var context = db.CreateContext(interceptor);
        var service = new ProgramPlanService(context, new ProgramPlanScheduleService(),
            new ProgramPlanDayService(context, TestWorkoutServiceFactory.Create(context)));

        interceptor.Reset();
        await service.GetTodayAsync(SqliteTestDatabase.UserId, new DateOnly(2026, 8, 5));

        Assert.True(interceptor.SelectCount <= 4,
            $"today ran {interceptor.SelectCount} SELECTs:\n{string.Join("\n---\n", interceptor.Commands)}");
    }

    [Fact]
    public async Task GetCalendar_ActivePlan_ExecutesAtMostThreeSelects()
    {
        using var db = new SqliteTestDatabase();
        var planId = await SeedActivatedPlanAsync(db);
        var interceptor = new QueryCountingInterceptor();
        await using var context = db.CreateContext(interceptor);
        var service = new ProgramPlanService(context, new ProgramPlanScheduleService(),
            new ProgramPlanDayService(context, TestWorkoutServiceFactory.Create(context)));

        interceptor.Reset();
        await service.GetCalendarAsync(planId, SqliteTestDatabase.UserId, 2026, 8);

        Assert.True(interceptor.SelectCount <= 3,
            $"calendar ran {interceptor.SelectCount} SELECTs:\n{string.Join("\n---\n", interceptor.Commands)}");
    }
}
```

The budget counts **SELECT** commands only — the belt-and-braces `MarkMissedDaysAsync` write inside these reads issues UPDATE/INSERT commands that are excluded by `SelectCount`. If a budget fails, fix the service (combine lookups into one query / project instead of `Include`) — do not raise the budget.

- [ ] **Step 4: Admin list N+1 + pagination audit.** Concrete review steps:
  1. `rg -n "Skip\(|Take\(" server/FitMate.Services/Ai server/FitMate.Services/Subscriptions` — every admin list method (Plan 08: conversations, runs, usage, costs, unsupported requests; subscription admin) must clamp exactly like the repo pattern (`AdminErrorService.cs:21`): `var pageSize = request.PageSize <= 0 ? 20 : Math.Min(request.PageSize, 100);`. Add the clamp where missing.
  2. `rg -n "Include\(" server/FitMate.Services/Ai` — admin list methods must not `Include` full graphs; convert any offender to a `.Select(new ...Model { ... })` projection (counts via `x.Collection.Count` inside the projection).
  3. For each fixed service add one named test in its existing test file, following this exact shape (example for the AI conversations list; adjust the landed service/request names):

```csharp
    [Fact]
    public async Task ListConversations_PageSizeAbove100_IsClampedTo100()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var service = new AdminAiConversationService(context); // verify landed name (Plan 08)

        var page = await service.ListAsync(new AdminAiConversationQueryRequest { Page = 1, PageSize = 5000 });

        Assert.Equal(100, page.PageSize);
    }
```

- [ ] **Step 5: AI context caps re-verification** (spec §86). For each cap, run the filter; if the landed Plan 05 suite already covers it, tick and move on; otherwise add the test to the landed tool/snapshot test file using its existing seeding helpers:

| Cap | Expected test name (add if missing) |
|---|---|
| Conversation window ≤ 30 messages | `BuildMessages_CapsConversationWindowAtThirtyMessages` |
| `get_recent_workouts` ≤ 20 | `GetRecentWorkouts_CapsAtTwenty` |
| `search_exercises` ≤ 30 | `SearchExercises_CapsAtThirty` |
| `get_exercise_history` ≤ 10 sessions | `GetExerciseHistory_CapsAtTenSessions` |
| `get_workout_templates` ≤ 50 | `GetWorkoutTemplates_CapsAtFifty` |

Each test seeds cap+5 rows, invokes the handler/orchestrator, asserts `Count == cap`. Example (recent workouts; adapt seeding to the landed handler test file):

```csharp
    [Fact]
    public async Task GetRecentWorkouts_CapsAtTwenty()
    {
        using var db = new SqliteTestDatabase();
        await using (var seed = db.CreateContext())
        {
            for (var i = 0; i < 25; i++)
            {
                seed.Workouts.Add(new Workout { UserId = SqliteTestDatabase.UserId, Name = $"W{i}", StartedAt = DateTime.UtcNow.AddDays(-i) });
            }
            await seed.SaveChangesAsync();
        }

        await using var context = db.CreateContext();
        var handler = CreateRecentWorkoutsHandler(context); // reuse the landed Plan 05 test helper
        var resultJson = await handler.ExecuteAsync("{}", CreateToolContext(SqliteTestDatabase.UserId), CancellationToken.None);

        Assert.Equal(20, CountResultItems(resultJson)); // reuse the landed suite's JSON assertion helper
    }
```

- [ ] **Step 6: Run + commit**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter QueryBudgetTests`, then the caps/pagination filters, then `dotnet test server/FitMate.sln`.

```bash
git add server/FitMate.DB server/FitMate.Services server/FitMate.Tests
git commit -m "perf(db): hardening indexes, query budgets, pagination clamps and AI context cap tests"
```

---

### Task 11: Idempotency audit (spec §85) — verify or add six named tests

**Files:**
- Test: `server/FitMate.Tests/Unit/Services/IdempotencyAuditTests.cs` (created ONLY for cases below that have no landed test; cases already covered stay where they are)

**Interfaces:** consumes only landed Plans 01/04/06/09 services. Produces no new production code — any behavior gap found here is a bug: fix it in the owning service using that plan's conventions, with the test below as the failing red test.

**Audit table — for each row: run the filter; if 0 tests match, add the named test.**

| # | Guarantee | Filter to run first | Test to add if missing |
|---|---|---|---|
| 1 | Program workout start (Plan 01) | `--filter "FullyQualifiedName~ProgramPlanDayServiceTests&FullyQualifiedName~Start"` | `StartAsync_SecondCall_ReturnsExistingWorkoutId` |
| 2 | Program activation transition (Plan 01) | `--filter "FullyQualifiedName~ProgramPlanServiceTests&FullyQualifiedName~Activate"` | `ActivateAsync_AlreadyActive_ThrowsWithoutDuplicatingDays` |
| 3 | AI action confirm token (Plan 06) | `--filter "FullyQualifiedName~AiAction&FullyQualifiedName~Confirm"` | `ConfirmAsync_SecondCallSameToken_DoesNotExecuteTwice` |
| 4 | Usage commit/release status guards (Plan 04) | `--filter "FullyQualifiedName~UsageService&(FullyQualifiedName~Commit\|FullyQualifiedName~Release)"` | `CommitAsync_SecondCall_DoesNotDoubleCount` + `ReleaseAsync_AfterCommit_DoesNotChangeBucket` |
| 5 | Webhook dedupe via unique EventId (Plan 09) | `--filter "FullyQualifiedName~BillingWebhook&FullyQualifiedName~Duplicate"` | `ProcessAsync_DuplicateEventId_ProcessesOnce` |
| 6 | Plan seeding by code match (Plan 04) | `--filter "FullyQualifiedName~PlanSeed"` | `SeedAsync_RunTwice_KeepsOneRowPerPlanCode` |

- [ ] **Step 1: Run all six filters and record which rows are already green.** (Plan 01's acceptance criteria say start-idempotency is covered; expect rows 1–2 to exist.)

- [ ] **Step 2: Add the missing tests** to `IdempotencyAuditTests.cs`. Concrete code for each (verify landed service ctors/method names per plan; the assertions are the contract):

```csharp
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Tests.Unit.Services;

public class IdempotencyAuditTests
{
    [Fact]
    public async Task ConfirmAsync_SecondCallSameToken_DoesNotExecuteTwice()
    {
        using var db = new SqliteTestDatabase();
        // Seed a PendingConfirmation AiAction exactly as the landed AiActionServiceTests does
        // (reuse its seeding helper), capture its ConfirmationToken.
        await using var context = db.CreateContext();
        var service = AiActionTestFactory.CreateService(context); // verify landed helper (Plan 06 tests)
        var actionId = await AiActionTestFactory.SeedPendingCreateExerciseAsync(db, SqliteTestDatabase.UserId);
        var token = (await context.AiActions.SingleAsync(a => a.Id == actionId)).ConfirmationToken;

        await service.ConfirmAsync(actionId, token, SqliteTestDatabase.UserId);
        var exercisesAfterFirst = await context.Exercises.CountAsync();

        // Second confirm with the same token must be a no-op (or a domain error) — never a re-execute.
        await Assert.ThrowsAnyAsync<Exception>(() => service.ConfirmAsync(actionId, token, SqliteTestDatabase.UserId));
        Assert.Equal(exercisesAfterFirst, await context.Exercises.CountAsync());
    }

    [Fact]
    public async Task CommitAsync_SecondCall_DoesNotDoubleCount()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var usageService = UsageTestFactory.CreateService(context); // verify landed helper (Plan 04 tests)
        var reservation = await usageService.ReserveAsync(SqliteTestDatabase.UserId, SubscriptionFeature.AiCoachMessages, 1);

        await usageService.CommitAsync(reservation.Id);
        var usedAfterFirst = await context.UsageBuckets.SumAsync(b => b.Used);

        await Assert.ThrowsAnyAsync<Exception>(() => usageService.CommitAsync(reservation.Id));
        Assert.Equal(usedAfterFirst, await context.UsageBuckets.SumAsync(b => b.Used));
    }

    [Fact]
    public async Task ReleaseAsync_AfterCommit_DoesNotChangeBucket()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var usageService = UsageTestFactory.CreateService(context);
        var reservation = await usageService.ReserveAsync(SqliteTestDatabase.UserId, SubscriptionFeature.AiCoachMessages, 1);
        await usageService.CommitAsync(reservation.Id);
        var usedAfterCommit = await context.UsageBuckets.SumAsync(b => b.Used);

        await Assert.ThrowsAnyAsync<Exception>(() => usageService.ReleaseAsync(reservation.Id));
        Assert.Equal(usedAfterCommit, await context.UsageBuckets.SumAsync(b => b.Used));
    }

    [Fact]
    public async Task ProcessAsync_DuplicateEventId_ProcessesOnce()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var webhookService = BillingWebhookTestFactory.CreateService(context); // verify landed helper (Plan 09 tests)
        var payload = BillingWebhookTestFactory.CheckoutCompletedPayload("evt_hardening_1", SqliteTestDatabase.UserId);

        await webhookService.ProcessAsync(payload);
        await webhookService.ProcessAsync(payload); // second delivery of the SAME event id

        Assert.Equal(1, await context.BillingWebhookEvents.CountAsync(e => e.EventId == "evt_hardening_1"));
        Assert.Equal(1, await context.UserSubscriptions.CountAsync(s => s.UserId == SqliteTestDatabase.UserId));
    }

    [Fact]
    public async Task SeedAsync_RunTwice_KeepsOneRowPerPlanCode()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();

        await PlanSeeder.SeedAsync(context); // verify landed seeder entry point (Plan 04)
        await PlanSeeder.SeedAsync(context);

        var codes = await context.Plans.Select(p => p.Code).ToListAsync();
        Assert.Equal(codes.Distinct().Count(), codes.Count);
        Assert.Equal(3, codes.Count); // Free / Plus / Pro
    }
}
```

> Every `*TestFactory` reference above is a stand-in for the landed plan's own test seeding helpers — open the landed test file named in the audit table's filter column and reuse its construction code verbatim. Do not build new fakes for services that already have test factories.

- [ ] **Step 3: Run — all six rows green**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter IdempotencyAuditTests` plus the six audit filters.

- [ ] **Step 4: Commit**

```bash
git add server/FitMate.Tests server/FitMate.Services
git commit -m "test(hardening): idempotency audit for confirm, start, usage, webhook and seeding"
```

---

### Task 12: Security sweep — convention test + committed checklist

**Files:**
- Create: `server/FitMate.Tests/Integration/ControllerAuthorizationConventionTests.cs`
- Create: `docs/SECURITY-CHECKLIST.md`

**Interfaces:** consumes everything landed. Produces the reflection-based authorization convention test (fails the build if a future controller ships unguarded) and the committed checklist with per-item evidence.

- [ ] **Step 1: Write the convention test:**

```csharp
using FitMate.Web.Attributes;
using FitMate.Web.Controllers.Base;
using Microsoft.AspNetCore.Authorization;

namespace FitMate.Tests.Integration;

public class ControllerAuthorizationConventionTests
{
    // Controllers with intentionally anonymous surface. Every entry must be justified in
    // docs/SECURITY-CHECKLIST.md. Verify this list against the landed controllers before finalizing.
    private static readonly string[] AllowedWithoutClassGuard =
    [
        "AuthController",          // login/register are anonymous by design; sensitive actions rate-limited
        "MuscleGroupController",   // anonymous lookup endpoint (existing behavior, read-only reference data)
        // MaintenanceController is NOT listed: its [MaintenanceGuard] class attribute satisfies the
        // check below — listing it here would mask a regression that removes the guard.
    ];

    [Fact]
    public void EveryApiController_HasAnAuthorizationGuard()
    {
        var controllerTypes = typeof(BaseApiController).Assembly.GetTypes()
            .Where(t => t.IsSubclassOf(typeof(BaseApiController)) && !t.IsAbstract)
            .ToList();

        Assert.NotEmpty(controllerTypes);
        foreach (var controller in controllerTypes)
        {
            if (AllowedWithoutClassGuard.Contains(controller.Name))
            {
                continue;
            }

            var guarded = controller.GetCustomAttributes(inherit: true).Any(a =>
                a is AuthorizeAttribute or AdminGuardAttribute or MaintenanceGuardAttribute);
            Assert.True(guarded, $"{controller.Name} has no [Authorize]/[AdminGuard]/[MaintenanceGuard] class attribute.");
        }
    }

    [Fact]
    public void EveryAdminController_UsesAdminOrMaintenanceGuard()
    {
        var adminControllers = typeof(BaseApiController).Assembly.GetTypes()
            .Where(t => t.IsSubclassOf(typeof(BaseApiController)) && !t.IsAbstract
                && t.Namespace != null && t.Namespace.Contains("Controllers.Admin"))
            .ToList();

        Assert.NotEmpty(adminControllers);
        foreach (var controller in adminControllers)
        {
            var guarded = controller.GetCustomAttributes(inherit: true)
                .Any(a => a is AdminGuardAttribute or MaintenanceGuardAttribute);
            Assert.True(guarded, $"{controller.Name} is under Controllers.Admin but lacks [AdminGuard]/[MaintenanceGuard].");
        }
    }
}
```

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter ControllerAuthorizationConventionTests` — if any landed Plan 05–10 controller fails, **fix the controller** (add the guard), never widen the allow-list without writing the justification into the checklist.

- [ ] **Step 2: Execute the sweep and write `docs/SECURITY-CHECKLIST.md`.** Run every "Evidence" command/filter and replace each `[ ]` with `[x]` only after seeing it pass; where a file reference is a best guess (marked †), correct it to the landed path. Full initial content:

```markdown
# FitMate Security Checklist (Phase 11 sweep — spec §71/72/73)

Each item lists its evidence: a command that was run and passed, or a test/file reference.
Re-run this sweep whenever a new controller, tool, or upload path ships.

## Authentication & ownership
- [ ] Every API controller carries [Authorize]/[AdminGuard]/[MaintenanceGuard] —
      `dotnet test --filter ControllerAuthorizationConventionTests` (reflection-based, fails CI on regressions).
- [ ] Every service read/write filters by `userId` (ownership): spot-audit via
      `rg -n "== userId|UserId == userId" server/FitMate.Services` reviewed per feature; cross-user
      access covered by tests: `GetById_OtherUsersPlan_ReturnsNull` (Plan 01),
      `Export_OtherUsersConversation_ReturnsNull` (Plan 11 Task 8), Plan 05/06 ownership tests †.
- [ ] Admin routes admin-only through HTTP: `AuthorizationApiTests` (401/403/200 matrix) +
      `EveryAdminController_UsesAdminOrMaintenanceGuard` + Plan 08's admin integration tests †.
- [ ] Maintenance endpoint: API key compared constant-time (`CryptographicOperations.FixedTimeEquals`
      in `MaintenanceGuardAttribute`); empty configured key disables header auth; `MaintenanceApiTests`.

## AI safety
- [ ] Tool allow-list only: the orchestrator resolves tools exclusively from registered
      `IAiToolHandler.Name` values (roadmap contract); unknown tool names are rejected —
      evidence: Plan 05's allow-list test †.
- [ ] Tool arguments validated against typed DTOs before execution (Plan 05/06 arg-validation tests †).
- [ ] Confirmation-before-mutation: every mutating flow goes through AiAction pending → user confirm
      (Plan 06 tests; idempotency re-verified by `ConfirmAsync_SecondCallSameToken_DoesNotExecuteTwice`).
- [ ] Prompt-injection resistance line present in the system prompt — evidence:
      `rg -n "instructions.*not.*override|ignore.*previous" server/FitMate.Services/Ai` † (system prompt
      builder must state that user/tool content never overrides these rules).
- [ ] Medical-safety behavior present in the system prompt: "not a medical professional" + advise
      professional evaluation on acute symptoms — evidence: `rg -in "medical" server/FitMate.Services/Ai` †.
- [ ] Redaction before storage: messages persisted post-`IAiRedactionService` (Plan 05 tests †).
- [ ] No secrets in prompts: prompt builder consumes only training-domain data — evidence:
      `rg -n "SigningKey|ApiKey|Password|ConnectionString" server/FitMate.Services/Ai` returns no
      prompt-building usages.

## Input & upload validation
- [ ] File uploads constrained (size/content type) via `UploadConstraints` + Plan 10 recognition
      endpoint validation tests †.
- [ ] Model-validation 400s use the envelope and are logged (Program.cs InvalidModelStateResponseFactory).

## Billing & webhooks
- [ ] Webhook signature verified inside FitMate.Integrations (Plan 09 tests †); events deduplicated by
      unique EventId (`ProcessAsync_DuplicateEventId_ProcessesOnce`).
- [ ] Webhook is the single authority for subscription state (Plan 09).

## Logging & records
- [ ] No raw auth data in logs: `SerilogHttpContextDataEnricher` records path/query/user-agent/user-id
      only — tokens travel in the Authorization header or Token cookie, neither is enriched. Query
      strings carry no tokens (JWT is never passed as a query parameter — `rg -n "token=" client/src`).
- [ ] Billing/usage/security records survive retention and user deletions (docs/DATA-RETENTION.md;
      `TrimConversationHistory_SoftDeletesOldConversations_NeverTouchesUsageRecords`).
- [ ] Rate limiting: "ai" (per user) and "auth" (per IP) policies, envelope 429s (`RateLimitingApiTests`).

† = verify/replace with the landed file or test name while executing this checklist.
```

- [ ] **Step 3: Close the loop.** Any unchecked item after running its evidence = a finding: fix it inside this task (add the missing guard/validation/prompt line + its test in the owning feature's style), then check the box with the new evidence. The task is not done with an unchecked box left in the file.

- [ ] **Step 4: Run the full suite one final time**

Run: `dotnet build server/FitMate.sln` && `dotnet test server/FitMate.sln`, then `cd client && npm run lint && npx tsc -b --noEmit`.
Expected: everything green.

- [ ] **Step 5: Commit**

```bash
git add server/FitMate.Tests docs/SECURITY-CHECKLIST.md
git commit -m "docs(security): phase-11 security sweep checklist and authorization convention tests"
```

---

## Acceptance criteria (Plan 11 done)

- `MaintenanceJobService` exposes eight idempotent jobs behind stable kebab-case names; each has its own unit test proving effect + second-run-affects-zero; `RunAllAsync` survives individual job failures.
- Overdue program-day marking runs as a job (single source of truth stays `MarkMissedDaysAsync`); request-boundary calls remain as belt-and-braces.
- Pending AI actions past `ExpiresAt` expire; active usage reservations past expiry expire **and** release their bucket `Reserved` without touching `Used`; `ai-temp/` blobs older than the configured hours are deleted; failed `AiJob`s with < 3 attempts are re-dispatched; expired actions past retention are hard-deleted; conversations past retention are soft-deleted with billing/usage/audit records provably untouched.
- Maintenance is triggerable both by the in-process scheduler (`Maintenance:EnableInProcessScheduler`, default true, disabled in Testing) and by `POST api/admin/maintenance/run/{jobName}` / `run-all` guarded by admin **or** constant-time-compared `X-Maintenance-Key` (401/403/200 matrix covered by integration tests). Deployment reality (Railway container, scale-to-zero, no worker project) is documented in this plan's header.
- `GET api/ai/conversations/{id}/export` downloads the caller's own conversation as JSON (ownership + soft-delete respected); `docs/DATA-RETENTION.md` documents retention windows and that billing/usage/security records survive deletion.
- Rate limiting: "ai" policy (per user-id claim) on the AI message + exercise-recognition endpoints and "auth" policy (per IP) on credential endpoints; 429 responses use the `CommonJsonModel` envelope; limits configurable; existing test suites unaffected.
- Idempotency audit: all six guarantees (action confirm, program start, webhook dedupe, usage commit/release, activation transition, plan seeding) covered by the named tests in Task 11's table.
- Performance: `(UserId, StartedAt)`, `(ConversationId, DateCreated)`, `(UserId, Feature, DateCreated)` composite indexes exist (single migration, no drops); today ≤ 4 SELECTs and calendar ≤ 3 asserted by `QueryBudgetTests`; every admin list clamps page size to ≤ 100 with projection DTOs; AI context caps (30 messages / 20 workouts / 30 search / 10 history / 50 templates) each have a named test.
- Security: `ControllerAuthorizationConventionTests` green; `docs/SECURITY-CHECKLIST.md` committed with every box checked and evidence references; `Ai:DailyCostAlertThreshold` fires a Serilog Warning (visible in the Errors table) via the `daily-cost-check` job.
- `dotnet build server/FitMate.sln`, `dotnet test server/FitMate.sln`, and `cd client && npm run lint && npx tsc -b --noEmit` all pass.
