# AI Admin, Unsupported Request Tracking & Subscription Administration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins get full observability over the AI subsystem (overview metrics, conversations, runs, usage, costs), the AI reports functionality FitMate cannot do via a deduplicated `report_unsupported_request` tool that builds a product backlog, and admins manage subscription plans, user subscriptions (with plan overrides) and usage buckets — all behind the existing `[AdminGuard]` authorization (spec §7.6, §13.3, §52–55, §57–58).

**Architecture:** A new `UnsupportedAiRequest` + `UnsupportedAiRequestOccurrence` entity pair records deduplicated unsupported-feature reports keyed by `(Category, NormalizedKey)`; the `report_unsupported_request` tool handler (Plan 05's `IAiToolHandler` contract) writes through `IUnsupportedRequestService`. Read-only admin services (`IAdminAiService`, `IAdminUnsupportedRequestService`, `IAdminSubscriptionPlanService`, `IAdminSubscriptionService`) aggregate over the AI entities from Plans 05/06 and subscription entities from Plan 04, exposed by three admin controllers under `api/admin/ai`, `api/admin/subscription-plans`, `api/admin/subscriptions` (+ `api/admin/usage`). The React AdminPanel gains seven new grid/dashboard pages following the existing ErrorGrid pattern (MUI DataGrid via `EntityGrid`, `PagedResponse` server pagination, recharts `LineChart`/`StatTile` which already exist — no new dependencies).

**Tech Stack:** .NET 9, EF Core + Npgsql (Sqlite in tests), xUnit, Reinforced.Typings type export, React 19 + TypeScript + MUI X DataGrid + recharts (all already in the repo).

## Global Constraints

- Follow repo conventions (roadmap D4): user-facing services take `(request, long userId)` and no CancellationToken; **admin services follow the existing `AdminErrorService` pattern and take `(request)` only** — the `[AdminGuard]` attribute already established that admin scope needs no per-user filter. The only CancellationToken in this plan is inside `IAiToolHandler.ExecuteAsync` (Plan 05 contract).
- Controllers extend `BaseApiController(ILogger<BaseApiController>, AppDbContext, IUserService)` and return `this.ReturnJson(...)`; business failures throw `FitMateException` (mapped to a 400 error envelope by `LogApiErrorAttribute`).
- Admin controllers use `[AdminGuard]` (`server/FitMate.Web/Attributes/AdminGuardAttribute.cs`) — NOT `[Authorize(Roles=...)]`.
- DTOs live in `server/FitMate.Core/JsonModels/AdminAi/` and `AdminSubscriptions/` — auto-exported to `client/src/types/backend.ts` by `dotnet build server/FitMate.Web/FitMate.Web.csproj`, then `npm run process-types` in `client/`. **Never write TS interfaces by hand for API models.**
- Entities inherit `BaseEntity`; `AppDbContext.SaveChangesAsync()` stamps `DateCreated`/`DateModified` — never set them manually. Configurations are picked up by `ApplyConfigurationsFromAssembly`.
- **Sqlite test compatibility:** never `Sum`/`OrderBy` on `decimal` in SQL — cast to `(double)` inside LINQ (`Sum(r => (double)r.EstimatedCost)`) or aggregate in memory. Percentiles are computed in memory over the filtered window (spec §53 allows this).
- Admin conversation LIST endpoints must never select `AiMessage.Content` (spec §54). The DETAIL endpoint passes every message body through `IAiRedactionService.RedactText` and honors `UserAiPreferences.AllowAdminContentReview == false` by replacing content with `[content hidden by user preference]` (spec §13.3).
- This plan depends on Plans 03/04/05/06 being merged. Their exact member names come from the roadmap Shared Contracts; where a property below is a best guess it carries a "verify at execution time" note — resolve it against the merged code, never by inventing a parallel type.
- Backend commands: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter <Name>`; `dotnet build server/FitMate.sln`. Frontend: `cd client`, `npm run lint`, `npx tsc -b --noEmit`. After DTO changes: `dotnet build server/FitMate.Web/FitMate.Web.csproj` then `npm run process-types`.
- All commands run from repo root `c:\Users\damian\Documents\Github\FitMate`.

## File Structure

```
server/FitMate.DB/
├── Enums/UnsupportedRequestStatus.cs                                (Task 1)
├── Entities/UnsupportedAiRequest.cs, UnsupportedAiRequestOccurrence.cs (Task 1)
├── Configurations/UnsupportedAiRequestConfiguration.cs,
│                  UnsupportedAiRequestOccurrenceConfiguration.cs    (Task 1)
├── AppDbContext.cs (modify: 2 DbSets)                               (Task 1)
└── Migrations/xxx_AddUnsupportedAiRequests.cs (generated)           (Task 1)

server/FitMate.Services/Ai/Unsupported/
├── UnsupportedRequestKeyNormalizer.cs                               (Task 2)
├── IUnsupportedRequestService.cs, UnsupportedRequestService.cs      (Task 2)
├── UnsupportedRequestMapper.cs                                      (Task 2)
└── ReportUnsupportedRequestToolHandler.cs                           (Task 3)

server/FitMate.Services/Ai/Prompts/system-v1.txt (modify — Plan 05 file) (Task 3)

server/FitMate.Core/JsonModels/AdminAi/
├── RecordUnsupportedRequestRequest.cs                               (Task 2)
├── UnsupportedAiRequestModel.cs, UnsupportedRequestOccurrenceModel.cs,
│   UnsupportedRequestQueryRequest.cs, UpdateUnsupportedRequestRequest.cs (Task 4)
├── AiAdminOverviewModel.cs (+ AiToolUsageModel, AiUserCostModel,
│   AiCostByDayModel, AiCostByPlanModel, UnsupportedCategoryCountModel) (Task 5)
├── AiConversationListItemModel.cs, AiConversationQueryRequest.cs,
│   AiConversationDetailModel.cs (+ AiAdminMessageModel,
│   AiAdminToolExecutionModel, AiAdminActionModel)                   (Task 6)
└── AiAdminRunModel.cs, AiRunQueryRequest.cs,
    AiUsageSummaryModel.cs, AiCostSummaryModel.cs                    (Task 7)

server/FitMate.Services/AdminAi/
├── IAdminUnsupportedRequestService.cs, AdminUnsupportedRequestService.cs (Task 4)
├── IAdminAiService.cs, AdminAiService.cs                            (Tasks 5–7)

server/FitMate.Web/Controllers/Admin/AdminAiController.cs            (Task 8)
server/FitMate.Web/Program.cs (modify: DI)                           (Tasks 3, 8, 11)

server/FitMate.Core/JsonModels/AdminSubscriptions/
├── SubscriptionPlanAdminModel.cs (+ PlanPriceModel, PlanEntitlementModel),
│   SavePlanRequest.cs (+ PlanPriceRequest, PlanEntitlementRequest)  (Task 9)
└── UserSubscriptionAdminModel.cs, SubscriptionQueryRequest.cs,
    AssignPlanOverrideRequest.cs, UserUsageAdminModel.cs, UsageQueryRequest.cs (Task 10)

server/FitMate.Services/AdminSubscriptions/
├── IAdminSubscriptionPlanService.cs, AdminSubscriptionPlanService.cs (Task 9)
└── IAdminSubscriptionService.cs, AdminSubscriptionService.cs        (Task 10)

server/FitMate.Web/Controllers/Admin/AdminSubscriptionPlanController.cs,
                                    AdminSubscriptionController.cs,
                                    AdminUsageController.cs          (Task 11)

server/FitMate.Tests/Unit/Services/
├── UnsupportedRequestServiceTests.cs                                (Task 2)
├── ReportUnsupportedRequestToolHandlerTests.cs                      (Task 3)
├── AdminUnsupportedRequestServiceTests.cs                           (Task 4)
├── AdminAiServiceTests.cs                                           (Tasks 5–7)
├── AdminSubscriptionPlanServiceTests.cs                             (Task 9)
└── AdminSubscriptionServiceTests.cs                                 (Task 10)
server/FitMate.Tests/Integration/AdminAiApiTests.cs                  (Task 8)
server/FitMate.Tests/Integration/AdminSubscriptionApiTests.cs        (Task 11)

client/src/
├── services/adminService.ts (modify)                                (Task 12)
├── types/index.ts (modify: aliases)                                 (Task 12)
├── pages/AdminPanel/AiOverview/{AiOverview.tsx, hooks/useAiOverviewPage.ts, index.ts} (Task 13)
├── pages/AdminPanel/AiConversationsGrid/{AiConversationsGrid.tsx, columns.tsx,
│   hooks/useAiConversationsPage.ts, index.ts}                       (Task 14)
├── pages/AdminPanel/AiConversationDetail/{AiConversationDetail.tsx, index.ts} (Task 14)
├── pages/AdminPanel/AiRunsGrid/{AiRunsGrid.tsx, columns.tsx,
│   hooks/useAiRunsPage.ts, index.ts}                                (Task 14)
├── pages/AdminPanel/UnsupportedRequestsGrid/{UnsupportedRequestsGrid.tsx, columns.tsx,
│   hooks/useUnsupportedRequestsPage.ts,
│   components/UnsupportedRequestEditorModal.tsx, index.ts}          (Task 15)
├── pages/AdminPanel/SubscriptionPlansGrid/{SubscriptionPlansGrid.tsx, columns.tsx,
│   hooks/useSubscriptionPlansPage.ts, components/PlanEditorModal.tsx, index.ts} (Task 16)
├── pages/AdminPanel/SubscriptionsGrid/{SubscriptionsGrid.tsx, columns.tsx,
│   hooks/useSubscriptionsPage.ts, components/OverrideDialog.tsx, index.ts} (Task 16)
├── pages/AdminPanel/UsageGrid/{UsageGrid.tsx, columns.tsx,
│   hooks/useUsagePage.ts, index.ts}                                 (Task 16)
├── pages/AdminPanel/AdminPanel.tsx (modify: tiles)                  (Task 16)
├── pages/AdminPanel/index.ts (modify: exports)                      (Task 16)
└── routes.tsx (modify: /management routes)                          (Task 16)
```

---

### Task 1: UnsupportedAiRequest entities, enum, configuration, migration

**Files:**
- Create: `server/FitMate.DB/Enums/UnsupportedRequestStatus.cs`
- Create: `server/FitMate.DB/Entities/UnsupportedAiRequest.cs`, `UnsupportedAiRequestOccurrence.cs`
- Create: `server/FitMate.DB/Configurations/UnsupportedAiRequestConfiguration.cs`, `UnsupportedAiRequestOccurrenceConfiguration.cs`
- Modify: `server/FitMate.DB/AppDbContext.cs` (2 DbSets)
- Test: existing `server/FitMate.Tests/Unit/Database/AppDbContextTests.cs` must still pass (`EnsureCreated` exercises the model)

**Interfaces:**
- Consumes: `BaseEntity`. `UserId`/`ConversationId`/`MessageId` are **plain reference columns with no FK** — the unsupported-request backlog must survive user/conversation deletion and retention purges (Plan 11). Only the occurrence→parent FK is hard (cascade).
- Produces: the two entities + enum exactly as below; Tasks 2–8 and the admin frontend use these property names.

- [ ] **Step 1: Write the enum** (`server/FitMate.DB/Enums/UnsupportedRequestStatus.cs`; if Plan 05 already created this enum file with these exact members, skip creation and reuse it — the members below are the spec's, so any existing file must already match)

```csharp
namespace FitMate.DB.Enums;

public enum UnsupportedRequestStatus
{
    New = 1,
    Reviewed = 2,
    Planned = 3,
    Implemented = 4,
    Rejected = 5,
}
```

- [ ] **Step 2: Write the entities**

`server/FitMate.DB/Entities/UnsupportedAiRequest.cs`:

```csharp
using FitMate.DB.Entities.Base;
using FitMate.DB.Enums;

namespace FitMate.DB.Entities;

public class UnsupportedAiRequest : BaseEntity
{
    public long UserId { get; set; }             // first reporter (reference only, no FK)
    public long ConversationId { get; set; }     // AiConversation id of first report (reference only)
    public long? MessageId { get; set; }         // AiMessage id of first report (reference only)
    public string Category { get; set; } = string.Empty;
    public string NormalizedKey { get; set; } = string.Empty;
    public string RequestedFunctionality { get; set; } = string.Empty;
    public string? UserIntentSummary { get; set; }
    public string? SuggestedFallback { get; set; }
    public UnsupportedRequestStatus Status { get; set; }
    public int OccurrenceCount { get; set; }
    public DateTime FirstRequestedAt { get; set; }
    public DateTime LastRequestedAt { get; set; }
    public string? AdminNotes { get; set; }
    public string? ExternalTrackingUrl { get; set; }
    public string? ExternalTrackingKey { get; set; }

    public ICollection<UnsupportedAiRequestOccurrence> Occurrences { get; set; } = [];
}
```

`server/FitMate.DB/Entities/UnsupportedAiRequestOccurrence.cs` (the spec's `CreatedAt` is served by `BaseEntity.DateCreated`, which `SaveChangesAsync` stamps — no extra column):

```csharp
using FitMate.DB.Entities.Base;

namespace FitMate.DB.Entities;

public class UnsupportedAiRequestOccurrence : BaseEntity
{
    public long UnsupportedAiRequestId { get; set; }
    public long UserId { get; set; }
    public long ConversationId { get; set; }
    public long? MessageId { get; set; }

    public UnsupportedAiRequest UnsupportedAiRequest { get; set; } = null!;
}
```

- [ ] **Step 3: Write the configurations**

`server/FitMate.DB/Configurations/UnsupportedAiRequestConfiguration.cs`:

```csharp
using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

public class UnsupportedAiRequestConfiguration : IEntityTypeConfiguration<UnsupportedAiRequest>
{
    public void Configure(EntityTypeBuilder<UnsupportedAiRequest> builder)
    {
        builder.Property(x => x.Category).HasMaxLength(100).IsRequired();
        builder.Property(x => x.NormalizedKey).HasMaxLength(500).IsRequired();
        builder.Property(x => x.RequestedFunctionality).HasMaxLength(1000).IsRequired();
        builder.Property(x => x.UserIntentSummary).HasMaxLength(2000);
        builder.Property(x => x.SuggestedFallback).HasMaxLength(2000);
        builder.Property(x => x.AdminNotes).HasMaxLength(4000);
        builder.Property(x => x.ExternalTrackingUrl).HasMaxLength(1000);
        builder.Property(x => x.ExternalTrackingKey).HasMaxLength(100);

        builder.HasIndex(x => new { x.Category, x.NormalizedKey }).IsUnique();
        builder.HasIndex(x => x.Status);
        builder.HasIndex(x => x.LastRequestedAt);
    }
}
```

`server/FitMate.DB/Configurations/UnsupportedAiRequestOccurrenceConfiguration.cs`:

```csharp
using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

public class UnsupportedAiRequestOccurrenceConfiguration : IEntityTypeConfiguration<UnsupportedAiRequestOccurrence>
{
    public void Configure(EntityTypeBuilder<UnsupportedAiRequestOccurrence> builder)
    {
        builder.HasOne(x => x.UnsupportedAiRequest)
            .WithMany(x => x.Occurrences)
            .HasForeignKey(x => x.UnsupportedAiRequestId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => x.UnsupportedAiRequestId);
        builder.HasIndex(x => x.UserId);
    }
}
```

In `server/FitMate.DB/AppDbContext.cs` add after the last existing DbSet (Plans 04–06 will have added theirs above):

```csharp
    public DbSet<UnsupportedAiRequest> UnsupportedAiRequests => Set<UnsupportedAiRequest>();
    public DbSet<UnsupportedAiRequestOccurrence> UnsupportedAiRequestOccurrences => Set<UnsupportedAiRequestOccurrence>();
```

- [ ] **Step 4: Build and run the existing model test**

Run: `dotnet build server/FitMate.sln` then `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter AppDbContextTests`
Expected: build OK, tests PASS.

- [ ] **Step 5: Add migration**

Run: `dotnet ef migrations add AddUnsupportedAiRequests --project server/FitMate.DB --startup-project server/FitMate.Web`
Expected: 2 new tables, unique index on `(Category, NormalizedKey)`, no drops of existing tables. Inspect the generated file.

- [ ] **Step 6: Commit**

```bash
git add server/FitMate.DB docs/superpowers/plans
git commit -m "feat(ai-admin): add UnsupportedAiRequest entities, enum and migration"
```

---

### Task 2: `UnsupportedRequestKeyNormalizer` + `UnsupportedRequestService` (TDD)

**Files:**
- Create: `server/FitMate.Services/Ai/Unsupported/UnsupportedRequestKeyNormalizer.cs`, `IUnsupportedRequestService.cs`, `UnsupportedRequestService.cs`, `UnsupportedRequestMapper.cs`
- Create: `server/FitMate.Core/JsonModels/AdminAi/RecordUnsupportedRequestRequest.cs`
- Test: `server/FitMate.Tests/Unit/Services/UnsupportedRequestServiceTests.cs`

**Interfaces:**
- Consumes: Task 1 entities.
- Produces:

```csharp
using FitMate.Core.JsonModels.AdminAi;

namespace FitMate.Services.Ai.Unsupported;

public interface IUnsupportedRequestService
{
    /// Deduplicates on (Category, NormalizedKey): increments the existing group or creates it,
    /// and always appends an occurrence row so admins can inspect examples (spec §13.3).
    Task<long> RecordAsync(RecordUnsupportedRequestRequest request, long userId);
}
```

```csharp
namespace FitMate.Core.JsonModels.AdminAi;

public class RecordUnsupportedRequestRequest
{
    public string Category { get; set; } = string.Empty;
    public string RequestedFunctionality { get; set; } = string.Empty;
    public string? UserIntentSummary { get; set; }
    public string? SuggestedFallback { get; set; }
    public long ConversationId { get; set; }
    public long? MessageId { get; set; }
}
```

Normalization (spec §7.6): trim → lowercase (invariant) → strip everything that is not a letter, digit or
whitespace → collapse runs of whitespace → drop filler words → re-join with single spaces. Filler list:
`the a an my me i to for of please can you could would want need help with on in do does my`. If the
result is empty, fall back to the lowercased, punctuation-stripped original so a group key always exists.
Category is normalized the same way but **without** filler removal, and truncated to 100 chars.

- [ ] **Step 1: Write failing tests**

```csharp
using FitMate.Core.JsonModels.AdminAi;
using FitMate.DB.Enums;
using FitMate.Services.Ai.Unsupported;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Tests.Unit.Services;

public class UnsupportedRequestServiceTests
{
    private static RecordUnsupportedRequestRequest Request(string functionality, string category = "integration") => new()
    {
        Category = category,
        RequestedFunctionality = functionality,
        UserIntentSummary = "User wants to sync data.",
        SuggestedFallback = "Log workouts manually.",
        ConversationId = 1,
        MessageId = 2,
    };

    [Theory]
    [InlineData("Import my Apple Health workouts.", "import apple health workouts")]
    [InlineData("  IMPORT  my Apple-Health workouts!!! ", "import apple health workouts")]
    [InlineData("Can you please import my apple health workouts?", "import apple health workouts")]
    public void Normalize_ProducesStableKey(string input, string expected)
    {
        Assert.Equal(expected, UnsupportedRequestKeyNormalizer.Normalize(input));
    }

    [Fact]
    public void Normalize_PunctuationOnly_FallsBackToOriginal()
    {
        Assert.False(string.IsNullOrWhiteSpace(UnsupportedRequestKeyNormalizer.Normalize("???")));
    }

    [Fact]
    public async Task Record_FirstReport_CreatesGroupWithOneOccurrence()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var service = new UnsupportedRequestService(context);

        var id = await service.RecordAsync(Request("Import my Apple Health workouts."), SqliteTestDatabase.UserId);

        var group = await context.UnsupportedAiRequests.AsNoTracking().SingleAsync(x => x.Id == id);
        Assert.Equal(1, group.OccurrenceCount);
        Assert.Equal(UnsupportedRequestStatus.New, group.Status);
        Assert.Equal("import apple health workouts", group.NormalizedKey);
        Assert.Equal(group.FirstRequestedAt, group.LastRequestedAt);
        Assert.Equal(1, await context.UnsupportedAiRequestOccurrences.CountAsync(x => x.UnsupportedAiRequestId == id));
    }

    [Fact]
    public async Task Record_SimilarPhrasing_GroupsIntoOneRow()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var service = new UnsupportedRequestService(context);

        var first = await service.RecordAsync(Request("Import my Apple Health workouts."), SqliteTestDatabase.UserId);
        var second = await service.RecordAsync(
            Request("Can you please import my Apple-Health workouts?"),
            SqliteTestDatabase.OtherUserId);

        Assert.Equal(first, second);
        var group = await context.UnsupportedAiRequests.AsNoTracking().SingleAsync();
        Assert.Equal(2, group.OccurrenceCount);
        Assert.True(group.LastRequestedAt >= group.FirstRequestedAt);
        Assert.Equal(2, await context.UnsupportedAiRequestOccurrences.CountAsync());
    }

    [Fact]
    public async Task Record_DifferentCategory_CreatesSeparateGroup()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var service = new UnsupportedRequestService(context);

        await service.RecordAsync(Request("Import my Apple Health workouts.", "integration"), SqliteTestDatabase.UserId);
        await service.RecordAsync(Request("Import my Apple Health workouts.", "nutrition"), SqliteTestDatabase.UserId);

        Assert.Equal(2, await context.UnsupportedAiRequests.CountAsync());
    }

    [Fact]
    public async Task Record_ReopensNothing_KeepsAdminStatus()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var service = new UnsupportedRequestService(context);
        var id = await service.RecordAsync(Request("Import my Apple Health workouts."), SqliteTestDatabase.UserId);

        var group = await context.UnsupportedAiRequests.SingleAsync(x => x.Id == id);
        group.Status = UnsupportedRequestStatus.Planned;
        await context.SaveChangesAsync();

        await service.RecordAsync(Request("Import my Apple Health workouts."), SqliteTestDatabase.OtherUserId);

        var reloaded = await context.UnsupportedAiRequests.AsNoTracking().SingleAsync(x => x.Id == id);
        Assert.Equal(UnsupportedRequestStatus.Planned, reloaded.Status);   // admin triage is never reset
        Assert.Equal(2, reloaded.OccurrenceCount);
    }
}
```

- [ ] **Step 2: Run — expect FAIL**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter UnsupportedRequestServiceTests`

- [ ] **Step 3: Implement**

`UnsupportedRequestKeyNormalizer.cs`:

```csharp
using System.Text;

namespace FitMate.Services.Ai.Unsupported;

public static class UnsupportedRequestKeyNormalizer
{
    private static readonly HashSet<string> FillerWords = new(StringComparer.Ordinal)
    {
        "the", "a", "an", "my", "me", "i", "to", "for", "of", "please", "can", "you",
        "could", "would", "want", "need", "help", "with", "on", "in", "do", "does",
    };

    public static string Normalize(string input) => Normalize(input, removeFillerWords: true);

    public static string NormalizeCategory(string input)
    {
        var normalized = Normalize(input, removeFillerWords: false);
        return normalized.Length > 100 ? normalized[..100] : normalized;
    }

    private static string Normalize(string input, bool removeFillerWords)
    {
        if (string.IsNullOrWhiteSpace(input))
        {
            return string.Empty;
        }

        var builder = new StringBuilder(input.Length);
        foreach (var character in input.Trim().ToLowerInvariant())
        {
            if (char.IsLetterOrDigit(character))
            {
                builder.Append(character);
            }
            else if (char.IsWhiteSpace(character) || character == '-' || character == '_')
            {
                builder.Append(' ');
            }
        }

        var words = builder.ToString().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var kept = removeFillerWords
            ? words.Where(word => !FillerWords.Contains(word)).ToArray()
            : words;

        if (kept.Length == 0)
        {
            kept = words.Length > 0 ? words : [input.Trim().ToLowerInvariant()];
        }

        var result = string.Join(' ', kept);
        return result.Length > 500 ? result[..500] : result;
    }
}
```

`UnsupportedRequestService.cs`:

```csharp
using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.AdminAi;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.Ai.Unsupported;

public class UnsupportedRequestService : IUnsupportedRequestService
{
    private readonly AppDbContext dbContext;

    public UnsupportedRequestService(AppDbContext dbContext)
    {
        this.dbContext = dbContext;
    }

    public async Task<long> RecordAsync(RecordUnsupportedRequestRequest request, long userId)
    {
        if (string.IsNullOrWhiteSpace(request.RequestedFunctionality))
        {
            throw new FitMateException("The requested functionality is required.");
        }

        var category = UnsupportedRequestKeyNormalizer.NormalizeCategory(
            string.IsNullOrWhiteSpace(request.Category) ? "other" : request.Category);
        var normalizedKey = UnsupportedRequestKeyNormalizer.Normalize(request.RequestedFunctionality);
        var now = DateTime.UtcNow;

        var group = await dbContext.UnsupportedAiRequests
            .FirstOrDefaultAsync(x => x.Category == category && x.NormalizedKey == normalizedKey);

        if (group == null)
        {
            group = new UnsupportedAiRequest
            {
                UserId = userId,
                ConversationId = request.ConversationId,
                MessageId = request.MessageId,
                Category = category,
                NormalizedKey = normalizedKey,
                RequestedFunctionality = Truncate(request.RequestedFunctionality, 1000),
                UserIntentSummary = Truncate(request.UserIntentSummary, 2000),
                SuggestedFallback = Truncate(request.SuggestedFallback, 2000),
                Status = UnsupportedRequestStatus.New,
                OccurrenceCount = 0,
                FirstRequestedAt = now,
                LastRequestedAt = now,
            };
            dbContext.UnsupportedAiRequests.Add(group);
        }

        // Status is admin-owned triage state and is never reset by new reports.
        group.OccurrenceCount++;
        group.LastRequestedAt = now;
        group.Occurrences.Add(new UnsupportedAiRequestOccurrence
        {
            UserId = userId,
            ConversationId = request.ConversationId,
            MessageId = request.MessageId,
        });

        await dbContext.SaveChangesAsync();
        return group.Id;
    }

    private static string? Truncate(string? value, int maxLength) =>
        value != null && value.Length > maxLength ? value[..maxLength] : value;
}
```

`UnsupportedRequestMapper.cs` is written in Task 4 together with the admin DTOs it maps to.

- [ ] **Step 4: Run — expect PASS**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter UnsupportedRequestServiceTests`

- [ ] **Step 5: Commit**

```bash
git add server/FitMate.Core server/FitMate.Services server/FitMate.Tests
git commit -m "feat(ai-admin): deduplicated unsupported request recording"
```

---

### Task 3: `report_unsupported_request` tool handler + system prompt rule

**Files:**
- Create: `server/FitMate.Services/Ai/Unsupported/ReportUnsupportedRequestToolHandler.cs`
- Modify: `server/FitMate.Services/AI/Prompts/system-v1.txt` (Plan 05 file — the rule is already there; verify and only add if missing)
- Modify: `server/FitMate.Web/Program.cs` (register the handler in the tool allow-list)
- Test: `server/FitMate.Tests/Unit/Services/ReportUnsupportedRequestToolHandlerTests.cs`

**Interfaces:**
- Consumes: Plan 05's `IAiToolHandler`, `AiToolContext`, `AiToolDefinition`, `AiToolExecutionResult`; Task 2's `IUnsupportedRequestService`.
- Produces: tool `report_unsupported_request` (roadmap allow-list name). Available to every user; never requires confirmation (it writes only backlog metadata, not domain data).

- [ ] **Step 1: Write failing tests**

```csharp
using FitMate.Services.Ai.Unsupported;
using FitMate.Services.AI.Tools;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Tests.Unit.Services;

public class ReportUnsupportedRequestToolHandlerTests
{
    private static AiToolContext Context() => new()
    {
        UserId = SqliteTestDatabase.UserId,
        ConversationId = 7,
        AiRunId = 11,
    };

    [Fact]
    public async Task Execute_ValidArguments_RecordsGroup()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var handler = new ReportUnsupportedRequestToolHandler(new UnsupportedRequestService(context));

        var result = await handler.ExecuteAsync(
            """{"category":"integration","requestedFunctionality":"Import my Apple Health workouts.","userIntentSummary":"Sync from watch","suggestedFallback":"Log manually"}""",
            Context(),
            CancellationToken.None);

        Assert.True(result.Success);
        Assert.False(result.RequiresConfirmation);
        var group = await context.UnsupportedAiRequests.AsNoTracking().SingleAsync();
        Assert.Equal(7, group.ConversationId);
        Assert.Equal(1, group.OccurrenceCount);
    }

    [Fact]
    public async Task Execute_InvalidJson_ReturnsFailureWithoutThrowing()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var handler = new ReportUnsupportedRequestToolHandler(new UnsupportedRequestService(context));

        var result = await handler.ExecuteAsync("not json", Context(), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal("invalid_arguments", result.ErrorCode);
        Assert.Empty(await context.UnsupportedAiRequests.ToListAsync());
    }

    [Fact]
    public async Task Execute_MissingFunctionality_ReturnsFailure()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var handler = new ReportUnsupportedRequestToolHandler(new UnsupportedRequestService(context));

        var result = await handler.ExecuteAsync("""{"category":"integration"}""", Context(), CancellationToken.None);

        Assert.False(result.Success);
        Assert.Empty(await context.UnsupportedAiRequests.ToListAsync());
    }

    [Fact]
    public void Definition_UsesAllowListName()
    {
        using var db = new SqliteTestDatabase();
        using var context = db.CreateContext();
        var handler = new ReportUnsupportedRequestToolHandler(new UnsupportedRequestService(context));

        Assert.Equal("report_unsupported_request", handler.Name);
        Assert.Equal(handler.Name, handler.Definition.Name);
        Assert.True(handler.IsAvailable(Context()));
    }
}
```

- [ ] **Step 2: Run — expect FAIL**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter ReportUnsupportedRequestToolHandlerTests`

- [ ] **Step 3: Implement**

```csharp
using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.AdminAi;
using FitMate.Services.AI.Tools;
using System.Text.Json;

namespace FitMate.Services.Ai.Unsupported;

public class ReportUnsupportedRequestToolHandler : IAiToolHandler
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly IUnsupportedRequestService unsupportedRequestService;

    public ReportUnsupportedRequestToolHandler(IUnsupportedRequestService unsupportedRequestService)
    {
        this.unsupportedRequestService = unsupportedRequestService;
    }

    public string Name => "report_unsupported_request";

    public AiToolDefinition Definition => new()
    {
        Name = Name,
        Description =
            "Record that the user asked for functionality FitMate does not support. "
            + "Call this before explaining the limitation. Do not call it when a registered tool can satisfy the request.",
        ParametersJsonSchema = """
        {
          "type": "object",
          "properties": {
            "category": {
              "type": "string",
              "description": "Short bucket, e.g. integration, nutrition, cardio, social, export."
            },
            "requestedFunctionality": {
              "type": "string",
              "description": "One sentence describing the missing capability."
            },
            "userIntentSummary": { "type": "string" },
            "suggestedFallback": { "type": "string" }
          },
          "required": ["category", "requestedFunctionality"]
        }
        """,
    };

    public bool IsAvailable(AiToolContext context) => true;

    public async Task<AiToolExecutionResult> ExecuteAsync(
        string argumentsJson,
        AiToolContext context,
        CancellationToken cancellationToken)
    {
        RecordUnsupportedRequestRequest? arguments;
        try
        {
            arguments = JsonSerializer.Deserialize<RecordUnsupportedRequestRequest>(argumentsJson, JsonOptions);
        }
        catch (JsonException)
        {
            return new AiToolExecutionResult
            {
                Success = false,
                ErrorCode = "invalid_arguments",
                ErrorMessage = "The tool arguments were not valid JSON.",
            };
        }

        if (arguments == null || string.IsNullOrWhiteSpace(arguments.RequestedFunctionality))
        {
            return new AiToolExecutionResult
            {
                Success = false,
                ErrorCode = "invalid_arguments",
                ErrorMessage = "requestedFunctionality is required.",
            };
        }

        arguments.ConversationId = context.ConversationId;
        arguments.MessageId = null;   // the assistant message does not exist yet during the run

        try
        {
            var id = await unsupportedRequestService.RecordAsync(arguments, context.UserId);
            return new AiToolExecutionResult
            {
                Success = true,
                Data = new { recorded = true, unsupportedRequestId = id },
            };
        }
        catch (FitMateException exception)
        {
            return new AiToolExecutionResult
            {
                Success = false,
                ErrorCode = "invalid_arguments",
                ErrorMessage = exception.Message,
            };
        }
    }
}
```

Register in `Program.cs` next to Plan 05's read-only handlers:

```csharp
builder.Services.AddScoped<IUnsupportedRequestService, UnsupportedRequestService>();
builder.Services.AddScoped<IAiToolHandler, ReportUnsupportedRequestToolHandler>();
```

Verify `system-v1.txt` (Plan 05, Task 11) contains rule 6 verbatim:
`When the user requests functionality that FitMate does not support, call report_unsupported_request before explaining the limitation. Do not report a request as unsupported when an existing registered tool can satisfy it.`
If it is missing, add it and bump `AiPromptBuilder.SystemPromptVersion` to `system-v2` so `AiRun.PromptVersion` stays meaningful.

- [ ] **Step 4: Run — expect PASS**, then the full suite.

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter ReportUnsupportedRequestToolHandlerTests`

- [ ] **Step 5: Commit**

```bash
git add server/FitMate.Services server/FitMate.Web server/FitMate.Tests
git commit -m "feat(ai-admin): report_unsupported_request tool"
```

---

### Task 4: Unsupported-request admin DTOs, mapper and service (TDD)

**Files:**
- Create: `server/FitMate.Core/JsonModels/AdminAi/UnsupportedAiRequestModel.cs`, `UnsupportedRequestOccurrenceModel.cs`, `UnsupportedRequestQueryRequest.cs`, `UpdateUnsupportedRequestRequest.cs`
- Create: `server/FitMate.Services/Ai/Unsupported/UnsupportedRequestMapper.cs`
- Create: `server/FitMate.Services/AdminAi/IAdminUnsupportedRequestService.cs`, `AdminUnsupportedRequestService.cs`
- Test: `server/FitMate.Tests/Unit/Services/AdminUnsupportedRequestServiceTests.cs`

**Interfaces:**
- Consumes: Task 1 entities, `PagedResponse<T>`/`PagedRequest` from `FitMate.Core.JsonModels.Common`.
- Produces:

```csharp
using FitMate.Core.JsonModels.AdminAi;
using FitMate.Core.JsonModels.Common;

namespace FitMate.Services.AdminAi;

public interface IAdminUnsupportedRequestService
{
    Task<PagedResponse<UnsupportedAiRequestModel>> ListAsync(UnsupportedRequestQueryRequest request);
    Task<UnsupportedAiRequestModel?> GetByIdAsync(long id);
    Task<UnsupportedAiRequestModel> UpdateAsync(long id, UpdateUnsupportedRequestRequest request);
}
```

DTOs (namespace `FitMate.Core.JsonModels.AdminAi`; admin services take `(request)` only — the
`AdminErrorService` precedent):

```csharp
using FitMate.Core.JsonModels.Common;
using FitMate.DB.Enums;
using System.ComponentModel.DataAnnotations;

namespace FitMate.Core.JsonModels.AdminAi;

public class UnsupportedAiRequestModel
{
    public long Id { get; set; }
    public string Category { get; set; } = string.Empty;
    public string RequestedFunctionality { get; set; } = string.Empty;
    public string? UserIntentSummary { get; set; }
    public string? SuggestedFallback { get; set; }
    public UnsupportedRequestStatus Status { get; set; }
    public int OccurrenceCount { get; set; }
    public int UniqueUserCount { get; set; }
    public DateTime FirstRequestedAt { get; set; }
    public DateTime LastRequestedAt { get; set; }
    public string? AdminNotes { get; set; }
    public string? ExternalTrackingUrl { get; set; }
    public string? ExternalTrackingKey { get; set; }
    public List<UnsupportedRequestOccurrenceModel> RecentOccurrences { get; set; } = [];
}

public class UnsupportedRequestOccurrenceModel
{
    public long Id { get; set; }
    public long UserId { get; set; }
    public string? UserEmail { get; set; }
    public long ConversationId { get; set; }
    public long? MessageId { get; set; }
    public DateTime DateCreated { get; set; }
}

public class UnsupportedRequestQueryRequest : PagedRequest
{
    [StringLength(200)]
    public string? Search { get; set; }

    [StringLength(100)]
    public string? Category { get; set; }

    public UnsupportedRequestStatus? Status { get; set; }

    /// "last" (default), "count", "first"
    [StringLength(20)]
    public string? SortBy { get; set; }
}

public class UpdateUnsupportedRequestRequest
{
    public UnsupportedRequestStatus Status { get; set; }

    [StringLength(4000)]
    public string? AdminNotes { get; set; }

    [StringLength(1000)]
    public string? ExternalTrackingUrl { get; set; }

    [StringLength(100)]
    public string? ExternalTrackingKey { get; set; }
}
```

List rules: never load `Occurrences` in the list query (projection only, `UniqueUserCount` via a
correlated `Distinct().Count()`); detail loads at most **20** most recent occurrences with user email.
Page size defaults to 20 and is capped at 100 (same as `AdminErrorService`).

- [ ] **Step 1: Write failing tests**

```csharp
using FitMate.Core.JsonModels.AdminAi;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.AdminAi;
using FitMate.Tests.TestInfrastructure;

namespace FitMate.Tests.Unit.Services;

public class AdminUnsupportedRequestServiceTests
{
    private static async Task SeedAsync(SqliteTestDatabase db)
    {
        await using var context = db.CreateContext();
        var apple = new UnsupportedAiRequest
        {
            UserId = SqliteTestDatabase.UserId,
            ConversationId = 1,
            Category = "integration",
            NormalizedKey = "import apple health workouts",
            RequestedFunctionality = "Import my Apple Health workouts.",
            Status = UnsupportedRequestStatus.New,
            OccurrenceCount = 3,
            FirstRequestedAt = new DateTime(2026, 7, 1, 0, 0, 0, DateTimeKind.Utc),
            LastRequestedAt = new DateTime(2026, 7, 20, 0, 0, 0, DateTimeKind.Utc),
            Occurrences =
            [
                new UnsupportedAiRequestOccurrence { UserId = SqliteTestDatabase.UserId, ConversationId = 1 },
                new UnsupportedAiRequestOccurrence { UserId = SqliteTestDatabase.UserId, ConversationId = 2 },
                new UnsupportedAiRequestOccurrence { UserId = SqliteTestDatabase.OtherUserId, ConversationId = 3 },
            ],
        };
        var meals = new UnsupportedAiRequest
        {
            UserId = SqliteTestDatabase.OtherUserId,
            ConversationId = 4,
            Category = "nutrition",
            NormalizedKey = "build meal plan",
            RequestedFunctionality = "Build me a meal plan.",
            Status = UnsupportedRequestStatus.Planned,
            OccurrenceCount = 1,
            FirstRequestedAt = new DateTime(2026, 7, 10, 0, 0, 0, DateTimeKind.Utc),
            LastRequestedAt = new DateTime(2026, 7, 25, 0, 0, 0, DateTimeKind.Utc),
            Occurrences = [new UnsupportedAiRequestOccurrence { UserId = SqliteTestDatabase.OtherUserId, ConversationId = 4 }],
        };
        context.UnsupportedAiRequests.AddRange(apple, meals);
        await context.SaveChangesAsync();
    }

    [Fact]
    public async Task List_DefaultSort_IsMostRecentFirst()
    {
        using var db = new SqliteTestDatabase();
        await SeedAsync(db);
        await using var context = db.CreateContext();
        var service = new AdminUnsupportedRequestService(context);

        var page = await service.ListAsync(new UnsupportedRequestQueryRequest());

        Assert.Equal(2, page.TotalCount);
        Assert.Equal("Build me a meal plan.", page.Items[0].RequestedFunctionality);
    }

    [Fact]
    public async Task List_SortByCount_OrdersByOccurrences()
    {
        using var db = new SqliteTestDatabase();
        await SeedAsync(db);
        await using var context = db.CreateContext();
        var service = new AdminUnsupportedRequestService(context);

        var page = await service.ListAsync(new UnsupportedRequestQueryRequest { SortBy = "count" });

        Assert.Equal(3, page.Items[0].OccurrenceCount);
        Assert.Equal(2, page.Items[0].UniqueUserCount);
    }

    [Fact]
    public async Task List_FiltersByStatusCategoryAndSearch()
    {
        using var db = new SqliteTestDatabase();
        await SeedAsync(db);
        await using var context = db.CreateContext();
        var service = new AdminUnsupportedRequestService(context);

        Assert.Single((await service.ListAsync(new UnsupportedRequestQueryRequest { Status = UnsupportedRequestStatus.Planned })).Items);
        Assert.Single((await service.ListAsync(new UnsupportedRequestQueryRequest { Category = "integration" })).Items);
        Assert.Single((await service.ListAsync(new UnsupportedRequestQueryRequest { Search = "apple" })).Items);
    }

    [Fact]
    public async Task List_DoesNotLoadOccurrences()
    {
        using var db = new SqliteTestDatabase();
        await SeedAsync(db);
        await using var context = db.CreateContext();
        var service = new AdminUnsupportedRequestService(context);

        var page = await service.ListAsync(new UnsupportedRequestQueryRequest());

        Assert.All(page.Items, item => Assert.Empty(item.RecentOccurrences));
    }

    [Fact]
    public async Task GetById_IncludesRecentOccurrencesWithEmails()
    {
        using var db = new SqliteTestDatabase();
        await SeedAsync(db);
        await using var context = db.CreateContext();
        var service = new AdminUnsupportedRequestService(context);
        var id = context.UnsupportedAiRequests.First(x => x.Category == "integration").Id;

        var model = await service.GetByIdAsync(id);

        Assert.NotNull(model);
        Assert.Equal(3, model!.RecentOccurrences.Count);
        Assert.All(model.RecentOccurrences, occurrence => Assert.False(string.IsNullOrWhiteSpace(occurrence.UserEmail)));
    }

    [Fact]
    public async Task Update_SetsStatusNotesAndTracking()
    {
        using var db = new SqliteTestDatabase();
        await SeedAsync(db);
        await using var context = db.CreateContext();
        var service = new AdminUnsupportedRequestService(context);
        var id = context.UnsupportedAiRequests.First().Id;

        var updated = await service.UpdateAsync(id, new UpdateUnsupportedRequestRequest
        {
            Status = UnsupportedRequestStatus.Implemented,
            AdminNotes = "Shipped in 1.4",
            ExternalTrackingUrl = "https://github.com/damianivanov/FitMate/issues/12",
            ExternalTrackingKey = "FM-12",
        });

        Assert.Equal(UnsupportedRequestStatus.Implemented, updated.Status);
        Assert.Equal("FM-12", updated.ExternalTrackingKey);
    }

    [Fact]
    public async Task Update_UnknownId_Throws()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var service = new AdminUnsupportedRequestService(context);

        await Assert.ThrowsAnyAsync<Exception>(() =>
            service.UpdateAsync(999, new UpdateUnsupportedRequestRequest { Status = UnsupportedRequestStatus.Reviewed }));
    }
}
```

- [ ] **Step 2: Run — expect FAIL**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter AdminUnsupportedRequestServiceTests`

- [ ] **Step 3: Implement** (mirror `AdminErrorService`'s paging style exactly)

```csharp
using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.AdminAi;
using FitMate.Core.JsonModels.Common;
using FitMate.DB;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.AdminAi;

public class AdminUnsupportedRequestService : IAdminUnsupportedRequestService
{
    private const int MaxOccurrencesInDetail = 20;

    private readonly AppDbContext dbContext;

    public AdminUnsupportedRequestService(AppDbContext dbContext)
    {
        this.dbContext = dbContext;
    }

    public async Task<PagedResponse<UnsupportedAiRequestModel>> ListAsync(UnsupportedRequestQueryRequest request)
    {
        var page = request.Page <= 0 ? 1 : request.Page;
        var pageSize = request.PageSize <= 0 ? 20 : Math.Min(request.PageSize, 100);
        var search = request.Search?.Trim();
        var category = request.Category?.Trim();

        var query = dbContext.UnsupportedAiRequests.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(x =>
                x.RequestedFunctionality.Contains(search)
                || x.NormalizedKey.Contains(search)
                || (x.UserIntentSummary != null && x.UserIntentSummary.Contains(search)));
        }

        if (!string.IsNullOrWhiteSpace(category))
        {
            query = query.Where(x => x.Category == category);
        }

        if (request.Status.HasValue)
        {
            query = query.Where(x => x.Status == request.Status.Value);
        }

        query = request.SortBy switch
        {
            "count" => query.OrderByDescending(x => x.OccurrenceCount).ThenByDescending(x => x.LastRequestedAt),
            "first" => query.OrderByDescending(x => x.FirstRequestedAt),
            _ => query.OrderByDescending(x => x.LastRequestedAt),
        };

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new UnsupportedAiRequestModel
            {
                Id = x.Id,
                Category = x.Category,
                RequestedFunctionality = x.RequestedFunctionality,
                UserIntentSummary = x.UserIntentSummary,
                SuggestedFallback = x.SuggestedFallback,
                Status = x.Status,
                OccurrenceCount = x.OccurrenceCount,
                UniqueUserCount = x.Occurrences.Select(o => o.UserId).Distinct().Count(),
                FirstRequestedAt = x.FirstRequestedAt,
                LastRequestedAt = x.LastRequestedAt,
                AdminNotes = x.AdminNotes,
                ExternalTrackingUrl = x.ExternalTrackingUrl,
                ExternalTrackingKey = x.ExternalTrackingKey,
            })
            .ToListAsync();

        return new PagedResponse<UnsupportedAiRequestModel>
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
        };
    }

    public async Task<UnsupportedAiRequestModel?> GetByIdAsync(long id)
    {
        var group = await dbContext.UnsupportedAiRequests
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id);

        if (group == null)
        {
            return null;
        }

        var model = UnsupportedRequestMapper.ToModel(group);
        model.UniqueUserCount = await dbContext.UnsupportedAiRequestOccurrences
            .Where(o => o.UnsupportedAiRequestId == id)
            .Select(o => o.UserId)
            .Distinct()
            .CountAsync();

        model.RecentOccurrences = await dbContext.UnsupportedAiRequestOccurrences
            .AsNoTracking()
            .Where(o => o.UnsupportedAiRequestId == id)
            .OrderByDescending(o => o.DateCreated)
            .Take(MaxOccurrencesInDetail)
            .Select(o => new UnsupportedRequestOccurrenceModel
            {
                Id = o.Id,
                UserId = o.UserId,
                UserEmail = dbContext.Users
                    .Where(u => u.Id == o.UserId)
                    .Select(u => u.Email)
                    .FirstOrDefault(),
                ConversationId = o.ConversationId,
                MessageId = o.MessageId,
                DateCreated = o.DateCreated,
            })
            .ToListAsync();

        return model;
    }

    public async Task<UnsupportedAiRequestModel> UpdateAsync(long id, UpdateUnsupportedRequestRequest request)
    {
        var group = await dbContext.UnsupportedAiRequests.FirstOrDefaultAsync(x => x.Id == id)
            ?? throw new FitMateException("Unsupported request not found.");

        group.Status = request.Status;
        group.AdminNotes = request.AdminNotes;
        group.ExternalTrackingUrl = request.ExternalTrackingUrl;
        group.ExternalTrackingKey = request.ExternalTrackingKey;
        await dbContext.SaveChangesAsync();

        return UnsupportedRequestMapper.ToModel(group);
    }
}
```

`UnsupportedRequestMapper.cs`:

```csharp
using FitMate.Core.JsonModels.AdminAi;
using FitMate.DB.Entities;

namespace FitMate.Services.Ai.Unsupported;

public static class UnsupportedRequestMapper
{
    public static UnsupportedAiRequestModel ToModel(UnsupportedAiRequest group) => new()
    {
        Id = group.Id,
        Category = group.Category,
        RequestedFunctionality = group.RequestedFunctionality,
        UserIntentSummary = group.UserIntentSummary,
        SuggestedFallback = group.SuggestedFallback,
        Status = group.Status,
        OccurrenceCount = group.OccurrenceCount,
        FirstRequestedAt = group.FirstRequestedAt,
        LastRequestedAt = group.LastRequestedAt,
        AdminNotes = group.AdminNotes,
        ExternalTrackingUrl = group.ExternalTrackingUrl,
        ExternalTrackingKey = group.ExternalTrackingKey,
    };
}
```

(`AdminUnsupportedRequestService` needs `using FitMate.Services.Ai.Unsupported;` for the mapper.)

- [ ] **Step 4: Run — expect PASS**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter AdminUnsupportedRequestServiceTests`

- [ ] **Step 5: Commit**

```bash
git add server/FitMate.Core server/FitMate.Services server/FitMate.Tests
git commit -m "feat(ai-admin): unsupported request admin service with filters and occurrences"
```

---

### Task 5: Admin AI overview DTOs + `AdminAiService.GetOverviewAsync` (TDD)

**Files:**
- Create: `server/FitMate.Core/JsonModels/AdminAi/AiAdminOverviewModel.cs` (contains `AiToolUsageModel`, `AiUserCostModel`, `AiCostByDayModel`, `AiCostByPlanModel`, `UnsupportedCategoryCountModel`, `AiOverviewQueryRequest` — one class per file)
- Create: `server/FitMate.Services/AdminAi/IAdminAiService.cs`, `AdminAiService.cs`
- Test: `server/FitMate.Tests/Unit/Services/AdminAiServiceTests.cs`

**Interfaces:**
- Consumes: `AiRun`, `AiToolExecution` (Plan 05), `UserSubscription`/`Plan` (Plan 04), `UnsupportedAiRequest` (Task 1).
- Produces (the full interface — Tasks 6 and 7 implement the remaining members):

```csharp
using FitMate.Core.JsonModels.AdminAi;
using FitMate.Core.JsonModels.Common;

namespace FitMate.Services.AdminAi;

public interface IAdminAiService
{
    Task<AiAdminOverviewModel> GetOverviewAsync(AiOverviewQueryRequest request);
    Task<PagedResponse<AiConversationListItemModel>> ListConversationsAsync(AiConversationQueryRequest request);
    Task<AiConversationDetailModel?> GetConversationAsync(long conversationId);
    Task<PagedResponse<AiAdminRunModel>> ListRunsAsync(AiRunQueryRequest request);
    Task<AiAdminRunModel?> GetRunAsync(long runId);
    Task<AiUsageSummaryAdminModel> GetUsageAsync(AiOverviewQueryRequest request);
    Task<AiCostSummaryModel> GetCostsAsync(AiOverviewQueryRequest request);
}
```

DTOs:

```csharp
using FitMate.DB.Enums;
using System.ComponentModel.DataAnnotations;

namespace FitMate.Core.JsonModels.AdminAi;

public class AiOverviewQueryRequest
{
    /// Inclusive UTC start. Defaults to 30 days ago.
    public DateTime? From { get; set; }

    /// Exclusive UTC end. Defaults to now.
    public DateTime? To { get; set; }
}

public class AiAdminOverviewModel
{
    public int TotalRuns { get; set; }
    public int RunsToday { get; set; }
    public int RunsThisMonth { get; set; }
    public int DistinctUsers { get; set; }
    public int SuccessfulRuns { get; set; }
    public int FailedRuns { get; set; }
    public int LimitExceededRuns { get; set; }
    public int AverageDurationMs { get; set; }
    public int P50DurationMs { get; set; }
    public int P95DurationMs { get; set; }
    public long InputTokens { get; set; }
    public long OutputTokens { get; set; }
    public decimal EstimatedCost { get; set; }
    public List<AiToolUsageModel> TopTools { get; set; } = [];
    public List<AiUserCostModel> MostExpensiveUsers { get; set; } = [];
    public List<AiCostByDayModel> CostByDay { get; set; } = [];
    public List<AiCostByPlanModel> CostByPlan { get; set; } = [];
    public List<UnsupportedCategoryCountModel> UnsupportedCategories { get; set; } = [];
}

public class AiToolUsageModel
{
    public string ToolName { get; set; } = string.Empty;
    public int CallCount { get; set; }
    public int FailureCount { get; set; }
    public int AverageDurationMs { get; set; }
}

public class AiUserCostModel
{
    public long UserId { get; set; }
    public string? Email { get; set; }
    public int RunCount { get; set; }
    public decimal EstimatedCost { get; set; }
}

public class AiCostByDayModel
{
    public DateOnly Date { get; set; }
    public int RunCount { get; set; }
    public decimal EstimatedCost { get; set; }
}

public class AiCostByPlanModel
{
    public string PlanCode { get; set; } = string.Empty;
    public int RunCount { get; set; }
    public decimal EstimatedCost { get; set; }
}

public class UnsupportedCategoryCountModel
{
    public string Category { get; set; } = string.Empty;
    public int GroupCount { get; set; }
    public int OccurrenceCount { get; set; }
}

public class AiUsageSummaryAdminModel
{
    public int TotalRuns { get; set; }
    public int DistinctUsers { get; set; }
    public long InputTokens { get; set; }
    public long OutputTokens { get; set; }
    public long CachedInputTokens { get; set; }
    public int ToolCallCount { get; set; }
}

public class AiCostSummaryModel
{
    public decimal TotalEstimatedCost { get; set; }
    public List<AiCostByDayModel> ByDay { get; set; } = [];
    public List<AiCostByPlanModel> ByPlan { get; set; } = [];
    public List<AiUserCostModel> TopUsers { get; set; } = [];
}
```

Computation rules:
- Window: `from = request.From ?? DateTime.UtcNow.AddDays(-30)`, `to = request.To ?? DateTime.UtcNow`; filter `StartedAt >= from && StartedAt < to`. `RunsToday`/`RunsThisMonth` ignore the window (they are absolute counters).
- **Sqlite compatibility:** pull the filtered runs' scalar fields into memory with one projection, then aggregate/percentile in LINQ-to-Objects. `decimal` is never summed in SQL (spec §Global Constraints). Guard against unbounded loads by projecting only the columns needed (`UserId`, `Status`, `DurationMilliseconds`, `InputTokens`, `OutputTokens`, `CachedInputTokens`, `EstimatedCost`, `StartedAt`) and rejecting windows longer than 366 days.
- Percentiles: sort durations ascending; `P50 = value at index (int)(0.50 * (n-1))`, `P95 = value at index (int)(0.95 * (n-1))`; `0` when there are no runs.
- Cost by plan: resolve each user's plan code from an active `UserSubscription` join, falling back to `"free"`.
- `TopTools`: group `AiToolExecution` rows whose `AiRun.StartedAt` is in the window, take the top 10 by call count.
- `MostExpensiveUsers`: top 10 by summed `EstimatedCost`.

- [ ] **Step 1: Write failing tests**

```csharp
using FitMate.Core.JsonModels.AdminAi;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.AdminAi;
using FitMate.Tests.TestInfrastructure;

namespace FitMate.Tests.Unit.Services;

public class AdminAiServiceTests
{
    private static readonly DateTime Now = new(2026, 7, 27, 12, 0, 0, DateTimeKind.Utc);

    private static async Task<long> SeedConversationAsync(SqliteTestDatabase db, long userId, string? title = null)
    {
        await using var context = db.CreateContext();
        var conversation = new AiConversation
        {
            UserId = userId,
            Title = title,
            Status = AiConversationStatus.Active,
            LastMessageAt = Now,
        };
        context.AiConversations.Add(conversation);
        await context.SaveChangesAsync();
        return conversation.Id;
    }

    private static async Task SeedRunAsync(
        SqliteTestDatabase db,
        long userId,
        long conversationId,
        AiRunStatus status,
        int durationMs,
        decimal cost,
        DateTime startedAt,
        params (string ToolName, AiToolExecutionStatus Status, int DurationMs)[] tools)
    {
        await using var context = db.CreateContext();
        var run = new AiRun
        {
            UserId = userId,
            ConversationId = conversationId,
            Status = status,
            Provider = "OpenAI",
            Model = "test-model",
            PromptVersion = "system-v1",
            InputTokens = 100,
            OutputTokens = 50,
            DurationMilliseconds = durationMs,
            EstimatedCost = cost,
            ToolCallCount = tools.Length,
            StartedAt = startedAt,
            CompletedAt = startedAt.AddMilliseconds(durationMs),
        };
        context.AiRuns.Add(run);
        await context.SaveChangesAsync();

        foreach (var (toolName, toolStatus, toolDuration) in tools)
        {
            context.AiToolExecutions.Add(new AiToolExecution
            {
                AiRunId = run.Id,
                ToolCallId = Guid.NewGuid().ToString("N"),
                ToolName = toolName,
                ArgumentsJson = "{}",
                Status = toolStatus,
                DurationMilliseconds = toolDuration,
                StartedAt = startedAt,
                CompletedAt = startedAt.AddMilliseconds(toolDuration),
            });
        }

        await context.SaveChangesAsync();
    }

    [Fact]
    public async Task Overview_AggregatesStatusesTokensAndCost()
    {
        using var db = new SqliteTestDatabase();
        var conversationId = await SeedConversationAsync(db, SqliteTestDatabase.UserId);
        await SeedRunAsync(db, SqliteTestDatabase.UserId, conversationId, AiRunStatus.Completed, 100, 0.10m, Now.AddDays(-1),
            ("search_exercises", AiToolExecutionStatus.Completed, 20));
        await SeedRunAsync(db, SqliteTestDatabase.UserId, conversationId, AiRunStatus.Failed, 300, 0.20m, Now.AddDays(-2));
        await SeedRunAsync(db, SqliteTestDatabase.OtherUserId, conversationId, AiRunStatus.LimitExceeded, 500, 0.30m, Now.AddDays(-3));
        await using var context = db.CreateContext();
        var service = new AdminAiService(context, new FitMate.Services.AI.AiRedactionService());

        var overview = await service.GetOverviewAsync(new AiOverviewQueryRequest { From = Now.AddDays(-10), To = Now });

        Assert.Equal(3, overview.TotalRuns);
        Assert.Equal(2, overview.DistinctUsers);
        Assert.Equal(1, overview.SuccessfulRuns);
        Assert.Equal(1, overview.FailedRuns);
        Assert.Equal(1, overview.LimitExceededRuns);
        Assert.Equal(300, overview.AverageDurationMs);
        Assert.Equal(300, overview.P50DurationMs);
        Assert.Equal(500, overview.P95DurationMs);
        Assert.Equal(300, overview.InputTokens);
        Assert.Equal(0.60m, overview.EstimatedCost);
    }

    [Fact]
    public async Task Overview_ExcludesRunsOutsideWindow()
    {
        using var db = new SqliteTestDatabase();
        var conversationId = await SeedConversationAsync(db, SqliteTestDatabase.UserId);
        await SeedRunAsync(db, SqliteTestDatabase.UserId, conversationId, AiRunStatus.Completed, 100, 0.10m, Now.AddDays(-40));
        await using var context = db.CreateContext();
        var service = new AdminAiService(context, new FitMate.Services.AI.AiRedactionService());

        var overview = await service.GetOverviewAsync(new AiOverviewQueryRequest { From = Now.AddDays(-7), To = Now });

        Assert.Equal(0, overview.TotalRuns);
        Assert.Equal(0, overview.P95DurationMs);
    }

    [Fact]
    public async Task Overview_TopToolsCountsCallsAndFailures()
    {
        using var db = new SqliteTestDatabase();
        var conversationId = await SeedConversationAsync(db, SqliteTestDatabase.UserId);
        await SeedRunAsync(db, SqliteTestDatabase.UserId, conversationId, AiRunStatus.Completed, 100, 0.10m, Now.AddDays(-1),
            ("search_exercises", AiToolExecutionStatus.Completed, 20),
            ("search_exercises", AiToolExecutionStatus.Failed, 40),
            ("get_active_program", AiToolExecutionStatus.Completed, 10));
        await using var context = db.CreateContext();
        var service = new AdminAiService(context, new FitMate.Services.AI.AiRedactionService());

        var overview = await service.GetOverviewAsync(new AiOverviewQueryRequest { From = Now.AddDays(-10), To = Now });

        var search = overview.TopTools.Single(t => t.ToolName == "search_exercises");
        Assert.Equal(2, search.CallCount);
        Assert.Equal(1, search.FailureCount);
        Assert.Equal(30, search.AverageDurationMs);
    }

    [Fact]
    public async Task Overview_CostByPlan_FallsBackToFreeWithoutSubscription()
    {
        using var db = new SqliteTestDatabase();
        var conversationId = await SeedConversationAsync(db, SqliteTestDatabase.UserId);
        await SeedRunAsync(db, SqliteTestDatabase.UserId, conversationId, AiRunStatus.Completed, 100, 0.25m, Now.AddDays(-1));
        await using var context = db.CreateContext();
        var service = new AdminAiService(context, new FitMate.Services.AI.AiRedactionService());

        var overview = await service.GetOverviewAsync(new AiOverviewQueryRequest { From = Now.AddDays(-10), To = Now });

        var plan = Assert.Single(overview.CostByPlan);
        Assert.Equal("free", plan.PlanCode);
        Assert.Equal(0.25m, plan.EstimatedCost);
    }

    [Fact]
    public async Task Overview_UnsupportedCategories_AreAggregated()
    {
        using var db = new SqliteTestDatabase();
        await using (var arrange = db.CreateContext())
        {
            arrange.UnsupportedAiRequests.AddRange(
                new UnsupportedAiRequest
                {
                    Category = "integration", NormalizedKey = "a", RequestedFunctionality = "A",
                    Status = UnsupportedRequestStatus.New, OccurrenceCount = 3,
                    FirstRequestedAt = Now, LastRequestedAt = Now,
                },
                new UnsupportedAiRequest
                {
                    Category = "integration", NormalizedKey = "b", RequestedFunctionality = "B",
                    Status = UnsupportedRequestStatus.New, OccurrenceCount = 2,
                    FirstRequestedAt = Now, LastRequestedAt = Now,
                });
            await arrange.SaveChangesAsync();
        }
        await using var context = db.CreateContext();
        var service = new AdminAiService(context, new FitMate.Services.AI.AiRedactionService());

        var overview = await service.GetOverviewAsync(new AiOverviewQueryRequest());

        var category = Assert.Single(overview.UnsupportedCategories);
        Assert.Equal("integration", category.Category);
        Assert.Equal(2, category.GroupCount);
        Assert.Equal(5, category.OccurrenceCount);
    }
}
```

- [ ] **Step 2: Run — expect FAIL**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter AdminAiServiceTests`

- [ ] **Step 3: Implement `GetOverviewAsync`** (leave the other five interface members throwing
`NotImplementedException` — Tasks 6 and 7 fill them in)

```csharp
using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.AdminAi;
using FitMate.Core.JsonModels.Common;
using FitMate.DB;
using FitMate.DB.Enums;
using FitMate.Services.AI;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.AdminAi;

public class AdminAiService : IAdminAiService
{
    private const int MaxWindowDays = 366;
    private const int TopCount = 10;

    private readonly AppDbContext dbContext;
    private readonly IAiRedactionService redactionService;

    public AdminAiService(AppDbContext dbContext, IAiRedactionService redactionService)
    {
        this.dbContext = dbContext;
        this.redactionService = redactionService;
    }

    private sealed record RunFacts(
        long UserId,
        AiRunStatus Status,
        int DurationMilliseconds,
        int InputTokens,
        int OutputTokens,
        int CachedInputTokens,
        decimal? EstimatedCost,
        DateTime StartedAt,
        int ToolCallCount);

    public async Task<AiAdminOverviewModel> GetOverviewAsync(AiOverviewQueryRequest request)
    {
        var (from, to) = ResolveWindow(request);
        var runs = await LoadRunFactsAsync(from, to);

        var now = DateTime.UtcNow;
        var startOfToday = new DateTime(now.Year, now.Month, now.Day, 0, 0, 0, DateTimeKind.Utc);
        var startOfMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        var durations = runs.Select(r => r.DurationMilliseconds).OrderBy(value => value).ToList();

        var planCodeByUser = await ResolvePlanCodesAsync(runs.Select(r => r.UserId).Distinct().ToList());
        var emailByUser = await dbContext.Users
            .AsNoTracking()
            .Where(u => runs.Select(r => r.UserId).Contains(u.Id))
            .Select(u => new { u.Id, u.Email })
            .ToDictionaryAsync(u => u.Id, u => u.Email);

        var toolStats = await dbContext.AiToolExecutions
            .AsNoTracking()
            .Where(t => t.AiRun.StartedAt >= from && t.AiRun.StartedAt < to)
            .Select(t => new { t.ToolName, t.Status, t.DurationMilliseconds })
            .ToListAsync();

        var unsupported = await dbContext.UnsupportedAiRequests
            .AsNoTracking()
            .Select(x => new { x.Category, x.OccurrenceCount })
            .ToListAsync();

        return new AiAdminOverviewModel
        {
            TotalRuns = runs.Count,
            RunsToday = await dbContext.AiRuns.CountAsync(r => r.StartedAt >= startOfToday),
            RunsThisMonth = await dbContext.AiRuns.CountAsync(r => r.StartedAt >= startOfMonth),
            DistinctUsers = runs.Select(r => r.UserId).Distinct().Count(),
            SuccessfulRuns = runs.Count(r => r.Status == AiRunStatus.Completed),
            FailedRuns = runs.Count(r => r.Status == AiRunStatus.Failed),
            LimitExceededRuns = runs.Count(r => r.Status == AiRunStatus.LimitExceeded),
            AverageDurationMs = durations.Count == 0 ? 0 : (int)durations.Average(),
            P50DurationMs = Percentile(durations, 0.50),
            P95DurationMs = Percentile(durations, 0.95),
            InputTokens = runs.Sum(r => (long)r.InputTokens),
            OutputTokens = runs.Sum(r => (long)r.OutputTokens),
            EstimatedCost = runs.Sum(r => r.EstimatedCost ?? 0m),
            TopTools = toolStats
                .GroupBy(t => t.ToolName)
                .Select(group => new AiToolUsageModel
                {
                    ToolName = group.Key,
                    CallCount = group.Count(),
                    FailureCount = group.Count(t =>
                        t.Status is AiToolExecutionStatus.Failed or AiToolExecutionStatus.Rejected),
                    AverageDurationMs = (int)group.Average(t => t.DurationMilliseconds),
                })
                .OrderByDescending(t => t.CallCount)
                .Take(TopCount)
                .ToList(),
            MostExpensiveUsers = runs
                .GroupBy(r => r.UserId)
                .Select(group => new AiUserCostModel
                {
                    UserId = group.Key,
                    Email = emailByUser.GetValueOrDefault(group.Key),
                    RunCount = group.Count(),
                    EstimatedCost = group.Sum(r => r.EstimatedCost ?? 0m),
                })
                .OrderByDescending(u => u.EstimatedCost)
                .Take(TopCount)
                .ToList(),
            CostByDay = BuildCostByDay(runs),
            CostByPlan = runs
                .GroupBy(r => planCodeByUser.GetValueOrDefault(r.UserId, "free"))
                .Select(group => new AiCostByPlanModel
                {
                    PlanCode = group.Key,
                    RunCount = group.Count(),
                    EstimatedCost = group.Sum(r => r.EstimatedCost ?? 0m),
                })
                .OrderByDescending(p => p.EstimatedCost)
                .ToList(),
            UnsupportedCategories = unsupported
                .GroupBy(x => x.Category)
                .Select(group => new UnsupportedCategoryCountModel
                {
                    Category = group.Key,
                    GroupCount = group.Count(),
                    OccurrenceCount = group.Sum(x => x.OccurrenceCount),
                })
                .OrderByDescending(c => c.OccurrenceCount)
                .ToList(),
        };
    }

    private static (DateTime From, DateTime To) ResolveWindow(AiOverviewQueryRequest request)
    {
        var to = request.To ?? DateTime.UtcNow;
        var from = request.From ?? to.AddDays(-30);
        if (from >= to)
        {
            throw new FitMateException("The start of the range must be before its end.");
        }
        if ((to - from).TotalDays > MaxWindowDays)
        {
            throw new FitMateException($"The range cannot be longer than {MaxWindowDays} days.");
        }

        return (from, to);
    }

    private async Task<List<RunFacts>> LoadRunFactsAsync(DateTime from, DateTime to) =>
        await dbContext.AiRuns
            .AsNoTracking()
            .Where(r => r.StartedAt >= from && r.StartedAt < to)
            .Select(r => new RunFacts(
                r.UserId,
                r.Status,
                r.DurationMilliseconds,
                r.InputTokens,
                r.OutputTokens,
                r.CachedInputTokens,
                r.EstimatedCost,
                r.StartedAt,
                r.ToolCallCount))
            .ToListAsync();

    private async Task<Dictionary<long, string>> ResolvePlanCodesAsync(List<long> userIds) =>
        await dbContext.UserSubscriptions
            .AsNoTracking()
            .Where(s => userIds.Contains(s.UserId)
                && (s.Status == SubscriptionStatus.Active || s.Status == SubscriptionStatus.Trialing))
            .Select(s => new { s.UserId, s.Plan.Code })
            .ToDictionaryAsync(s => s.UserId, s => s.Code);

    private static List<AiCostByDayModel> BuildCostByDay(List<RunFacts> runs) =>
        runs
            .GroupBy(r => DateOnly.FromDateTime(r.StartedAt))
            .Select(group => new AiCostByDayModel
            {
                Date = group.Key,
                RunCount = group.Count(),
                EstimatedCost = group.Sum(r => r.EstimatedCost ?? 0m),
            })
            .OrderBy(d => d.Date)
            .ToList();

    private static int Percentile(List<int> sortedValues, double percentile)
    {
        if (sortedValues.Count == 0)
        {
            return 0;
        }

        var index = (int)(percentile * (sortedValues.Count - 1));
        return sortedValues[index];
    }

    // Tasks 6–7 implement these.
    public Task<PagedResponse<AiConversationListItemModel>> ListConversationsAsync(AiConversationQueryRequest request) => throw new NotImplementedException();
    public Task<AiConversationDetailModel?> GetConversationAsync(long conversationId) => throw new NotImplementedException();
    public Task<PagedResponse<AiAdminRunModel>> ListRunsAsync(AiRunQueryRequest request) => throw new NotImplementedException();
    public Task<AiAdminRunModel?> GetRunAsync(long runId) => throw new NotImplementedException();
    public Task<AiUsageSummaryAdminModel> GetUsageAsync(AiOverviewQueryRequest request) => throw new NotImplementedException();
    public Task<AiCostSummaryModel> GetCostsAsync(AiOverviewQueryRequest request) => throw new NotImplementedException();
}
```

> `dbContext.UserSubscriptions`/`Plan.Code` come from Plan 04 — verify the navigation name
> (`s.Plan.Code`) against the delivered `UserSubscription` entity.

- [ ] **Step 4: Run — expect PASS**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter AdminAiServiceTests`

- [ ] **Step 5: Commit**

```bash
git add server/FitMate.Core server/FitMate.Services server/FitMate.Tests
git commit -m "feat(ai-admin): AI overview aggregation with in-memory percentiles"
```

---

### Task 6: Admin conversation list + detail (redaction, privacy preference) (TDD)

**Files:**
- Create: `server/FitMate.Core/JsonModels/AdminAi/AiConversationListItemModel.cs`, `AiConversationQueryRequest.cs`, `AiConversationDetailModel.cs` (+ `AiAdminMessageModel`, `AiAdminToolExecutionModel`, `AiAdminActionModel`)
- Modify: `server/FitMate.Services/AdminAi/AdminAiService.cs`
- Test: append to `server/FitMate.Tests/Unit/Services/AdminAiServiceTests.cs`

**Interfaces:**
- Produces `ListConversationsAsync` and `GetConversationAsync`.

```csharp
using FitMate.Core.JsonModels.Common;
using FitMate.DB.Enums;
using System.ComponentModel.DataAnnotations;

namespace FitMate.Core.JsonModels.AdminAi;

public class AiConversationListItemModel
{
    public long Id { get; set; }
    public long UserId { get; set; }
    public string? UserEmail { get; set; }
    public string? Title { get; set; }
    public AiConversationStatus Status { get; set; }
    public DateTime LastMessageAt { get; set; }
    public int MessageCount { get; set; }
    public int RunCount { get; set; }
    public decimal EstimatedCost { get; set; }
    public bool HasError { get; set; }
    public bool HasConfirmedMutation { get; set; }
}

public class AiConversationQueryRequest : PagedRequest
{
    public long? UserId { get; set; }

    [StringLength(256)]
    public string? Email { get; set; }

    public DateTime? From { get; set; }
    public DateTime? To { get; set; }

    [StringLength(50)]
    public string? PlanCode { get; set; }

    [StringLength(100)]
    public string? Model { get; set; }

    public AiRunStatus? Status { get; set; }

    [StringLength(100)]
    public string? ToolName { get; set; }

    public bool? HasError { get; set; }
    public bool? HasUnsupportedRequest { get; set; }
    public bool? HasConfirmedMutation { get; set; }
    public decimal? MinimumCost { get; set; }
    public int? MinimumTokens { get; set; }
}

public class AiConversationDetailModel
{
    public long Id { get; set; }
    public long UserId { get; set; }
    public string? UserEmail { get; set; }
    public string? Title { get; set; }
    public AiConversationStatus Status { get; set; }
    public bool ContentHiddenByUserPreference { get; set; }
    public List<AiAdminMessageModel> Messages { get; set; } = [];
    public List<AiAdminRunModel> Runs { get; set; } = [];
    public List<AiAdminToolExecutionModel> ToolExecutions { get; set; } = [];
    public List<AiAdminActionModel> Actions { get; set; } = [];
}

public class AiAdminMessageModel
{
    public long Id { get; set; }
    public AiMessageRole Role { get; set; }
    public string Content { get; set; } = string.Empty;
    public string? ToolName { get; set; }
    public string? ToolCallId { get; set; }
    public DateTime DateCreated { get; set; }
}

public class AiAdminToolExecutionModel
{
    public long Id { get; set; }
    public long AiRunId { get; set; }
    public string ToolCallId { get; set; } = string.Empty;
    public string ToolName { get; set; } = string.Empty;
    public string ArgumentsJson { get; set; } = "{}";
    public string? ResultJson { get; set; }
    public AiToolExecutionStatus Status { get; set; }
    public int DurationMilliseconds { get; set; }
    public string? ErrorCode { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime StartedAt { get; set; }
}

public class AiAdminActionModel
{
    public long Id { get; set; }
    public AiActionType ActionType { get; set; }
    public AiActionStatus Status { get; set; }
    public DateTime DateCreated { get; set; }
    public DateTime? ConfirmedAt { get; set; }
    public DateTime? ExecutedAt { get; set; }
    public string? FailureReason { get; set; }
}
```

Rules:
- The list query **never** selects `AiMessage.Content` (spec §55). `MessageCount`, `RunCount`, `EstimatedCost`, `HasError`, `HasConfirmedMutation` are computed with correlated sub-selects; decimals are summed in memory after a projection to avoid Sqlite issues.
- Filters compose: `UserId`, `Email` (contains), `From`/`To` on `LastMessageAt`, `PlanCode` (via active subscription), `Model`/`Status`/`MinimumTokens` (any run in the conversation matches), `ToolName` (any tool execution matches), `HasError`, `HasUnsupportedRequest` (an `UnsupportedAiRequestOccurrence` references the conversation), `HasConfirmedMutation` (an `AiAction` with `Status == Executed`), `MinimumCost`.
- Detail passes **every** message body and every stored `ArgumentsJson`/`ResultJson` through
  `IAiRedactionService` again on read (defence in depth — Plan 05 already redacts on write).
- When the conversation owner has `UserAiPreferences.AllowAdminContentReview == false`, message content
  and tool payloads are replaced with `[content hidden by user preference]` and
  `ContentHiddenByUserPreference = true`; metadata (roles, counts, durations, costs) is still returned.

- [ ] **Step 1: Write failing tests** (append to `AdminAiServiceTests`)

```csharp
    private static async Task SeedMessagesAsync(SqliteTestDatabase db, long conversationId, long userId, params (AiMessageRole Role, string Content)[] messages)
    {
        await using var context = db.CreateContext();
        foreach (var (role, content) in messages)
        {
            context.AiMessages.Add(new AiMessage
            {
                ConversationId = conversationId,
                UserId = userId,
                Role = role,
                Content = content,
            });
        }
        await context.SaveChangesAsync();
    }

    [Fact]
    public async Task ListConversations_DoesNotReturnMessageBodies()
    {
        using var db = new SqliteTestDatabase();
        var conversationId = await SeedConversationAsync(db, SqliteTestDatabase.UserId, "Program help");
        await SeedMessagesAsync(db, conversationId, SqliteTestDatabase.UserId,
            (AiMessageRole.User, "secret question"),
            (AiMessageRole.Assistant, "secret answer"));
        await SeedRunAsync(db, SqliteTestDatabase.UserId, conversationId, AiRunStatus.Completed, 100, 0.5m, Now.AddDays(-1));
        await using var context = db.CreateContext();
        var service = new AdminAiService(context, new FitMate.Services.AI.AiRedactionService());

        var page = await service.ListConversationsAsync(new AiConversationQueryRequest());

        var item = Assert.Single(page.Items);
        Assert.Equal(2, item.MessageCount);
        Assert.Equal(1, item.RunCount);
        Assert.Equal(0.5m, item.EstimatedCost);
        Assert.False(string.IsNullOrWhiteSpace(item.UserEmail));
    }

    [Fact]
    public async Task ListConversations_FiltersByEmailAndMinimumCost()
    {
        using var db = new SqliteTestDatabase();
        var mine = await SeedConversationAsync(db, SqliteTestDatabase.UserId);
        var theirs = await SeedConversationAsync(db, SqliteTestDatabase.OtherUserId);
        await SeedRunAsync(db, SqliteTestDatabase.UserId, mine, AiRunStatus.Completed, 100, 0.10m, Now.AddDays(-1));
        await SeedRunAsync(db, SqliteTestDatabase.OtherUserId, theirs, AiRunStatus.Completed, 100, 5.00m, Now.AddDays(-1));
        await using var context = db.CreateContext();
        var service = new AdminAiService(context, new FitMate.Services.AI.AiRedactionService());

        var byEmail = await service.ListConversationsAsync(new AiConversationQueryRequest { Email = "other@" });
        var byCost = await service.ListConversationsAsync(new AiConversationQueryRequest { MinimumCost = 1m });

        Assert.Single(byEmail.Items);
        Assert.Single(byCost.Items);
        Assert.Equal(theirs, byCost.Items[0].Id);
    }

    [Fact]
    public async Task GetConversation_RedactsSecretsInMessagesAndToolPayloads()
    {
        using var db = new SqliteTestDatabase();
        var conversationId = await SeedConversationAsync(db, SqliteTestDatabase.UserId);
        await SeedMessagesAsync(db, conversationId, SqliteTestDatabase.UserId,
            (AiMessageRole.User, "my token is eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def"));
        await using var context = db.CreateContext();
        var service = new AdminAiService(context, new FitMate.Services.AI.AiRedactionService());

        var detail = await service.GetConversationAsync(conversationId);

        Assert.NotNull(detail);
        Assert.DoesNotContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9", detail!.Messages[0].Content);
    }

    [Fact]
    public async Task GetConversation_HonorsAllowAdminContentReviewFalse()
    {
        using var db = new SqliteTestDatabase();
        var conversationId = await SeedConversationAsync(db, SqliteTestDatabase.UserId);
        await SeedMessagesAsync(db, conversationId, SqliteTestDatabase.UserId,
            (AiMessageRole.User, "please do not show this to admins"));
        await using (var arrange = db.CreateContext())
        {
            arrange.UserAiPreferences.Add(new UserAiPreferences
            {
                UserId = SqliteTestDatabase.UserId,
                AllowAdminContentReview = false,
                UpdatedAt = Now,
            });
            await arrange.SaveChangesAsync();
        }
        await using var context = db.CreateContext();
        var service = new AdminAiService(context, new FitMate.Services.AI.AiRedactionService());

        var detail = await service.GetConversationAsync(conversationId);

        Assert.True(detail!.ContentHiddenByUserPreference);
        Assert.Equal("[content hidden by user preference]", detail.Messages[0].Content);
        Assert.Single(detail.Messages);   // metadata still present
    }

    [Fact]
    public async Task GetConversation_UnknownId_ReturnsNull()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var service = new AdminAiService(context, new FitMate.Services.AI.AiRedactionService());

        Assert.Null(await service.GetConversationAsync(4242));
    }
```

- [ ] **Step 2: Run — expect FAIL**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter AdminAiServiceTests`

- [ ] **Step 3: Implement** (replace the two `NotImplementedException` members)

```csharp
    private const string HiddenContent = "[content hidden by user preference]";

    public async Task<PagedResponse<AiConversationListItemModel>> ListConversationsAsync(AiConversationQueryRequest request)
    {
        var page = request.Page <= 0 ? 1 : request.Page;
        var pageSize = request.PageSize <= 0 ? 20 : Math.Min(request.PageSize, 100);

        var query = dbContext.AiConversations.AsNoTracking().AsQueryable();

        if (request.UserId.HasValue)
        {
            query = query.Where(c => c.UserId == request.UserId.Value);
        }

        var email = request.Email?.Trim();
        if (!string.IsNullOrWhiteSpace(email))
        {
            query = query.Where(c => dbContext.Users
                .Any(u => u.Id == c.UserId && u.Email != null && u.Email.Contains(email)));
        }

        if (request.From.HasValue)
        {
            query = query.Where(c => c.LastMessageAt >= request.From.Value);
        }

        if (request.To.HasValue)
        {
            query = query.Where(c => c.LastMessageAt < request.To.Value);
        }

        var planCode = request.PlanCode?.Trim();
        if (!string.IsNullOrWhiteSpace(planCode))
        {
            query = query.Where(c => dbContext.UserSubscriptions.Any(s =>
                s.UserId == c.UserId
                && (s.Status == SubscriptionStatus.Active || s.Status == SubscriptionStatus.Trialing)
                && s.Plan.Code == planCode));
        }

        var model = request.Model?.Trim();
        if (!string.IsNullOrWhiteSpace(model))
        {
            query = query.Where(c => dbContext.AiRuns.Any(r => r.ConversationId == c.Id && r.Model == model));
        }

        if (request.Status.HasValue)
        {
            query = query.Where(c => dbContext.AiRuns.Any(r => r.ConversationId == c.Id && r.Status == request.Status.Value));
        }

        if (request.MinimumTokens.HasValue)
        {
            query = query.Where(c => dbContext.AiRuns
                .Where(r => r.ConversationId == c.Id)
                .Sum(r => r.InputTokens + r.OutputTokens) >= request.MinimumTokens.Value);
        }

        var toolName = request.ToolName?.Trim();
        if (!string.IsNullOrWhiteSpace(toolName))
        {
            query = query.Where(c => dbContext.AiToolExecutions
                .Any(t => t.AiRun.ConversationId == c.Id && t.ToolName == toolName));
        }

        if (request.HasError == true)
        {
            query = query.Where(c => dbContext.AiRuns.Any(r => r.ConversationId == c.Id && r.Status == AiRunStatus.Failed));
        }

        if (request.HasUnsupportedRequest == true)
        {
            query = query.Where(c => dbContext.UnsupportedAiRequestOccurrences.Any(o => o.ConversationId == c.Id));
        }

        if (request.HasConfirmedMutation == true)
        {
            query = query.Where(c => dbContext.AiActions
                .Any(a => a.ConversationId == c.Id && a.Status == AiActionStatus.Executed));
        }

        var totalCount = await query.CountAsync();

        // Project scalars first (no message bodies), then aggregate decimals in memory.
        var rows = await query
            .OrderByDescending(c => c.LastMessageAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new
            {
                c.Id,
                c.UserId,
                c.Title,
                c.Status,
                c.LastMessageAt,
                MessageCount = dbContext.AiMessages.Count(m => m.ConversationId == c.Id),
                RunCount = dbContext.AiRuns.Count(r => r.ConversationId == c.Id),
                HasError = dbContext.AiRuns.Any(r => r.ConversationId == c.Id && r.Status == AiRunStatus.Failed),
                HasConfirmedMutation = dbContext.AiActions
                    .Any(a => a.ConversationId == c.Id && a.Status == AiActionStatus.Executed),
                Costs = dbContext.AiRuns
                    .Where(r => r.ConversationId == c.Id && r.EstimatedCost != null)
                    .Select(r => r.EstimatedCost!.Value)
                    .ToList(),
                UserEmail = dbContext.Users.Where(u => u.Id == c.UserId).Select(u => u.Email).FirstOrDefault(),
            })
            .ToListAsync();

        var items = rows
            .Select(row => new AiConversationListItemModel
            {
                Id = row.Id,
                UserId = row.UserId,
                UserEmail = row.UserEmail,
                Title = row.Title,
                Status = row.Status,
                LastMessageAt = row.LastMessageAt,
                MessageCount = row.MessageCount,
                RunCount = row.RunCount,
                EstimatedCost = row.Costs.Sum(),
                HasError = row.HasError,
                HasConfirmedMutation = row.HasConfirmedMutation,
            })
            .ToList();

        if (request.MinimumCost.HasValue)
        {
            items = items.Where(i => i.EstimatedCost >= request.MinimumCost.Value).ToList();
            totalCount = items.Count;   // cost filtering happens after aggregation; note it in the UI
        }

        return new PagedResponse<AiConversationListItemModel>
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
        };
    }

    public async Task<AiConversationDetailModel?> GetConversationAsync(long conversationId)
    {
        var conversation = await dbContext.AiConversations
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == conversationId);

        if (conversation == null)
        {
            return null;
        }

        var allowContentReview = await dbContext.UserAiPreferences
            .AsNoTracking()
            .Where(p => p.UserId == conversation.UserId)
            .Select(p => (bool?)p.AllowAdminContentReview)
            .FirstOrDefaultAsync() ?? true;

        var messages = await dbContext.AiMessages
            .AsNoTracking()
            .Where(m => m.ConversationId == conversationId)
            .OrderBy(m => m.DateCreated).ThenBy(m => m.Id)
            .Select(m => new AiAdminMessageModel
            {
                Id = m.Id,
                Role = m.Role,
                Content = m.Content,
                ToolName = m.ToolName,
                ToolCallId = m.ToolCallId,
                DateCreated = m.DateCreated,
            })
            .ToListAsync();

        var runs = await dbContext.AiRuns
            .AsNoTracking()
            .Where(r => r.ConversationId == conversationId)
            .OrderBy(r => r.StartedAt)
            .Select(r => new AiAdminRunModel
            {
                Id = r.Id,
                UserId = r.UserId,
                ConversationId = r.ConversationId,
                Status = r.Status,
                Provider = r.Provider,
                Model = r.Model,
                PromptVersion = r.PromptVersion,
                InputTokens = r.InputTokens,
                OutputTokens = r.OutputTokens,
                CachedInputTokens = r.CachedInputTokens,
                EstimatedCost = r.EstimatedCost,
                ToolCallCount = r.ToolCallCount,
                DurationMilliseconds = r.DurationMilliseconds,
                ErrorCode = r.ErrorCode,
                ErrorMessage = r.ErrorMessage,
                StartedAt = r.StartedAt,
                CompletedAt = r.CompletedAt,
            })
            .ToListAsync();

        var toolExecutions = await dbContext.AiToolExecutions
            .AsNoTracking()
            .Where(t => t.AiRun.ConversationId == conversationId)
            .OrderBy(t => t.StartedAt)
            .Select(t => new AiAdminToolExecutionModel
            {
                Id = t.Id,
                AiRunId = t.AiRunId,
                ToolCallId = t.ToolCallId,
                ToolName = t.ToolName,
                ArgumentsJson = t.ArgumentsJson,
                ResultJson = t.ResultJson,
                Status = t.Status,
                DurationMilliseconds = t.DurationMilliseconds,
                ErrorCode = t.ErrorCode,
                ErrorMessage = t.ErrorMessage,
                StartedAt = t.StartedAt,
            })
            .ToListAsync();

        var actions = await dbContext.AiActions
            .AsNoTracking()
            .Where(a => a.ConversationId == conversationId)
            .OrderBy(a => a.DateCreated)
            .Select(a => new AiAdminActionModel
            {
                Id = a.Id,
                ActionType = a.ActionType,
                Status = a.Status,
                DateCreated = a.DateCreated,
                ConfirmedAt = a.ConfirmedAt,
                ExecutedAt = a.ExecutedAt,
                FailureReason = a.FailureReason,
            })
            .ToListAsync();

        foreach (var message in messages)
        {
            message.Content = allowContentReview
                ? redactionService.RedactText(message.Content)
                : HiddenContent;
        }

        foreach (var execution in toolExecutions)
        {
            execution.ArgumentsJson = allowContentReview
                ? redactionService.RedactJson(execution.ArgumentsJson)
                : HiddenContent;
            execution.ResultJson = execution.ResultJson == null
                ? null
                : allowContentReview ? redactionService.RedactJson(execution.ResultJson) : HiddenContent;
        }

        return new AiConversationDetailModel
        {
            Id = conversation.Id,
            UserId = conversation.UserId,
            UserEmail = await dbContext.Users
                .Where(u => u.Id == conversation.UserId)
                .Select(u => u.Email)
                .FirstOrDefaultAsync(),
            Title = conversation.Title,
            Status = conversation.Status,
            ContentHiddenByUserPreference = !allowContentReview,
            Messages = messages,
            Runs = runs,
            ToolExecutions = toolExecutions,
            Actions = actions,
        };
    }
```

> `dbContext.AiActions` comes from Plan 06 — if this plan is executed before Plan 06 merges, drop the
> `HasConfirmedMutation` filter, the `Actions` list and the `AiAdminActionModel` mapping, and add them
> back in a follow-up commit. Note that choice in the commit message.

- [ ] **Step 4: Run — expect PASS**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter AdminAiServiceTests`

- [ ] **Step 5: Commit**

```bash
git add server/FitMate.Core server/FitMate.Services server/FitMate.Tests
git commit -m "feat(ai-admin): conversation list and redacted detail viewer"
```

---

### Task 7: Admin runs, usage and costs (TDD)

**Files:**
- Create: `server/FitMate.Core/JsonModels/AdminAi/AiAdminRunModel.cs`, `AiRunQueryRequest.cs`, `AiUsageSummaryAdminModel.cs`, `AiCostSummaryModel.cs` (the latter two were declared in Task 5 — create them there and only add `AiAdminRunModel`/`AiRunQueryRequest` here)
- Modify: `server/FitMate.Services/AdminAi/AdminAiService.cs`
- Test: append to `server/FitMate.Tests/Unit/Services/AdminAiServiceTests.cs`

**Interfaces:**
- Produces `ListRunsAsync`, `GetRunAsync`, `GetUsageAsync`, `GetCostsAsync`.

```csharp
using FitMate.Core.JsonModels.Common;
using FitMate.DB.Enums;
using System.ComponentModel.DataAnnotations;

namespace FitMate.Core.JsonModels.AdminAi;

public class AiAdminRunModel
{
    public long Id { get; set; }
    public long UserId { get; set; }
    public string? UserEmail { get; set; }
    public long ConversationId { get; set; }
    public AiRunStatus Status { get; set; }
    public string Provider { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public string PromptVersion { get; set; } = string.Empty;
    public int InputTokens { get; set; }
    public int OutputTokens { get; set; }
    public int CachedInputTokens { get; set; }
    public decimal? EstimatedCost { get; set; }
    public int ToolCallCount { get; set; }
    public int DurationMilliseconds { get; set; }
    public string? ErrorCode { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public List<AiAdminToolExecutionModel> ToolExecutions { get; set; } = [];
}

public class AiRunQueryRequest : PagedRequest
{
    public long? UserId { get; set; }
    public long? ConversationId { get; set; }
    public AiRunStatus? Status { get; set; }

    [StringLength(100)]
    public string? Model { get; set; }

    [StringLength(100)]
    public string? ErrorCode { get; set; }

    public DateTime? From { get; set; }
    public DateTime? To { get; set; }
}
```

Rules: the run **list** never loads tool executions; `GetRunAsync` loads them (redacted) for the trace
view. `GetUsageAsync`/`GetCostsAsync` reuse `LoadRunFactsAsync` + `BuildCostByDay` from Task 5.

- [ ] **Step 1: Write failing tests** (append)

```csharp
    [Fact]
    public async Task ListRuns_FiltersByStatusAndModel()
    {
        using var db = new SqliteTestDatabase();
        var conversationId = await SeedConversationAsync(db, SqliteTestDatabase.UserId);
        await SeedRunAsync(db, SqliteTestDatabase.UserId, conversationId, AiRunStatus.Completed, 100, 0.1m, Now.AddDays(-1));
        await SeedRunAsync(db, SqliteTestDatabase.UserId, conversationId, AiRunStatus.Failed, 200, 0.2m, Now.AddDays(-1));
        await using var context = db.CreateContext();
        var service = new AdminAiService(context, new FitMate.Services.AI.AiRedactionService());

        var failed = await service.ListRunsAsync(new AiRunQueryRequest { Status = AiRunStatus.Failed });
        var byModel = await service.ListRunsAsync(new AiRunQueryRequest { Model = "test-model" });
        var byMissingModel = await service.ListRunsAsync(new AiRunQueryRequest { Model = "other-model" });

        Assert.Single(failed.Items);
        Assert.Equal(2, byModel.TotalCount);
        Assert.Empty(byMissingModel.Items);
        Assert.All(byModel.Items, run => Assert.Empty(run.ToolExecutions));   // list stays light
    }

    [Fact]
    public async Task GetRun_IncludesRedactedToolTrace()
    {
        using var db = new SqliteTestDatabase();
        var conversationId = await SeedConversationAsync(db, SqliteTestDatabase.UserId);
        await SeedRunAsync(db, SqliteTestDatabase.UserId, conversationId, AiRunStatus.Completed, 100, 0.1m, Now.AddDays(-1),
            ("search_exercises", AiToolExecutionStatus.Completed, 20));
        await using var context = db.CreateContext();
        var runId = context.AiRuns.First().Id;
        var execution = context.AiToolExecutions.First();
        execution.ArgumentsJson = """{"apiKey":"sk-live-0123456789abcdef0123456789abcdef"}""";
        await context.SaveChangesAsync();
        var service = new AdminAiService(context, new FitMate.Services.AI.AiRedactionService());

        var run = await service.GetRunAsync(runId);

        Assert.NotNull(run);
        var tool = Assert.Single(run!.ToolExecutions);
        Assert.DoesNotContain("sk-live-0123456789abcdef0123456789abcdef", tool.ArgumentsJson);
    }

    [Fact]
    public async Task GetUsageAndCosts_AggregateTheWindow()
    {
        using var db = new SqliteTestDatabase();
        var conversationId = await SeedConversationAsync(db, SqliteTestDatabase.UserId);
        await SeedRunAsync(db, SqliteTestDatabase.UserId, conversationId, AiRunStatus.Completed, 100, 1.5m, Now.AddDays(-1));
        await SeedRunAsync(db, SqliteTestDatabase.OtherUserId, conversationId, AiRunStatus.Completed, 100, 2.5m, Now.AddDays(-2));
        await using var context = db.CreateContext();
        var service = new AdminAiService(context, new FitMate.Services.AI.AiRedactionService());
        var window = new AiOverviewQueryRequest { From = Now.AddDays(-10), To = Now };

        var usage = await service.GetUsageAsync(window);
        var costs = await service.GetCostsAsync(window);

        Assert.Equal(2, usage.TotalRuns);
        Assert.Equal(2, usage.DistinctUsers);
        Assert.Equal(200, usage.InputTokens);
        Assert.Equal(4.0m, costs.TotalEstimatedCost);
        Assert.Equal(2, costs.ByDay.Count);
        Assert.Equal(2, costs.TopUsers.Count);
    }
```

- [ ] **Step 2: Run — expect FAIL**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter AdminAiServiceTests`

- [ ] **Step 3: Implement** (replace the four remaining `NotImplementedException` members)

```csharp
    public async Task<PagedResponse<AiAdminRunModel>> ListRunsAsync(AiRunQueryRequest request)
    {
        var page = request.Page <= 0 ? 1 : request.Page;
        var pageSize = request.PageSize <= 0 ? 20 : Math.Min(request.PageSize, 100);

        var query = dbContext.AiRuns.AsNoTracking().AsQueryable();

        if (request.UserId.HasValue)
        {
            query = query.Where(r => r.UserId == request.UserId.Value);
        }

        if (request.ConversationId.HasValue)
        {
            query = query.Where(r => r.ConversationId == request.ConversationId.Value);
        }

        if (request.Status.HasValue)
        {
            query = query.Where(r => r.Status == request.Status.Value);
        }

        var model = request.Model?.Trim();
        if (!string.IsNullOrWhiteSpace(model))
        {
            query = query.Where(r => r.Model == model);
        }

        var errorCode = request.ErrorCode?.Trim();
        if (!string.IsNullOrWhiteSpace(errorCode))
        {
            query = query.Where(r => r.ErrorCode == errorCode);
        }

        if (request.From.HasValue)
        {
            query = query.Where(r => r.StartedAt >= request.From.Value);
        }

        if (request.To.HasValue)
        {
            query = query.Where(r => r.StartedAt < request.To.Value);
        }

        var totalCount = await query.CountAsync();
        var items = await query
            .OrderByDescending(r => r.StartedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new AiAdminRunModel
            {
                Id = r.Id,
                UserId = r.UserId,
                UserEmail = dbContext.Users.Where(u => u.Id == r.UserId).Select(u => u.Email).FirstOrDefault(),
                ConversationId = r.ConversationId,
                Status = r.Status,
                Provider = r.Provider,
                Model = r.Model,
                PromptVersion = r.PromptVersion,
                InputTokens = r.InputTokens,
                OutputTokens = r.OutputTokens,
                CachedInputTokens = r.CachedInputTokens,
                EstimatedCost = r.EstimatedCost,
                ToolCallCount = r.ToolCallCount,
                DurationMilliseconds = r.DurationMilliseconds,
                ErrorCode = r.ErrorCode,
                ErrorMessage = r.ErrorMessage,
                StartedAt = r.StartedAt,
                CompletedAt = r.CompletedAt,
            })
            .ToListAsync();

        return new PagedResponse<AiAdminRunModel>
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
        };
    }

    public async Task<AiAdminRunModel?> GetRunAsync(long runId)
    {
        var run = await dbContext.AiRuns
            .AsNoTracking()
            .Where(r => r.Id == runId)
            .Select(r => new AiAdminRunModel
            {
                Id = r.Id,
                UserId = r.UserId,
                UserEmail = dbContext.Users.Where(u => u.Id == r.UserId).Select(u => u.Email).FirstOrDefault(),
                ConversationId = r.ConversationId,
                Status = r.Status,
                Provider = r.Provider,
                Model = r.Model,
                PromptVersion = r.PromptVersion,
                InputTokens = r.InputTokens,
                OutputTokens = r.OutputTokens,
                CachedInputTokens = r.CachedInputTokens,
                EstimatedCost = r.EstimatedCost,
                ToolCallCount = r.ToolCallCount,
                DurationMilliseconds = r.DurationMilliseconds,
                ErrorCode = r.ErrorCode,
                ErrorMessage = r.ErrorMessage,
                StartedAt = r.StartedAt,
                CompletedAt = r.CompletedAt,
            })
            .FirstOrDefaultAsync();

        if (run == null)
        {
            return null;
        }

        run.ToolExecutions = await dbContext.AiToolExecutions
            .AsNoTracking()
            .Where(t => t.AiRunId == runId)
            .OrderBy(t => t.StartedAt)
            .Select(t => new AiAdminToolExecutionModel
            {
                Id = t.Id,
                AiRunId = t.AiRunId,
                ToolCallId = t.ToolCallId,
                ToolName = t.ToolName,
                ArgumentsJson = t.ArgumentsJson,
                ResultJson = t.ResultJson,
                Status = t.Status,
                DurationMilliseconds = t.DurationMilliseconds,
                ErrorCode = t.ErrorCode,
                ErrorMessage = t.ErrorMessage,
                StartedAt = t.StartedAt,
            })
            .ToListAsync();

        foreach (var execution in run.ToolExecutions)
        {
            execution.ArgumentsJson = redactionService.RedactJson(execution.ArgumentsJson);
            execution.ResultJson = execution.ResultJson == null
                ? null
                : redactionService.RedactJson(execution.ResultJson);
        }

        return run;
    }

    public async Task<AiUsageSummaryAdminModel> GetUsageAsync(AiOverviewQueryRequest request)
    {
        var (from, to) = ResolveWindow(request);
        var runs = await LoadRunFactsAsync(from, to);

        return new AiUsageSummaryAdminModel
        {
            TotalRuns = runs.Count,
            DistinctUsers = runs.Select(r => r.UserId).Distinct().Count(),
            InputTokens = runs.Sum(r => (long)r.InputTokens),
            OutputTokens = runs.Sum(r => (long)r.OutputTokens),
            CachedInputTokens = runs.Sum(r => (long)r.CachedInputTokens),
            ToolCallCount = runs.Sum(r => r.ToolCallCount),
        };
    }

    public async Task<AiCostSummaryModel> GetCostsAsync(AiOverviewQueryRequest request)
    {
        var (from, to) = ResolveWindow(request);
        var runs = await LoadRunFactsAsync(from, to);
        var planCodeByUser = await ResolvePlanCodesAsync(runs.Select(r => r.UserId).Distinct().ToList());
        var emailByUser = await dbContext.Users
            .AsNoTracking()
            .Where(u => runs.Select(r => r.UserId).Contains(u.Id))
            .Select(u => new { u.Id, u.Email })
            .ToDictionaryAsync(u => u.Id, u => u.Email);

        return new AiCostSummaryModel
        {
            TotalEstimatedCost = runs.Sum(r => r.EstimatedCost ?? 0m),
            ByDay = BuildCostByDay(runs),
            ByPlan = runs
                .GroupBy(r => planCodeByUser.GetValueOrDefault(r.UserId, "free"))
                .Select(group => new AiCostByPlanModel
                {
                    PlanCode = group.Key,
                    RunCount = group.Count(),
                    EstimatedCost = group.Sum(r => r.EstimatedCost ?? 0m),
                })
                .OrderByDescending(p => p.EstimatedCost)
                .ToList(),
            TopUsers = runs
                .GroupBy(r => r.UserId)
                .Select(group => new AiUserCostModel
                {
                    UserId = group.Key,
                    Email = emailByUser.GetValueOrDefault(group.Key),
                    RunCount = group.Count(),
                    EstimatedCost = group.Sum(r => r.EstimatedCost ?? 0m),
                })
                .OrderByDescending(u => u.EstimatedCost)
                .Take(TopCount)
                .ToList(),
        };
    }
```

- [ ] **Step 4: Run — expect PASS**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter AdminAiServiceTests`

- [ ] **Step 5: Commit**

```bash
git add server/FitMate.Core server/FitMate.Services server/FitMate.Tests
git commit -m "feat(ai-admin): run traces, usage and cost endpoints"
```

---

### Task 8: `AdminAiController` + DI + integration tests

**Files:**
- Create: `server/FitMate.Web/Controllers/Admin/AdminAiController.cs`
- Modify: `server/FitMate.Web/Program.cs` (DI)
- Test: `server/FitMate.Tests/Integration/AdminAiApiTests.cs`

**Interfaces:**
- Produces (all `[AdminGuard]`, spec §53):

```text
GET /api/admin/ai/overview                    → AiAdminOverviewModel
GET /api/admin/ai/conversations               → PagedResponse<AiConversationListItemModel>
GET /api/admin/ai/conversations/{id}          → AiConversationDetailModel
GET /api/admin/ai/runs                        → PagedResponse<AiAdminRunModel>
GET /api/admin/ai/runs/{id}                   → AiAdminRunModel
GET /api/admin/ai/unsupported-requests        → PagedResponse<UnsupportedAiRequestModel>
GET /api/admin/ai/unsupported-requests/{id}   → UnsupportedAiRequestModel
PUT /api/admin/ai/unsupported-requests/{id}   → UnsupportedAiRequestModel
GET /api/admin/ai/usage                       → AiUsageSummaryAdminModel
GET /api/admin/ai/costs                       → AiCostSummaryModel
```

- [ ] **Step 1: Write the controller** (copy `AdminErrorController`'s shape exactly)

```csharp
using FitMate.Core.JsonModels.AdminAi;
using FitMate.DB;
using FitMate.Services.AdminAi;
using FitMate.Services.Users;
using FitMate.Web.Attributes;
using FitMate.Web.Controllers.Base;
using FitMate.Web.Extensions;
using Microsoft.AspNetCore.Mvc;

namespace FitMate.Web.Controllers.Admin;

[AdminGuard]
[Route("api/admin/ai")]
public class AdminAiController : BaseApiController
{
    private readonly IAdminAiService adminAiService;
    private readonly IAdminUnsupportedRequestService unsupportedRequestService;

    public AdminAiController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService,
        IAdminAiService adminAiService,
        IAdminUnsupportedRequestService unsupportedRequestService)
        : base(logger, dbContext, userService)
    {
        this.adminAiService = adminAiService;
        this.unsupportedRequestService = unsupportedRequestService;
    }

    [HttpGet("overview")]
    public async Task<ActionResult> GetOverview([FromQuery] AiOverviewQueryRequest request) =>
        this.ReturnJson(await adminAiService.GetOverviewAsync(request));

    [HttpGet("conversations")]
    public async Task<ActionResult> ListConversations([FromQuery] AiConversationQueryRequest request) =>
        this.ReturnJson(await adminAiService.ListConversationsAsync(request));

    [HttpGet("conversations/{id:long}")]
    public async Task<ActionResult> GetConversation(long id)
    {
        var conversation = await adminAiService.GetConversationAsync(id);
        return conversation == null
            ? this.ReturnJsonError("Conversation not found.")
            : this.ReturnJson(conversation);
    }

    [HttpGet("runs")]
    public async Task<ActionResult> ListRuns([FromQuery] AiRunQueryRequest request) =>
        this.ReturnJson(await adminAiService.ListRunsAsync(request));

    [HttpGet("runs/{id:long}")]
    public async Task<ActionResult> GetRun(long id)
    {
        var run = await adminAiService.GetRunAsync(id);
        return run == null ? this.ReturnJsonError("Run not found.") : this.ReturnJson(run);
    }

    [HttpGet("unsupported-requests")]
    public async Task<ActionResult> ListUnsupported([FromQuery] UnsupportedRequestQueryRequest request) =>
        this.ReturnJson(await unsupportedRequestService.ListAsync(request));

    [HttpGet("unsupported-requests/{id:long}")]
    public async Task<ActionResult> GetUnsupported(long id)
    {
        var item = await unsupportedRequestService.GetByIdAsync(id);
        return item == null ? this.ReturnJsonError("Request not found.") : this.ReturnJson(item);
    }

    [HttpPut("unsupported-requests/{id:long}")]
    public async Task<ActionResult> UpdateUnsupported(long id, [FromBody] UpdateUnsupportedRequestRequest request) =>
        this.ReturnJson(await unsupportedRequestService.UpdateAsync(id, request));

    [HttpGet("usage")]
    public async Task<ActionResult> GetUsage([FromQuery] AiOverviewQueryRequest request) =>
        this.ReturnJson(await adminAiService.GetUsageAsync(request));

    [HttpGet("costs")]
    public async Task<ActionResult> GetCosts([FromQuery] AiOverviewQueryRequest request) =>
        this.ReturnJson(await adminAiService.GetCostsAsync(request));
}
```

- [ ] **Step 2: Register DI** — in `Program.cs`, next to `IAdminErrorService`:

```csharp
builder.Services.AddScoped<IAdminAiService, AdminAiService>();
builder.Services.AddScoped<IAdminUnsupportedRequestService, AdminUnsupportedRequestService>();
```

- [ ] **Step 3: Write the integration tests**

```csharp
using System.Net;
using System.Net.Http.Json;
using FitMate.Core.JsonModels.AdminAi;
using FitMate.Core.JsonModels.Common;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitMate.Tests.Integration;

public class AdminAiApiTests
{
    [Theory]
    [InlineData("/api/admin/ai/overview")]
    [InlineData("/api/admin/ai/conversations")]
    [InlineData("/api/admin/ai/runs")]
    [InlineData("/api/admin/ai/unsupported-requests")]
    [InlineData("/api/admin/ai/usage")]
    [InlineData("/api/admin/ai/costs")]
    public async Task AdminAiEndpoints_WithoutAuth_Return401(string url)
    {
        using var factory = new TestWebApplicationFactory();
        var client = factory.CreateApiClient();

        var response = await client.GetAsync(url);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("/api/admin/ai/overview")]
    [InlineData("/api/admin/ai/conversations")]
    [InlineData("/api/admin/ai/unsupported-requests")]
    public async Task AdminAiEndpoints_AsNonAdmin_Return403(string url)
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateUserClientAsync("not-admin@test.local");

        var response = await client.GetAsync(url);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Overview_AsAdmin_Returns200()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateAdminClientAsync();

        var response = await client.GetAsync("/api/admin/ai/overview");
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<AiAdminOverviewModel>>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(body!.Success);
    }

    [Fact]
    public async Task UnsupportedRequests_UpdateStatus_Persists()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateAdminClientAsync();

        long id;
        using (var scope = factory.Services.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var group = new UnsupportedAiRequest
            {
                Category = "integration",
                NormalizedKey = "import apple health workouts",
                RequestedFunctionality = "Import my Apple Health workouts.",
                Status = UnsupportedRequestStatus.New,
                OccurrenceCount = 1,
                FirstRequestedAt = DateTime.UtcNow,
                LastRequestedAt = DateTime.UtcNow,
            };
            context.UnsupportedAiRequests.Add(group);
            await context.SaveChangesAsync();
            id = group.Id;
        }

        var response = await client.PutAsJsonAsync(
            $"/api/admin/ai/unsupported-requests/{id}",
            new UpdateUnsupportedRequestRequest
            {
                Status = UnsupportedRequestStatus.Planned,
                AdminNotes = "On the roadmap",
                ExternalTrackingKey = "FM-12",
            });
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<UnsupportedAiRequestModel>>();

        Assert.True(body!.Success);
        Assert.Equal(UnsupportedRequestStatus.Planned, body.Data!.Status);

        using var verifyScope = factory.Services.CreateScope();
        var verifyContext = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
        var stored = await verifyContext.UnsupportedAiRequests.AsNoTracking().SingleAsync(x => x.Id == id);
        Assert.Equal(UnsupportedRequestStatus.Planned, stored.Status);
        Assert.Equal("FM-12", stored.ExternalTrackingKey);
    }

    [Fact]
    public async Task Conversations_ListIsPaginated()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateAdminClientAsync();

        var response = await client.GetAsync("/api/admin/ai/conversations?page=1&pageSize=5");
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<PagedResponse<AiConversationListItemModel>>>();

        Assert.True(body!.Success);
        Assert.Equal(1, body.Data!.Page);
        Assert.Equal(5, body.Data.PageSize);
    }
}
```

- [ ] **Step 4: Build, regenerate types, run tests**

Run: `dotnet build server/FitMate.Web/FitMate.Web.csproj`
Then: `cd client && npm run process-types && npx tsc -b --noEmit`
Then: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter AdminAiApiTests`
Expected: `client/src/types/backend.ts` gains `AiAdminOverviewModel`, `AiConversationListItemModel`,
`AiConversationDetailModel`, `AiAdminRunModel`, `UnsupportedAiRequestModel`, `UnsupportedRequestStatus`.

- [ ] **Step 5: Commit**

```bash
git add server/FitMate.Web server/FitMate.Tests client/src/types
git commit -m "feat(ai-admin): admin AI API with authorization tests"
```

---

### Task 9: Subscription plan administration (TDD)

**Files:**
- Create: `server/FitMate.Core/JsonModels/AdminSubscriptions/SubscriptionPlanAdminModel.cs` (+ `PlanPriceAdminModel`, `PlanEntitlementAdminModel`), `SavePlanRequest.cs` (+ `PlanPriceRequest`, `PlanEntitlementRequest`)
- Create: `server/FitMate.Services/AdminSubscriptions/IAdminSubscriptionPlanService.cs`, `AdminSubscriptionPlanService.cs`
- Test: `server/FitMate.Tests/Unit/Services/AdminSubscriptionPlanServiceTests.cs`

**Interfaces:**
- Consumes: Plan 04's `Plan`, `PlanPrice`, `PlanEntitlement`, `UserSubscription`, `IEntitlementService.Invalidate`.
- Produces:

```csharp
using FitMate.Core.JsonModels.AdminSubscriptions;

namespace FitMate.Services.AdminSubscriptions;

public interface IAdminSubscriptionPlanService
{
    Task<IReadOnlyList<SubscriptionPlanAdminModel>> ListAsync();
    Task<SubscriptionPlanAdminModel?> GetByIdAsync(long planId);
    Task<SubscriptionPlanAdminModel> CreateAsync(SavePlanRequest request);
    Task<SubscriptionPlanAdminModel> UpdateAsync(long planId, SavePlanRequest request);
    Task<bool> DeactivateAsync(long planId);
}
```

```csharp
using FitMate.DB.Enums;
using System.ComponentModel.DataAnnotations;

namespace FitMate.Core.JsonModels.AdminSubscriptions;

public class SubscriptionPlanAdminModel
{
    public long Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; }
    public bool IsPublic { get; set; }
    public int SortOrder { get; set; }
    public int SubscriberCount { get; set; }
    public bool IsCodeLocked { get; set; }     // true once any UserSubscription references the plan
    public List<PlanPriceAdminModel> Prices { get; set; } = [];
    public List<PlanEntitlementAdminModel> Entitlements { get; set; } = [];
}

public class PlanPriceAdminModel
{
    public long Id { get; set; }
    public string Currency { get; set; } = "EUR";
    public decimal Amount { get; set; }
    public BillingInterval BillingInterval { get; set; }
    public string StripePriceId { get; set; } = string.Empty;
    public bool IsActive { get; set; }
}

public class PlanEntitlementAdminModel
{
    public long Id { get; set; }
    public SubscriptionFeature Feature { get; set; }
    public bool IsEnabled { get; set; }
    public int? DailyLimit { get; set; }
    public int? MonthlyLimit { get; set; }
    public int? MaximumPerRequest { get; set; }
    public int? SoftLimit { get; set; }
    public int? HardLimit { get; set; }
    public string? ConfigurationJson { get; set; }
}

public class SavePlanRequest
{
    [Required]
    [StringLength(50)]
    public string Code { get; set; } = string.Empty;

    [Required]
    [StringLength(100)]
    public string Name { get; set; } = string.Empty;

    [StringLength(1000)]
    public string? Description { get; set; }

    public bool IsActive { get; set; } = true;
    public bool IsPublic { get; set; } = true;
    public int SortOrder { get; set; }
    public List<PlanPriceRequest> Prices { get; set; } = [];
    public List<PlanEntitlementRequest> Entitlements { get; set; } = [];
}

public class PlanPriceRequest
{
    public long? Id { get; set; }

    [Required]
    [StringLength(3, MinimumLength = 3)]
    public string Currency { get; set; } = "EUR";

    [Range(0, 100000)]
    public decimal Amount { get; set; }

    public BillingInterval BillingInterval { get; set; }

    [StringLength(200)]
    public string StripePriceId { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;
}

public class PlanEntitlementRequest
{
    public SubscriptionFeature Feature { get; set; }
    public bool IsEnabled { get; set; }
    public int? DailyLimit { get; set; }
    public int? MonthlyLimit { get; set; }
    public int? MaximumPerRequest { get; set; }
    public int? SoftLimit { get; set; }
    public int? HardLimit { get; set; }
    public string? ConfigurationJson { get; set; }
}
```

Rules (spec §58):
- **Plan `Code` is immutable once any `UserSubscription` references the plan** — attempting to change it throws `FitMateException`. `IsCodeLocked` tells the UI to disable the field.
- Duplicate codes are rejected (case-insensitive) on create and update.
- Entitlements are upserted by `Feature`; features absent from the request are **deleted**.
- Prices are upserted by `Id`; prices absent from the request are **deactivated**, never deleted (Stripe price IDs must stay resolvable for historical subscriptions).
- Negative limits are rejected; `null` stays "unlimited".
- Deleting a plan is not supported — `DeactivateAsync` sets `IsActive = false`; the seeded `free`, `plus`, `pro` codes cannot be deactivated (the entitlement fallback needs `free` to exist).
- Any mutation must invalidate the entitlement cache of affected subscribers (`IEntitlementService.Invalidate(userId)` per subscriber; Plan 04's cache is 60 s so this is belt-and-braces, but do it explicitly).

- [ ] **Step 1: Write failing tests**

```csharp
using FitMate.Core.JsonModels.AdminSubscriptions;
using FitMate.DB.Constants;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.AdminSubscriptions;
using FitMate.Services.Subscriptions;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace FitMate.Tests.Unit.Services;

public class AdminSubscriptionPlanServiceTests
{
    private static AdminSubscriptionPlanService CreateService(SqliteTestDatabase db, out FitMate.DB.AppDbContext context)
    {
        using (var seedContext = db.CreateContext())
        {
            SqliteTestDatabase.SeedPlans(seedContext);
        }

        context = db.CreateContext();
        return new AdminSubscriptionPlanService(
            context,
            new EntitlementService(context, new MemoryCache(new MemoryCacheOptions())));
    }

    private static SavePlanRequest ValidRequest(string code = "coach") => new()
    {
        Code = code,
        Name = "Coach",
        Description = "For trainers",
        IsActive = true,
        IsPublic = true,
        SortOrder = 4,
        Prices =
        [
            new PlanPriceRequest { Currency = "EUR", Amount = 29.99m, BillingInterval = BillingInterval.Monthly, StripePriceId = "price_monthly" },
        ],
        Entitlements =
        [
            new PlanEntitlementRequest { Feature = SubscriptionFeature.AiChat, IsEnabled = true, MonthlyLimit = 1000 },
            new PlanEntitlementRequest { Feature = SubscriptionFeature.ActiveProgramPlans, IsEnabled = true, HardLimit = 25 },
        ],
    };

    [Fact]
    public async Task List_ReturnsSeededPlansWithSubscriberCounts()
    {
        using var db = new SqliteTestDatabase();
        var service = CreateService(db, out var context);
        context.UserSubscriptions.Add(new UserSubscription
        {
            UserId = SqliteTestDatabase.UserId,
            PlanId = SqliteTestDatabase.PlusPlanId,
            Status = SubscriptionStatus.Active,
        });
        await context.SaveChangesAsync();

        var plans = await service.ListAsync();

        Assert.Equal(3, plans.Count);
        var plus = plans.Single(p => p.Code == PlanCodes.Plus);
        Assert.Equal(1, plus.SubscriberCount);
        Assert.True(plus.IsCodeLocked);
        Assert.False(plans.Single(p => p.Code == PlanCodes.Pro).IsCodeLocked);
    }

    [Fact]
    public async Task Create_PersistsPricesAndEntitlements()
    {
        using var db = new SqliteTestDatabase();
        var service = CreateService(db, out var context);

        var created = await service.CreateAsync(ValidRequest());

        Assert.Equal("coach", created.Code);
        Assert.Single(created.Prices);
        Assert.Equal(2, created.Entitlements.Count);
        Assert.Equal(4, await context.Plans.CountAsync());
    }

    [Fact]
    public async Task Create_DuplicateCode_Throws()
    {
        using var db = new SqliteTestDatabase();
        var service = CreateService(db, out _);

        await Assert.ThrowsAnyAsync<Exception>(() => service.CreateAsync(ValidRequest(PlanCodes.Plus)));
    }

    [Fact]
    public async Task Update_ChangingCodeWithSubscribers_Throws()
    {
        using var db = new SqliteTestDatabase();
        var service = CreateService(db, out var context);
        context.UserSubscriptions.Add(new UserSubscription
        {
            UserId = SqliteTestDatabase.UserId,
            PlanId = SqliteTestDatabase.PlusPlanId,
            Status = SubscriptionStatus.Active,
        });
        await context.SaveChangesAsync();

        var request = ValidRequest("plus-renamed");
        request.Name = "Plus";

        await Assert.ThrowsAnyAsync<Exception>(() => service.UpdateAsync(SqliteTestDatabase.PlusPlanId, request));
    }

    [Fact]
    public async Task Update_ChangingCodeWithoutSubscribers_Succeeds()
    {
        using var db = new SqliteTestDatabase();
        var service = CreateService(db, out _);

        var request = ValidRequest("pro-plus");
        request.Name = "Pro Plus";

        var updated = await service.UpdateAsync(SqliteTestDatabase.ProPlanId, request);

        Assert.Equal("pro-plus", updated.Code);
    }

    [Fact]
    public async Task Update_RemovesMissingEntitlementsAndDeactivatesMissingPrices()
    {
        using var db = new SqliteTestDatabase();
        var service = CreateService(db, out var context);
        context.PlanPrices.Add(new PlanPrice
        {
            PlanId = SqliteTestDatabase.ProPlanId,
            Currency = "EUR",
            Amount = 49m,
            BillingInterval = BillingInterval.Monthly,
            StripePriceId = "price_old",
            IsActive = true,
        });
        await context.SaveChangesAsync();

        var request = ValidRequest("pro");
        request.Name = "Pro";
        request.Prices.Clear();                              // no prices supplied
        request.Entitlements =
        [
            new PlanEntitlementRequest { Feature = SubscriptionFeature.AiChat, IsEnabled = true, MonthlyLimit = 999 },
        ];

        var updated = await service.UpdateAsync(SqliteTestDatabase.ProPlanId, request);

        Assert.Single(updated.Entitlements);
        Assert.Equal(999, updated.Entitlements[0].MonthlyLimit);
        var prices = await context.PlanPrices.AsNoTracking()
            .Where(p => p.PlanId == SqliteTestDatabase.ProPlanId)
            .ToListAsync();
        Assert.All(prices, price => Assert.False(price.IsActive));   // deactivated, not deleted
    }

    [Fact]
    public async Task Update_NegativeLimit_Throws()
    {
        using var db = new SqliteTestDatabase();
        var service = CreateService(db, out _);

        var request = ValidRequest("pro");
        request.Name = "Pro";
        request.Entitlements =
        [
            new PlanEntitlementRequest { Feature = SubscriptionFeature.AiChat, IsEnabled = true, MonthlyLimit = -5 },
        ];

        await Assert.ThrowsAnyAsync<Exception>(() => service.UpdateAsync(SqliteTestDatabase.ProPlanId, request));
    }

    [Fact]
    public async Task Deactivate_FreePlan_Throws()
    {
        using var db = new SqliteTestDatabase();
        var service = CreateService(db, out _);

        await Assert.ThrowsAnyAsync<Exception>(() => service.DeactivateAsync(SqliteTestDatabase.FreePlanId));
    }
}
```

- [ ] **Step 2: Run — expect FAIL**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter AdminSubscriptionPlanServiceTests`

- [ ] **Step 3: Implement**

```csharp
using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.AdminSubscriptions;
using FitMate.DB;
using FitMate.DB.Constants;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.Subscriptions;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.AdminSubscriptions;

public class AdminSubscriptionPlanService : IAdminSubscriptionPlanService
{
    private readonly AppDbContext dbContext;
    private readonly IEntitlementService entitlementService;

    public AdminSubscriptionPlanService(AppDbContext dbContext, IEntitlementService entitlementService)
    {
        this.dbContext = dbContext;
        this.entitlementService = entitlementService;
    }

    public async Task<IReadOnlyList<SubscriptionPlanAdminModel>> ListAsync()
    {
        var plans = await LoadPlansQuery().OrderBy(p => p.SortOrder).ToListAsync();
        var counts = await dbContext.UserSubscriptions
            .AsNoTracking()
            .GroupBy(s => s.PlanId)
            .Select(group => new { PlanId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(x => x.PlanId, x => x.Count);

        return plans.Select(plan => ToModel(plan, counts.GetValueOrDefault(plan.Id))).ToList();
    }

    public async Task<SubscriptionPlanAdminModel?> GetByIdAsync(long planId)
    {
        var plan = await LoadPlansQuery().FirstOrDefaultAsync(p => p.Id == planId);
        if (plan == null)
        {
            return null;
        }

        var count = await dbContext.UserSubscriptions.CountAsync(s => s.PlanId == planId);
        return ToModel(plan, count);
    }

    public async Task<SubscriptionPlanAdminModel> CreateAsync(SavePlanRequest request)
    {
        Validate(request);
        var code = request.Code.Trim().ToLowerInvariant();

        if (await dbContext.Plans.AnyAsync(p => p.Code == code))
        {
            throw new FitMateException($"A plan with code '{code}' already exists.");
        }

        var plan = new Plan { Code = code };
        dbContext.Plans.Add(plan);
        Apply(plan, request);
        await dbContext.SaveChangesAsync();

        return (await GetByIdAsync(plan.Id))!;
    }

    public async Task<SubscriptionPlanAdminModel> UpdateAsync(long planId, SavePlanRequest request)
    {
        Validate(request);

        var plan = await dbContext.Plans
            .Include(p => p.Prices)
            .Include(p => p.Entitlements)
            .FirstOrDefaultAsync(p => p.Id == planId)
            ?? throw new FitMateException("Plan not found.");

        var code = request.Code.Trim().ToLowerInvariant();
        if (!string.Equals(plan.Code, code, StringComparison.Ordinal))
        {
            var hasSubscribers = await dbContext.UserSubscriptions.AnyAsync(s => s.PlanId == planId);
            if (hasSubscribers)
            {
                throw new FitMateException(
                    "The plan code cannot be changed while subscriptions reference this plan.");
            }
            if (await dbContext.Plans.AnyAsync(p => p.Code == code && p.Id != planId))
            {
                throw new FitMateException($"A plan with code '{code}' already exists.");
            }
            plan.Code = code;
        }

        Apply(plan, request);
        await dbContext.SaveChangesAsync();
        await InvalidateSubscribersAsync(planId);

        return (await GetByIdAsync(planId))!;
    }

    public async Task<bool> DeactivateAsync(long planId)
    {
        var plan = await dbContext.Plans.FirstOrDefaultAsync(p => p.Id == planId);
        if (plan == null)
        {
            return false;
        }

        if (PlanCodes.All.Contains(plan.Code))
        {
            throw new FitMateException("Built-in plans cannot be deactivated.");
        }

        plan.IsActive = false;
        await dbContext.SaveChangesAsync();
        await InvalidateSubscribersAsync(planId);
        return true;
    }

    private IQueryable<Plan> LoadPlansQuery() =>
        dbContext.Plans
            .AsNoTracking()
            .Include(p => p.Prices)
            .Include(p => p.Entitlements);

    private static void Validate(SavePlanRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Name))
        {
            throw new FitMateException("Plan code and name are required.");
        }

        if (request.Entitlements.GroupBy(e => e.Feature).Any(group => group.Count() > 1))
        {
            throw new FitMateException("Each feature can appear only once.");
        }

        foreach (var entitlement in request.Entitlements)
        {
            int?[] limits =
            [
                entitlement.DailyLimit, entitlement.MonthlyLimit, entitlement.MaximumPerRequest,
                entitlement.SoftLimit, entitlement.HardLimit,
            ];

            if (limits.Any(limit => limit is < 0))
            {
                throw new FitMateException("Limits cannot be negative. Leave a limit empty for unlimited.");
            }
        }
    }

    private void Apply(Plan plan, SavePlanRequest request)
    {
        plan.Name = request.Name.Trim();
        plan.Description = request.Description;
        plan.IsActive = request.IsActive;
        plan.IsPublic = request.IsPublic;
        plan.SortOrder = request.SortOrder;

        // Entitlements: upsert by feature, delete the ones no longer supplied.
        foreach (var existing in plan.Entitlements.ToList())
        {
            var incoming = request.Entitlements.FirstOrDefault(e => e.Feature == existing.Feature);
            if (incoming == null)
            {
                dbContext.PlanEntitlements.Remove(existing);
                plan.Entitlements.Remove(existing);
                continue;
            }

            CopyEntitlement(incoming, existing);
        }

        foreach (var incoming in request.Entitlements
                     .Where(e => plan.Entitlements.All(existing => existing.Feature != e.Feature)))
        {
            var entitlement = new PlanEntitlement { Feature = incoming.Feature };
            CopyEntitlement(incoming, entitlement);
            plan.Entitlements.Add(entitlement);
        }

        // Prices: upsert by id; anything not supplied is deactivated so Stripe ids stay resolvable.
        foreach (var existing in plan.Prices)
        {
            var incoming = request.Prices.FirstOrDefault(p => p.Id == existing.Id);
            if (incoming == null)
            {
                existing.IsActive = false;
                continue;
            }

            existing.Currency = incoming.Currency.Trim().ToUpperInvariant();
            existing.Amount = incoming.Amount;
            existing.BillingInterval = incoming.BillingInterval;
            existing.StripePriceId = incoming.StripePriceId.Trim();
            existing.IsActive = incoming.IsActive;
        }

        foreach (var incoming in request.Prices.Where(p => p.Id == null))
        {
            plan.Prices.Add(new PlanPrice
            {
                Currency = incoming.Currency.Trim().ToUpperInvariant(),
                Amount = incoming.Amount,
                BillingInterval = incoming.BillingInterval,
                StripePriceId = incoming.StripePriceId.Trim(),
                IsActive = incoming.IsActive,
            });
        }
    }

    private static void CopyEntitlement(PlanEntitlementRequest source, PlanEntitlement target)
    {
        target.IsEnabled = source.IsEnabled;
        target.DailyLimit = source.DailyLimit;
        target.MonthlyLimit = source.MonthlyLimit;
        target.MaximumPerRequest = source.MaximumPerRequest;
        target.SoftLimit = source.SoftLimit;
        target.HardLimit = source.HardLimit;
        target.ConfigurationJson = source.ConfigurationJson;
    }

    private async Task InvalidateSubscribersAsync(long planId)
    {
        var userIds = await dbContext.UserSubscriptions
            .AsNoTracking()
            .Where(s => s.PlanId == planId)
            .Select(s => s.UserId)
            .Distinct()
            .ToListAsync();

        foreach (var userId in userIds)
        {
            entitlementService.Invalidate(userId);
        }
    }

    private static SubscriptionPlanAdminModel ToModel(Plan plan, int subscriberCount) => new()
    {
        Id = plan.Id,
        Code = plan.Code,
        Name = plan.Name,
        Description = plan.Description,
        IsActive = plan.IsActive,
        IsPublic = plan.IsPublic,
        SortOrder = plan.SortOrder,
        SubscriberCount = subscriberCount,
        IsCodeLocked = subscriberCount > 0,
        Prices = plan.Prices
            .OrderBy(p => p.BillingInterval)
            .Select(p => new PlanPriceAdminModel
            {
                Id = p.Id,
                Currency = p.Currency,
                Amount = p.Amount,
                BillingInterval = p.BillingInterval,
                StripePriceId = p.StripePriceId,
                IsActive = p.IsActive,
            })
            .ToList(),
        Entitlements = plan.Entitlements
            .OrderBy(e => e.Feature)
            .Select(e => new PlanEntitlementAdminModel
            {
                Id = e.Id,
                Feature = e.Feature,
                IsEnabled = e.IsEnabled,
                DailyLimit = e.DailyLimit,
                MonthlyLimit = e.MonthlyLimit,
                MaximumPerRequest = e.MaximumPerRequest,
                SoftLimit = e.SoftLimit,
                HardLimit = e.HardLimit,
                ConfigurationJson = e.ConfigurationJson,
            })
            .ToList(),
    };
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter AdminSubscriptionPlanServiceTests`

- [ ] **Step 5: Commit**

```bash
git add server/FitMate.Core server/FitMate.Services server/FitMate.Tests
git commit -m "feat(admin-subscriptions): plan editor service with immutable codes"
```

---

### Task 10: User subscription administration + usage inspection (TDD)

**Files:**
- Create: `server/FitMate.Core/JsonModels/AdminSubscriptions/UserSubscriptionAdminModel.cs`, `SubscriptionQueryRequest.cs`, `AssignPlanOverrideRequest.cs`, `UserUsageAdminModel.cs`, `UsageQueryRequest.cs`
- Create: `server/FitMate.Services/AdminSubscriptions/IAdminSubscriptionService.cs`, `AdminSubscriptionService.cs`
- Test: `server/FitMate.Tests/Unit/Services/AdminSubscriptionServiceTests.cs`

**Interfaces:**
- Consumes: Plan 04's `UserSubscription`, `UserPlanOverride`, `UsageBucket`, `IEntitlementService`.
- Produces:

```csharp
using FitMate.Core.JsonModels.AdminSubscriptions;
using FitMate.Core.JsonModels.Common;

namespace FitMate.Services.AdminSubscriptions;

public interface IAdminSubscriptionService
{
    Task<PagedResponse<UserSubscriptionAdminModel>> ListAsync(SubscriptionQueryRequest request);
    Task<UserSubscriptionAdminModel> AssignOverrideAsync(AssignPlanOverrideRequest request, long adminUserId);
    Task<bool> RevokeOverrideAsync(long overrideId, long adminUserId);
    Task<PagedResponse<UserUsageAdminModel>> ListUsageAsync(UsageQueryRequest request);
}
```

```csharp
using FitMate.Core.JsonModels.Common;
using FitMate.DB.Enums;
using System.ComponentModel.DataAnnotations;

namespace FitMate.Core.JsonModels.AdminSubscriptions;

public class UserSubscriptionAdminModel
{
    public long UserId { get; set; }
    public string? Email { get; set; }
    public string EffectivePlanCode { get; set; } = string.Empty;
    public EntitlementSource EffectivePlanSource { get; set; }
    public long? SubscriptionId { get; set; }
    public string? SubscriptionPlanCode { get; set; }
    public SubscriptionStatus? Status { get; set; }
    public DateTime? CurrentPeriodEnd { get; set; }
    public bool CancelAtPeriodEnd { get; set; }
    public long? ActiveOverrideId { get; set; }
    public string? ActiveOverridePlanCode { get; set; }
    public string? ActiveOverrideReason { get; set; }
    public DateTime? ActiveOverrideEndsAt { get; set; }
}

public class SubscriptionQueryRequest : PagedRequest
{
    [StringLength(256)]
    public string? Email { get; set; }

    [StringLength(50)]
    public string? PlanCode { get; set; }

    public SubscriptionStatus? Status { get; set; }
    public bool? HasOverride { get; set; }
}

public class AssignPlanOverrideRequest
{
    public long UserId { get; set; }
    public long PlanId { get; set; }

    [Required]
    [StringLength(500)]
    public string Reason { get; set; } = string.Empty;

    public DateTime? EndsAt { get; set; }
}

public class UserUsageAdminModel
{
    public long UserId { get; set; }
    public string? Email { get; set; }
    public SubscriptionFeature Feature { get; set; }
    public DateOnly PeriodStart { get; set; }
    public DateOnly PeriodEnd { get; set; }
    public int Used { get; set; }
    public int Reserved { get; set; }
    public int? EffectiveLimit { get; set; }
}

public class UsageQueryRequest : PagedRequest
{
    public long? UserId { get; set; }

    [StringLength(256)]
    public string? Email { get; set; }

    public SubscriptionFeature? Feature { get; set; }

    /// Any month containing this date. Defaults to the current month.
    public DateOnly? Period { get; set; }
}
```

Rules (spec §52):
- `AssignOverrideAsync` deactivates any currently-active override for that user, records `PreviousPlanCode` (the user's effective plan code before the change), sets `CreatedByUserId = adminUserId`, `StartsAt = DateTime.UtcNow`, `IsActive = true`, then calls `entitlementService.Invalidate(userId)`.
- A Stripe-controlled `UserSubscription` is **never** modified by an override (spec §52) — the override is a separate row that simply wins in resolution.
- `RevokeOverrideAsync` sets `IsActive = false` and invalidates the cache.
- The list is driven by users who have either a subscription or an override; page size defaults to 20, capped at 100.

- [ ] **Step 1: Write failing tests**

```csharp
using FitMate.Core.JsonModels.AdminSubscriptions;
using FitMate.DB.Constants;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.AdminSubscriptions;
using FitMate.Services.Subscriptions;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace FitMate.Tests.Unit.Services;

public class AdminSubscriptionServiceTests
{
    private static AdminSubscriptionService CreateService(SqliteTestDatabase db, out FitMate.DB.AppDbContext context)
    {
        using (var seedContext = db.CreateContext())
        {
            SqliteTestDatabase.SeedPlans(seedContext);
        }

        context = db.CreateContext();
        return new AdminSubscriptionService(
            context,
            new EntitlementService(context, new MemoryCache(new MemoryCacheOptions())));
    }

    [Fact]
    public async Task List_ShowsSubscriptionAndEffectivePlan()
    {
        using var db = new SqliteTestDatabase();
        var service = CreateService(db, out var context);
        context.UserSubscriptions.Add(new UserSubscription
        {
            UserId = SqliteTestDatabase.UserId,
            PlanId = SqliteTestDatabase.PlusPlanId,
            Status = SubscriptionStatus.Active,
            CurrentPeriodEnd = new DateTime(2026, 8, 27, 0, 0, 0, DateTimeKind.Utc),
        });
        await context.SaveChangesAsync();

        var page = await service.ListAsync(new SubscriptionQueryRequest());

        var item = Assert.Single(page.Items);
        Assert.Equal(PlanCodes.Plus, item.SubscriptionPlanCode);
        Assert.Equal(PlanCodes.Plus, item.EffectivePlanCode);
        Assert.Equal(EntitlementSource.Subscription, item.EffectivePlanSource);
    }

    [Fact]
    public async Task AssignOverride_RecordsPreviousPlanAndWinsOverSubscription()
    {
        using var db = new SqliteTestDatabase();
        var service = CreateService(db, out var context);
        context.UserSubscriptions.Add(new UserSubscription
        {
            UserId = SqliteTestDatabase.UserId,
            PlanId = SqliteTestDatabase.PlusPlanId,
            Status = SubscriptionStatus.Active,
        });
        await context.SaveChangesAsync();

        var model = await service.AssignOverrideAsync(
            new AssignPlanOverrideRequest
            {
                UserId = SqliteTestDatabase.UserId,
                PlanId = SqliteTestDatabase.ProPlanId,
                Reason = "Beta tester",
                EndsAt = DateTime.UtcNow.AddDays(30),
            },
            SqliteTestDatabase.AdminUserId);

        Assert.Equal(PlanCodes.Pro, model.EffectivePlanCode);
        Assert.Equal(EntitlementSource.AdminOverride, model.EffectivePlanSource);

        var stored = await context.UserPlanOverrides.AsNoTracking().SingleAsync();
        Assert.Equal(SqliteTestDatabase.AdminUserId, stored.CreatedByUserId);
        Assert.Equal(PlanCodes.Plus, stored.PreviousPlanCode);
        Assert.True(stored.IsActive);

        // The Stripe-controlled subscription is untouched.
        var subscription = await context.UserSubscriptions.AsNoTracking().SingleAsync();
        Assert.Equal(SqliteTestDatabase.PlusPlanId, subscription.PlanId);
        Assert.Equal(SubscriptionStatus.Active, subscription.Status);
    }

    [Fact]
    public async Task AssignOverride_SecondTime_DeactivatesTheFirst()
    {
        using var db = new SqliteTestDatabase();
        var service = CreateService(db, out var context);

        await service.AssignOverrideAsync(
            new AssignPlanOverrideRequest { UserId = SqliteTestDatabase.UserId, PlanId = SqliteTestDatabase.PlusPlanId, Reason = "First" },
            SqliteTestDatabase.AdminUserId);
        await service.AssignOverrideAsync(
            new AssignPlanOverrideRequest { UserId = SqliteTestDatabase.UserId, PlanId = SqliteTestDatabase.ProPlanId, Reason = "Second" },
            SqliteTestDatabase.AdminUserId);

        var overrides = await context.UserPlanOverrides.AsNoTracking().ToListAsync();
        Assert.Equal(2, overrides.Count);
        Assert.Single(overrides, o => o.IsActive);
        Assert.Equal(SqliteTestDatabase.ProPlanId, overrides.Single(o => o.IsActive).PlanId);
    }

    [Fact]
    public async Task AssignOverride_EmptyReason_Throws()
    {
        using var db = new SqliteTestDatabase();
        var service = CreateService(db, out _);

        await Assert.ThrowsAnyAsync<Exception>(() => service.AssignOverrideAsync(
            new AssignPlanOverrideRequest { UserId = SqliteTestDatabase.UserId, PlanId = SqliteTestDatabase.ProPlanId, Reason = "  " },
            SqliteTestDatabase.AdminUserId));
    }

    [Fact]
    public async Task RevokeOverride_RestoresSubscriptionPlan()
    {
        using var db = new SqliteTestDatabase();
        var service = CreateService(db, out var context);
        context.UserSubscriptions.Add(new UserSubscription
        {
            UserId = SqliteTestDatabase.UserId,
            PlanId = SqliteTestDatabase.PlusPlanId,
            Status = SubscriptionStatus.Active,
        });
        await context.SaveChangesAsync();
        await service.AssignOverrideAsync(
            new AssignPlanOverrideRequest { UserId = SqliteTestDatabase.UserId, PlanId = SqliteTestDatabase.ProPlanId, Reason = "Temp" },
            SqliteTestDatabase.AdminUserId);
        var overrideId = context.UserPlanOverrides.Single().Id;

        Assert.True(await service.RevokeOverrideAsync(overrideId, SqliteTestDatabase.AdminUserId));

        var page = await service.ListAsync(new SubscriptionQueryRequest());
        Assert.Equal(PlanCodes.Plus, page.Items.Single().EffectivePlanCode);
    }

    [Fact]
    public async Task ListUsage_FiltersByFeatureAndUser()
    {
        using var db = new SqliteTestDatabase();
        var service = CreateService(db, out var context);
        var start = new DateOnly(2026, 7, 1);
        context.UsageBuckets.AddRange(
            new UsageBucket
            {
                UserId = SqliteTestDatabase.UserId, Feature = SubscriptionFeature.AiChat,
                PeriodStart = start, PeriodEnd = start.AddMonths(1).AddDays(-1),
                Used = 4, Reserved = 1, EffectiveLimit = 10,
            },
            new UsageBucket
            {
                UserId = SqliteTestDatabase.OtherUserId, Feature = SubscriptionFeature.AiWorkoutGeneration,
                PeriodStart = start, PeriodEnd = start.AddMonths(1).AddDays(-1),
                Used = 2, Reserved = 0, EffectiveLimit = 2,
            });
        await context.SaveChangesAsync();

        var byFeature = await service.ListUsageAsync(new UsageQueryRequest
        {
            Feature = SubscriptionFeature.AiChat,
            Period = start,
        });
        var byUser = await service.ListUsageAsync(new UsageQueryRequest
        {
            UserId = SqliteTestDatabase.OtherUserId,
            Period = start,
        });

        var chat = Assert.Single(byFeature.Items);
        Assert.Equal(4, chat.Used);
        Assert.Equal(1, chat.Reserved);
        Assert.Equal(SqliteTestDatabase.OtherUserId, Assert.Single(byUser.Items).UserId);
    }
}
```

- [ ] **Step 2: Run — expect FAIL**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter AdminSubscriptionServiceTests`

- [ ] **Step 3: Implement**

```csharp
using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.AdminSubscriptions;
using FitMate.Core.JsonModels.Common;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.Subscriptions;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.AdminSubscriptions;

public class AdminSubscriptionService : IAdminSubscriptionService
{
    private readonly AppDbContext dbContext;
    private readonly IEntitlementService entitlementService;

    public AdminSubscriptionService(AppDbContext dbContext, IEntitlementService entitlementService)
    {
        this.dbContext = dbContext;
        this.entitlementService = entitlementService;
    }

    public async Task<PagedResponse<UserSubscriptionAdminModel>> ListAsync(SubscriptionQueryRequest request)
    {
        var page = request.Page <= 0 ? 1 : request.Page;
        var pageSize = request.PageSize <= 0 ? 20 : Math.Min(request.PageSize, 100);
        var now = DateTime.UtcNow;

        var subscriptionUserIds = dbContext.UserSubscriptions.Select(s => s.UserId);
        var overrideUserIds = dbContext.UserPlanOverrides.Where(o => o.IsActive).Select(o => o.UserId);

        var query = dbContext.Users
            .AsNoTracking()
            .Where(u => subscriptionUserIds.Contains(u.Id) || overrideUserIds.Contains(u.Id));

        var email = request.Email?.Trim();
        if (!string.IsNullOrWhiteSpace(email))
        {
            query = query.Where(u => u.Email != null && u.Email.Contains(email));
        }

        if (request.HasOverride == true)
        {
            query = query.Where(u => overrideUserIds.Contains(u.Id));
        }

        if (request.Status.HasValue)
        {
            query = query.Where(u => dbContext.UserSubscriptions
                .Any(s => s.UserId == u.Id && s.Status == request.Status.Value));
        }

        var planCode = request.PlanCode?.Trim();
        if (!string.IsNullOrWhiteSpace(planCode))
        {
            query = query.Where(u =>
                dbContext.UserSubscriptions.Any(s => s.UserId == u.Id && s.Plan.Code == planCode)
                || dbContext.UserPlanOverrides.Any(o => o.UserId == u.Id && o.IsActive && o.Plan.Code == planCode));
        }

        var totalCount = await query.CountAsync();
        var userIds = await query
            .OrderBy(u => u.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => u.Id)
            .ToListAsync();

        var items = new List<UserSubscriptionAdminModel>(userIds.Count);
        foreach (var userId in userIds)
        {
            items.Add(await BuildModelAsync(userId, now));
        }

        return new PagedResponse<UserSubscriptionAdminModel>
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
        };
    }

    public async Task<UserSubscriptionAdminModel> AssignOverrideAsync(AssignPlanOverrideRequest request, long adminUserId)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            throw new FitMateException("A reason is required for a plan override.");
        }

        var plan = await dbContext.Plans.FirstOrDefaultAsync(p => p.Id == request.PlanId && p.IsActive)
            ?? throw new FitMateException("Plan not found or inactive.");

        var userExists = await dbContext.Users.AnyAsync(u => u.Id == request.UserId);
        if (!userExists)
        {
            throw new FitMateException("User not found.");
        }

        var now = DateTime.UtcNow;
        var previous = await BuildModelAsync(request.UserId, now);

        var existingOverrides = await dbContext.UserPlanOverrides
            .Where(o => o.UserId == request.UserId && o.IsActive)
            .ToListAsync();
        foreach (var existing in existingOverrides)
        {
            existing.IsActive = false;
            existing.EndsAt ??= now;
        }

        dbContext.UserPlanOverrides.Add(new UserPlanOverride
        {
            UserId = request.UserId,
            PlanId = plan.Id,
            CreatedByUserId = adminUserId,
            Reason = request.Reason.Trim(),
            PreviousPlanCode = previous.EffectivePlanCode,
            StartsAt = now,
            EndsAt = request.EndsAt,
            IsActive = true,
        });

        await dbContext.SaveChangesAsync();
        entitlementService.Invalidate(request.UserId);

        return await BuildModelAsync(request.UserId, DateTime.UtcNow);
    }

    public async Task<bool> RevokeOverrideAsync(long overrideId, long adminUserId)
    {
        var planOverride = await dbContext.UserPlanOverrides.FirstOrDefaultAsync(o => o.Id == overrideId);
        if (planOverride == null || !planOverride.IsActive)
        {
            return false;
        }

        planOverride.IsActive = false;
        planOverride.EndsAt ??= DateTime.UtcNow;
        await dbContext.SaveChangesAsync();
        entitlementService.Invalidate(planOverride.UserId);
        return true;
    }

    public async Task<PagedResponse<UserUsageAdminModel>> ListUsageAsync(UsageQueryRequest request)
    {
        var page = request.Page <= 0 ? 1 : request.Page;
        var pageSize = request.PageSize <= 0 ? 20 : Math.Min(request.PageSize, 100);

        var reference = request.Period ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var periodStart = new DateOnly(reference.Year, reference.Month, 1);
        var periodEnd = periodStart.AddMonths(1).AddDays(-1);

        var query = dbContext.UsageBuckets
            .AsNoTracking()
            .Where(b => b.PeriodStart == periodStart && b.PeriodEnd == periodEnd);

        if (request.UserId.HasValue)
        {
            query = query.Where(b => b.UserId == request.UserId.Value);
        }

        if (request.Feature.HasValue)
        {
            query = query.Where(b => b.Feature == request.Feature.Value);
        }

        var email = request.Email?.Trim();
        if (!string.IsNullOrWhiteSpace(email))
        {
            query = query.Where(b => dbContext.Users
                .Any(u => u.Id == b.UserId && u.Email != null && u.Email.Contains(email)));
        }

        var totalCount = await query.CountAsync();
        var items = await query
            .OrderBy(b => b.UserId).ThenBy(b => b.Feature)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(b => new UserUsageAdminModel
            {
                UserId = b.UserId,
                Email = dbContext.Users.Where(u => u.Id == b.UserId).Select(u => u.Email).FirstOrDefault(),
                Feature = b.Feature,
                PeriodStart = b.PeriodStart,
                PeriodEnd = b.PeriodEnd,
                Used = b.Used,
                Reserved = b.Reserved,
                EffectiveLimit = b.EffectiveLimit,
            })
            .ToListAsync();

        return new PagedResponse<UserUsageAdminModel>
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
        };
    }

    private async Task<UserSubscriptionAdminModel> BuildModelAsync(long userId, DateTime now)
    {
        var email = await dbContext.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => u.Email)
            .FirstOrDefaultAsync();

        var subscription = await dbContext.UserSubscriptions
            .AsNoTracking()
            .Include(s => s.Plan)
            .Where(s => s.UserId == userId)
            .OrderByDescending(s => s.DateCreated)
            .FirstOrDefaultAsync();

        var activeOverride = await dbContext.UserPlanOverrides
            .AsNoTracking()
            .Include(o => o.Plan)
            .Where(o => o.UserId == userId
                && o.IsActive
                && o.StartsAt <= now
                && (o.EndsAt == null || o.EndsAt > now))
            .OrderByDescending(o => o.StartsAt)
            .FirstOrDefaultAsync();

        var isSubscriptionActive = subscription is
            { Status: SubscriptionStatus.Active or SubscriptionStatus.Trialing };

        var (effectiveCode, source) = activeOverride != null
            ? (activeOverride.Plan.Code, EntitlementSource.AdminOverride)
            : isSubscriptionActive
                ? (subscription!.Plan.Code, EntitlementSource.Subscription)
                : (FitMate.DB.Constants.PlanCodes.Free, EntitlementSource.FreePlan);

        return new UserSubscriptionAdminModel
        {
            UserId = userId,
            Email = email,
            EffectivePlanCode = effectiveCode,
            EffectivePlanSource = source,
            SubscriptionId = subscription?.Id,
            SubscriptionPlanCode = subscription?.Plan.Code,
            Status = subscription?.Status,
            CurrentPeriodEnd = subscription?.CurrentPeriodEnd,
            CancelAtPeriodEnd = subscription?.CancelAtPeriodEnd ?? false,
            ActiveOverrideId = activeOverride?.Id,
            ActiveOverridePlanCode = activeOverride?.Plan.Code,
            ActiveOverrideReason = activeOverride?.Reason,
            ActiveOverrideEndsAt = activeOverride?.EndsAt,
        };
    }
}
```

> `BuildModelAsync` runs per user in the list loop — acceptable at a page size of ≤100, but if the admin
> list becomes slow, batch the three queries by `userIds` and join in memory. Note this in the commit.

- [ ] **Step 4: Run — expect PASS**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter AdminSubscriptionServiceTests`

- [ ] **Step 5: Commit**

```bash
git add server/FitMate.Core server/FitMate.Services server/FitMate.Tests
git commit -m "feat(admin-subscriptions): subscription list, plan overrides and usage inspection"
```

---

### Task 11: Subscription admin controllers + DI + integration tests

**Files:**
- Create: `server/FitMate.Web/Controllers/Admin/AdminSubscriptionPlanController.cs`, `AdminSubscriptionController.cs`, `AdminUsageController.cs`
- Modify: `server/FitMate.Web/Program.cs` (DI)
- Test: `server/FitMate.Tests/Integration/AdminSubscriptionApiTests.cs`

**Interfaces:**
- Produces (all `[AdminGuard]`, spec §58):

```text
GET    /api/admin/subscription-plans        → SubscriptionPlanAdminModel[]
GET    /api/admin/subscription-plans/{id}   → SubscriptionPlanAdminModel
POST   /api/admin/subscription-plans        → SubscriptionPlanAdminModel
PUT    /api/admin/subscription-plans/{id}   → SubscriptionPlanAdminModel
DELETE /api/admin/subscription-plans/{id}   → bool  (deactivates, never deletes)

GET    /api/admin/subscriptions             → PagedResponse<UserSubscriptionAdminModel>
POST   /api/admin/subscriptions/overrides   → UserSubscriptionAdminModel
DELETE /api/admin/subscriptions/overrides/{id} → bool

GET    /api/admin/usage                     → PagedResponse<UserUsageAdminModel>
```

- [ ] **Step 1: Write the controllers**

```csharp
using FitMate.Core.JsonModels.AdminSubscriptions;
using FitMate.DB;
using FitMate.Services.AdminSubscriptions;
using FitMate.Services.Users;
using FitMate.Web.Attributes;
using FitMate.Web.Controllers.Base;
using FitMate.Web.Extensions;
using Microsoft.AspNetCore.Mvc;

namespace FitMate.Web.Controllers.Admin;

[AdminGuard]
[Route("api/admin/subscription-plans")]
public class AdminSubscriptionPlanController : BaseApiController
{
    private readonly IAdminSubscriptionPlanService planService;

    public AdminSubscriptionPlanController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService,
        IAdminSubscriptionPlanService planService)
        : base(logger, dbContext, userService)
    {
        this.planService = planService;
    }

    [HttpGet]
    public async Task<ActionResult> List() => this.ReturnJson(await planService.ListAsync());

    [HttpGet("{id:long}")]
    public async Task<ActionResult> GetById(long id)
    {
        var plan = await planService.GetByIdAsync(id);
        return plan == null ? this.ReturnJsonError("Plan not found.") : this.ReturnJson(plan);
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] SavePlanRequest request) =>
        this.ReturnJson(await planService.CreateAsync(request));

    [HttpPut("{id:long}")]
    public async Task<ActionResult> Update(long id, [FromBody] SavePlanRequest request) =>
        this.ReturnJson(await planService.UpdateAsync(id, request));

    [HttpDelete("{id:long}")]
    public async Task<ActionResult> Deactivate(long id) =>
        this.ReturnJson(await planService.DeactivateAsync(id));
}
```

```csharp
using FitMate.Core.JsonModels.AdminSubscriptions;
using FitMate.DB;
using FitMate.Services.AdminSubscriptions;
using FitMate.Services.Users;
using FitMate.Web.Attributes;
using FitMate.Web.Controllers.Base;
using FitMate.Web.Extensions;
using Microsoft.AspNetCore.Mvc;

namespace FitMate.Web.Controllers.Admin;

[AdminGuard]
[Route("api/admin/subscriptions")]
public class AdminSubscriptionController : BaseApiController
{
    private readonly IAdminSubscriptionService subscriptionService;

    public AdminSubscriptionController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService,
        IAdminSubscriptionService subscriptionService)
        : base(logger, dbContext, userService)
    {
        this.subscriptionService = subscriptionService;
    }

    [HttpGet]
    public async Task<ActionResult> List([FromQuery] SubscriptionQueryRequest request) =>
        this.ReturnJson(await subscriptionService.ListAsync(request));

    [HttpPost("overrides")]
    public async Task<ActionResult> AssignOverride([FromBody] AssignPlanOverrideRequest request)
    {
        var adminUserId = UserService.LoggedInUserId;
        if (!adminUserId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        return this.ReturnJson(await subscriptionService.AssignOverrideAsync(request, adminUserId.Value));
    }

    [HttpDelete("overrides/{id:long}")]
    public async Task<ActionResult> RevokeOverride(long id)
    {
        var adminUserId = UserService.LoggedInUserId;
        if (!adminUserId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        return this.ReturnJson(await subscriptionService.RevokeOverrideAsync(id, adminUserId.Value));
    }
}
```

```csharp
using FitMate.Core.JsonModels.AdminSubscriptions;
using FitMate.DB;
using FitMate.Services.AdminSubscriptions;
using FitMate.Services.Users;
using FitMate.Web.Attributes;
using FitMate.Web.Controllers.Base;
using FitMate.Web.Extensions;
using Microsoft.AspNetCore.Mvc;

namespace FitMate.Web.Controllers.Admin;

[AdminGuard]
[Route("api/admin/usage")]
public class AdminUsageController : BaseApiController
{
    private readonly IAdminSubscriptionService subscriptionService;

    public AdminUsageController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService,
        IAdminSubscriptionService subscriptionService)
        : base(logger, dbContext, userService)
    {
        this.subscriptionService = subscriptionService;
    }

    [HttpGet]
    public async Task<ActionResult> List([FromQuery] UsageQueryRequest request) =>
        this.ReturnJson(await subscriptionService.ListUsageAsync(request));
}
```

- [ ] **Step 2: Register DI** — in `Program.cs`:

```csharp
builder.Services.AddScoped<IAdminSubscriptionPlanService, AdminSubscriptionPlanService>();
builder.Services.AddScoped<IAdminSubscriptionService, AdminSubscriptionService>();
```

- [ ] **Step 3: Write the integration tests**

```csharp
using System.Net;
using System.Net.Http.Json;
using FitMate.Core.JsonModels.AdminSubscriptions;
using FitMate.DB;
using FitMate.DB.Constants;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitMate.Tests.Integration;

public class AdminSubscriptionApiTests
{
    [Theory]
    [InlineData("/api/admin/subscription-plans")]
    [InlineData("/api/admin/subscriptions")]
    [InlineData("/api/admin/usage")]
    public async Task AdminSubscriptionEndpoints_AsNonAdmin_Return403(string url)
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateUserClientAsync("plain-user@test.local");

        var response = await client.GetAsync(url);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task ListPlans_AsAdmin_ReturnsSeededPlans()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateAdminClientAsync();

        var response = await client.GetAsync("/api/admin/subscription-plans");
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<List<SubscriptionPlanAdminModel>>>();

        Assert.True(body!.Success);
        Assert.Contains(body.Data!, plan => plan.Code == PlanCodes.Free);
    }

    [Fact]
    public async Task UpdatePlan_ChangesLimit()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateAdminClientAsync();

        var listResponse = await client.GetAsync("/api/admin/subscription-plans");
        var plans = await listResponse.Content.ReadFromJsonAsync<ApiResponse<List<SubscriptionPlanAdminModel>>>();
        var free = plans!.Data!.Single(p => p.Code == PlanCodes.Free);

        var request = new SavePlanRequest
        {
            Code = free.Code,
            Name = free.Name,
            Description = free.Description,
            IsActive = free.IsActive,
            IsPublic = free.IsPublic,
            SortOrder = free.SortOrder,
            Prices = [],
            Entitlements = free.Entitlements
                .Select(e => new PlanEntitlementRequest
                {
                    Feature = e.Feature,
                    IsEnabled = e.IsEnabled,
                    DailyLimit = e.DailyLimit,
                    MonthlyLimit = e.Feature == FitMate.DB.Enums.SubscriptionFeature.AiChat ? 25 : e.MonthlyLimit,
                    MaximumPerRequest = e.MaximumPerRequest,
                    SoftLimit = e.SoftLimit,
                    HardLimit = e.HardLimit,
                    ConfigurationJson = e.ConfigurationJson,
                })
                .ToList(),
        };

        var response = await client.PutAsJsonAsync($"/api/admin/subscription-plans/{free.Id}", request);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<SubscriptionPlanAdminModel>>();

        Assert.True(body!.Success);
        Assert.Equal(25, body.Data!.Entitlements
            .Single(e => e.Feature == FitMate.DB.Enums.SubscriptionFeature.AiChat).MonthlyLimit);
    }

    [Fact]
    public async Task AssignOverride_PersistsAndAppearsInList()
    {
        using var factory = new TestWebApplicationFactory();
        var adminClient = await factory.CreateAdminClientAsync();
        _ = await factory.CreateUserClientAsync("override-target@test.local");

        long userId;
        long proPlanId;
        using (var scope = factory.Services.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            userId = await context.Users.Where(u => u.Email == "override-target@test.local").Select(u => u.Id).SingleAsync();
            proPlanId = await context.Plans.Where(p => p.Code == PlanCodes.Pro).Select(p => p.Id).SingleAsync();
        }

        var response = await adminClient.PostAsJsonAsync("/api/admin/subscriptions/overrides", new AssignPlanOverrideRequest
        {
            UserId = userId,
            PlanId = proPlanId,
            Reason = "Support goodwill",
        });
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<UserSubscriptionAdminModel>>();

        Assert.True(body!.Success);
        Assert.Equal(PlanCodes.Pro, body.Data!.EffectivePlanCode);
    }
}
```

- [ ] **Step 4: Build, regenerate types, run tests**

Run: `dotnet build server/FitMate.Web/FitMate.Web.csproj`
Then: `cd client && npm run process-types && npx tsc -b --noEmit`
Then: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter AdminSubscriptionApiTests`

- [ ] **Step 5: Commit**

```bash
git add server/FitMate.Web server/FitMate.Tests client/src/types
git commit -m "feat(admin-subscriptions): admin plan, subscription and usage APIs"
```

---

### Task 12: Frontend admin service methods + type aliases

**Files:**
- Modify: `client/src/services/adminService.ts`
- Modify: `client/src/types/index.ts` (only if it re-exports named aliases — inspect first; generated
  models come from `backend.ts` automatically)

**Interfaces:**
- Consumes: generated types from Tasks 4–11 (`AiAdminOverviewModel`, `AiConversationListItemModel`,
  `AiConversationQueryRequest`, `AiConversationDetailModel`, `AiAdminRunModel`, `AiRunQueryRequest`,
  `UnsupportedAiRequestModel`, `UnsupportedRequestQueryRequest`, `UpdateUnsupportedRequestRequest`,
  `AiUsageSummaryAdminModel`, `AiCostSummaryModel`, `SubscriptionPlanAdminModel`, `SavePlanRequest`,
  `UserSubscriptionAdminModel`, `SubscriptionQueryRequest`, `AssignPlanOverrideRequest`,
  `UserUsageAdminModel`, `UsageQueryRequest`, `PagedResponse`).
- Produces: `adminService.ai`, `adminService.subscriptionPlans`, `adminService.subscriptions`,
  `adminService.usage` — nested objects matching the existing `adminService.users` / `.errors` style.

- [ ] **Step 1: Extend `adminService`** (add these nested objects; keep the existing ones untouched)

```typescript
  ai: {
    async overview(params: AiOverviewQueryRequest = {}) {
      return api.get<JsonData<AiAdminOverviewModel>>("admin/ai/overview", { params });
    },

    async conversations(params: AiConversationQueryRequest) {
      return api.get<JsonData<PagedResponse<AiConversationListItemModel>>>("admin/ai/conversations", {
        params,
      });
    },

    async conversation(id: number) {
      return api.get<JsonData<AiConversationDetailModel>>(`admin/ai/conversations/${id}`);
    },

    async runs(params: AiRunQueryRequest) {
      return api.get<JsonData<PagedResponse<AiAdminRunModel>>>("admin/ai/runs", { params });
    },

    async run(id: number) {
      return api.get<JsonData<AiAdminRunModel>>(`admin/ai/runs/${id}`);
    },

    async unsupportedRequests(params: UnsupportedRequestQueryRequest) {
      return api.get<JsonData<PagedResponse<UnsupportedAiRequestModel>>>(
        "admin/ai/unsupported-requests",
        { params },
      );
    },

    async unsupportedRequest(id: number) {
      return api.get<JsonData<UnsupportedAiRequestModel>>(`admin/ai/unsupported-requests/${id}`);
    },

    async updateUnsupportedRequest(id: number, payload: UpdateUnsupportedRequestRequest) {
      return api.put<JsonData<UnsupportedAiRequestModel>>(
        `admin/ai/unsupported-requests/${id}`,
        payload,
      );
    },

    async usage(params: AiOverviewQueryRequest = {}) {
      return api.get<JsonData<AiUsageSummaryAdminModel>>("admin/ai/usage", { params });
    },

    async costs(params: AiOverviewQueryRequest = {}) {
      return api.get<JsonData<AiCostSummaryModel>>("admin/ai/costs", { params });
    },
  },

  subscriptionPlans: {
    async list() {
      return api.get<JsonData<SubscriptionPlanAdminModel[]>>("admin/subscription-plans");
    },

    async getById(id: number) {
      return api.get<JsonData<SubscriptionPlanAdminModel>>(`admin/subscription-plans/${id}`);
    },

    async create(payload: SavePlanRequest) {
      return api.post<JsonData<SubscriptionPlanAdminModel>>("admin/subscription-plans", payload);
    },

    async update(id: number, payload: SavePlanRequest) {
      return api.put<JsonData<SubscriptionPlanAdminModel>>(`admin/subscription-plans/${id}`, payload);
    },

    async deactivate(id: number) {
      return api.delete<JsonData<boolean>>(`admin/subscription-plans/${id}`);
    },
  },

  subscriptions: {
    async list(params: SubscriptionQueryRequest) {
      return api.get<JsonData<PagedResponse<UserSubscriptionAdminModel>>>("admin/subscriptions", {
        params,
      });
    },

    async assignOverride(payload: AssignPlanOverrideRequest) {
      return api.post<JsonData<UserSubscriptionAdminModel>>("admin/subscriptions/overrides", payload);
    },

    async revokeOverride(id: number) {
      return api.delete<JsonData<boolean>>(`admin/subscriptions/overrides/${id}`);
    },
  },

  usage: {
    async list(params: UsageQueryRequest) {
      return api.get<JsonData<PagedResponse<UserUsageAdminModel>>>("admin/usage", { params });
    },
  },
```

Add every referenced type to the existing `import type { … } from "@/types";` block at the top of the file.

- [ ] **Step 2: Verify**

Run: `cd client && npm run lint && npx tsc -b --noEmit`
Expected: clean. If a type is missing, the backend build/`npm run process-types` from Task 8/11 was not
re-run — do that rather than hand-writing the interface.

- [ ] **Step 3: Commit**

```bash
git add client/src/services/adminService.ts client/src/types
git commit -m "feat(admin-ui): admin AI and subscription service methods"
```

---

### Task 13: AI overview dashboard page

**Files:**
- Create: `client/src/pages/AdminPanel/AiOverview/AiOverview.tsx`, `hooks/useAiOverviewPage.ts`, `index.ts`
- Modify: `client/src/pages/AdminPanel/index.ts`, `client/src/routes.tsx`, `client/src/pages/AdminPanel/AdminPanel.tsx`

**Interfaces:**
- Consumes: `adminService.ai.overview`, `AiAdminOverviewModel`.
- Produces: route `/management/ai` and an `AdminPanel` tile linking to it.

Renders (spec §54): stat tiles for total runs / today / this month / distinct users / successful /
failed / limit-exceeded / avg-P50-P95 duration / input+output tokens / estimated cost; tables for
top tools, most expensive users, cost by day, cost by plan and unsupported categories. **No chart
library is added** — the repo has none, so tables plus stat tiles only (spec §Global Constraints).
A range selector switches between 7 / 30 / 90 days.

- [ ] **Step 1: Write the hook** (`hooks/useAiOverviewPage.ts`)

```typescript
import { useCallback, useEffect, useState } from "react";
import { unwrap } from "@/lib/unwrap";
import { adminService } from "@/services/adminService";
import type { AiAdminOverviewModel } from "@/types";

const RANGE_OPTIONS = [7, 30, 90] as const;

export function useAiOverviewPage() {
  const [days, setDays] = useState<number>(30);
  const [overview, setOverview] = useState<AiAdminOverviewModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const from = new Date();
      from.setUTCDate(from.getUTCDate() - days);
      const response = await adminService.ai.overview({ from: from.toISOString() });
      setOverview(unwrap(response.data, "Unable to load the AI overview."));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load the AI overview.");
    } finally {
      setIsLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    state: { overview, isLoading, error, days, rangeOptions: RANGE_OPTIONS },
    actions: { setDays, reload: load },
  };
}
```

- [ ] **Step 2: Write the page** (`AiOverview.tsx`, styled with the repo's `liquid-*` classes like `ErrorGrid`)

```tsx
import { PageBody, PageHeader } from "@/shared/components";
import { useAiOverviewPage } from "./hooks/useAiOverviewPage";

const CURRENCY_FORMATTER = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 4,
});

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="liquid-pill rounded-2xl p-4">
      <p className="text-xs uppercase tracking-wide text-secondary">{label}</p>
      <p className="mt-1 text-2xl font-bold text-primary">{value}</p>
    </div>
  );
}

export default function AiOverview() {
  const { state, actions } = useAiOverviewPage();
  const { overview } = state;

  return (
    <>
      <PageHeader title="AI Overview" subtitle="Usage, reliability and cost of the AI coach." />

      <PageBody>
        <section className="liquid-surface w-full rounded-3xl p-5 md:p-6">
          <div className="mb-4 flex gap-2">
            {state.rangeOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => actions.setDays(option)}
                className={
                  option === state.days
                    ? "liquid-pill liquid-pill-active rounded-full px-4 py-2 text-sm font-semibold"
                    : "liquid-pill rounded-full px-4 py-2 text-sm"
                }
              >
                {option} days
              </button>
            ))}
          </div>

          {state.error && <p className="mb-4 text-sm text-danger">{state.error}</p>}
          {state.isLoading && <p className="text-sm text-secondary">Loading…</p>}

          {overview && (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatTile label="Runs (range)" value={overview.totalRuns.toLocaleString()} />
                <StatTile label="Runs today" value={overview.runsToday.toLocaleString()} />
                <StatTile label="Runs this month" value={overview.runsThisMonth.toLocaleString()} />
                <StatTile label="Distinct users" value={overview.distinctUsers.toLocaleString()} />
                <StatTile label="Successful" value={overview.successfulRuns.toLocaleString()} />
                <StatTile label="Failed" value={overview.failedRuns.toLocaleString()} />
                <StatTile label="Limit exceeded" value={overview.limitExceededRuns.toLocaleString()} />
                <StatTile label="Estimated cost" value={CURRENCY_FORMATTER.format(overview.estimatedCost)} />
                <StatTile label="Avg duration" value={`${overview.averageDurationMs} ms`} />
                <StatTile label="P50 duration" value={`${overview.p50DurationMs} ms`} />
                <StatTile label="P95 duration" value={`${overview.p95DurationMs} ms`} />
                <StatTile
                  label="Tokens (in / out)"
                  value={`${overview.inputTokens.toLocaleString()} / ${overview.outputTokens.toLocaleString()}`}
                />
              </div>

              <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div>
                  <h2 className="mb-2 text-sm font-semibold text-primary">Most used tools</h2>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-secondary">
                        <th className="py-1">Tool</th>
                        <th className="py-1">Calls</th>
                        <th className="py-1">Failures</th>
                        <th className="py-1">Avg ms</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.topTools.map((tool) => (
                        <tr key={tool.toolName}>
                          <td className="py-1">{tool.toolName}</td>
                          <td className="py-1">{tool.callCount}</td>
                          <td className="py-1">{tool.failureCount}</td>
                          <td className="py-1">{tool.averageDurationMs}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <h2 className="mb-2 text-sm font-semibold text-primary">Most expensive users</h2>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-secondary">
                        <th className="py-1">User</th>
                        <th className="py-1">Runs</th>
                        <th className="py-1">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.mostExpensiveUsers.map((user) => (
                        <tr key={user.userId}>
                          <td className="py-1">{user.email ?? user.userId}</td>
                          <td className="py-1">{user.runCount}</td>
                          <td className="py-1">{CURRENCY_FORMATTER.format(user.estimatedCost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <h2 className="mb-2 text-sm font-semibold text-primary">Cost by plan</h2>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-secondary">
                        <th className="py-1">Plan</th>
                        <th className="py-1">Runs</th>
                        <th className="py-1">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.costByPlan.map((plan) => (
                        <tr key={plan.planCode}>
                          <td className="py-1">{plan.planCode}</td>
                          <td className="py-1">{plan.runCount}</td>
                          <td className="py-1">{CURRENCY_FORMATTER.format(plan.estimatedCost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <h2 className="mb-2 text-sm font-semibold text-primary">Unsupported requests</h2>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-secondary">
                        <th className="py-1">Category</th>
                        <th className="py-1">Groups</th>
                        <th className="py-1">Reports</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.unsupportedCategories.map((category) => (
                        <tr key={category.category}>
                          <td className="py-1">{category.category}</td>
                          <td className="py-1">{category.groupCount}</td>
                          <td className="py-1">{category.occurrenceCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-6">
                <h2 className="mb-2 text-sm font-semibold text-primary">Cost by day</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-secondary">
                      <th className="py-1">Date</th>
                      <th className="py-1">Runs</th>
                      <th className="py-1">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.costByDay.map((day) => (
                      <tr key={String(day.date)}>
                        <td className="py-1">{String(day.date)}</td>
                        <td className="py-1">{day.runCount}</td>
                        <td className="py-1">{CURRENCY_FORMATTER.format(day.estimatedCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </PageBody>
    </>
  );
}
```

`index.ts`: `export { default } from "./AiOverview";`

> Verify `PageHeader`/`PageBody` import paths and the `liquid-pill-active` class name against
> `ErrorGrid.tsx` and the shared components barrel; use whatever those files actually use.

- [ ] **Step 3: Wire the route and tile**

In `client/src/pages/AdminPanel/index.ts` add `export { default as AiOverview } from "./AiOverview";`.
In `routes.tsx`, inside the `management` children array, add `{ path: "ai", element: <AiOverview /> }`
and extend the existing import. In `AdminPanel.tsx`, add to `gridLinks`:

```tsx
  {
    to: "/management/ai",
    title: "AI Overview",
    description: "AI usage, reliability, token spend and estimated cost.",
  },
```

- [ ] **Step 4: Verify**

Run: `cd client && npm run lint && npx tsc -b --noEmit`
Expected: clean. Manual: log in as admin, open `/management/ai`, switch the range selector.

- [ ] **Step 5: Commit**

```bash
git add client/src
git commit -m "feat(admin-ui): AI overview dashboard"
```

---

### Task 14: AI conversations grid, conversation detail and runs grid

**Files:**
- Create: `client/src/pages/AdminPanel/AiConversationsGrid/{AiConversationsGrid.tsx, columns.tsx, hooks/useAiConversationsPage.ts, index.ts}`
- Create: `client/src/pages/AdminPanel/AiConversationDetail/{AiConversationDetail.tsx, index.ts}`
- Create: `client/src/pages/AdminPanel/AiRunsGrid/{AiRunsGrid.tsx, columns.tsx, hooks/useAiRunsPage.ts, index.ts}`
- Modify: `client/src/pages/AdminPanel/index.ts`, `client/src/routes.tsx`, `AdminPanel.tsx`

**Interfaces:**
- Consumes: `adminService.ai.conversations/conversation/runs/run`.
- Produces: routes `/management/ai/conversations`, `/management/ai/conversations/:id`,
  `/management/ai/runs`.

Rules:
- Both grids use `EntityGrid` with **server-side pagination** exactly like `useErrorGridPage`
  (`paginationModel.page + 1` → `page`, `rowCount` from `totalCount`), `useDebouncedValue` for text
  filters and `unwrap` for the envelope.
- Conversation grid columns: last message (date), user email, title, messages, runs, cost, error flag,
  confirmed-mutation flag, view action → detail route.
- Conversation detail renders the full sequence in order (spec §55): user message, assistant tool call
  (tool name + redacted arguments), tool result (redacted), assistant response, actions, run rows with
  tokens/duration/cost/error. When `contentHiddenByUserPreference` is true, show a banner explaining
  the user opted out of admin content review.
- Runs grid columns: started at, user email, status, model, tokens, duration, cost, error code; row
  click opens a drawer/section showing the tool trace from `adminService.ai.run(id)`.

- [ ] **Step 1: Write `useAiConversationsPage`**

```typescript
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEventHandler } from "react";
import type { GridPaginationModel } from "@mui/x-data-grid";
import { useNavigate } from "react-router";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { unwrap } from "@/lib/unwrap";
import { adminService } from "@/services/adminService";
import type { AiConversationListItemModel, PagedResponse } from "@/types";
import { createAiConversationColumns } from "../columns";

export function useAiConversationsPage() {
  const navigate = useNavigate();
  const [emailInput, setEmailInput] = useState("");
  const debouncedEmail = useDebouncedValue(emailInput.trim());
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 25,
  });

  const [paged, setPaged] = useState<PagedResponse<AiConversationListItemModel> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRows() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await adminService.ai.conversations({
          page: paginationModel.page + 1,
          pageSize: paginationModel.pageSize,
          email: debouncedEmail || undefined,
          hasError: onlyErrors ? true : undefined,
        });
        setPaged(unwrap(response.data, "Unable to load conversations."));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load conversations.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadRows();
  }, [debouncedEmail, onlyErrors, paginationModel.page, paginationModel.pageSize]);

  const onView = useCallback(
    (conversation: AiConversationListItemModel) => {
      void navigate(`/management/ai/conversations/${conversation.id}`);
    },
    [navigate],
  );

  const columns = useMemo(() => createAiConversationColumns({ onView }), [onView]);

  const onEmailInputChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    setEmailInput(event.target.value);
    setPaginationModel((current) => ({ ...current, page: 0 }));
  };

  return {
    state: {
      rows: paged?.items ?? [],
      rowCount: paged?.totalCount ?? 0,
      columns,
      loading: isLoading,
      error,
      emailInput,
      onlyErrors,
      paginationModel,
    },
    actions: {
      onEmailInputChange,
      toggleOnlyErrors: () => {
        setOnlyErrors((current) => !current);
        setPaginationModel((current) => ({ ...current, page: 0 }));
      },
      changePagination: setPaginationModel,
    },
  };
}
```

- [ ] **Step 2: Write `columns.tsx` for the conversations grid**

```tsx
import type { GridColDef } from "@mui/x-data-grid";
import { LuEye } from "react-icons/lu";
import { normalizeUtcIsoString } from "@/lib/helpers";
import type { AiConversationListItemModel } from "@/types";

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const CURRENCY_FORMATTER = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 4,
});

function formatDateTime(value?: string | null): string {
  if (!value) {
    return "—";
  }

  const date = new Date(normalizeUtcIsoString(value));
  return Number.isNaN(date.getTime()) ? "—" : DATE_TIME_FORMATTER.format(date);
}

export function createAiConversationColumns({
  onView,
}: {
  onView: (conversation: AiConversationListItemModel) => void;
}): GridColDef<AiConversationListItemModel>[] {
  return [
    {
      field: "lastMessageAt",
      headerName: "Last message",
      minWidth: 150,
      sortable: false,
      valueGetter: (_value, row) => formatDateTime(row.lastMessageAt),
    },
    { field: "userEmail", headerName: "User", minWidth: 200, sortable: false },
    { field: "title", headerName: "Title", minWidth: 200, sortable: false },
    { field: "messageCount", headerName: "Msgs", width: 80, sortable: false },
    { field: "runCount", headerName: "Runs", width: 80, sortable: false },
    {
      field: "estimatedCost",
      headerName: "Cost",
      width: 110,
      sortable: false,
      valueGetter: (_value, row) => CURRENCY_FORMATTER.format(row.estimatedCost),
    },
    {
      field: "hasError",
      headerName: "Error",
      width: 80,
      sortable: false,
      valueGetter: (_value, row) => (row.hasError ? "Yes" : "—"),
    },
    {
      field: "hasConfirmedMutation",
      headerName: "Mutation",
      width: 100,
      sortable: false,
      valueGetter: (_value, row) => (row.hasConfirmedMutation ? "Yes" : "—"),
    },
    {
      field: "actions",
      headerName: "",
      width: 70,
      sortable: false,
      renderCell: (params) => (
        <button
          type="button"
          aria-label="View conversation"
          className="liquid-pill rounded-full p-2"
          onClick={() => onView(params.row)}
        >
          <LuEye />
        </button>
      ),
    },
  ];
}
```

- [ ] **Step 3: Write `AiConversationsGrid.tsx`** (mirror `ErrorGrid.tsx`: `PageHeader`, `PageBody`,
`liquid-surface` section, email input + "only errors" toggle, `EntityGrid` with
`rows/columns/loading/rowCount/paginationModel/onPaginationModelChange/getRowId`).

```tsx
import { PageBody, PageHeader } from "@/shared/components";
import { EntityGrid } from "@/shared/components/tables";
import { useAiConversationsPage } from "./hooks/useAiConversationsPage";

export default function AiConversationsGrid() {
  const { state, actions } = useAiConversationsPage();

  return (
    <>
      <PageHeader title="AI Conversations" subtitle="Every AI conversation with cost and status." />

      <PageBody>
        <section className="liquid-surface w-full rounded-3xl p-5 md:p-6">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
            <input
              value={state.emailInput}
              onChange={actions.onEmailInputChange}
              placeholder="Filter by user email"
              className="liquid-input w-full max-w-md rounded-full px-3 py-2.5"
            />
            <label className="flex items-center gap-2 text-sm text-secondary">
              <input type="checkbox" checked={state.onlyErrors} onChange={actions.toggleOnlyErrors} />
              Only conversations with errors
            </label>
          </div>

          {state.error && <p className="mb-4 text-sm text-danger">{state.error}</p>}

          <EntityGrid
            rows={state.rows}
            columns={state.columns}
            loading={state.loading}
            rowCount={state.rowCount}
            paginationModel={state.paginationModel}
            onPaginationModelChange={actions.changePagination}
            getRowId={(row) => row.id}
          />
        </section>
      </PageBody>
    </>
  );
}
```

- [ ] **Step 4: Write `AiConversationDetail.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { PageBody, PageHeader } from "@/shared/components";
import { unwrap } from "@/lib/unwrap";
import { adminService } from "@/services/adminService";
import { AiMessageRole, type AiConversationDetailModel } from "@/types";

const ROLE_LABELS: Record<number, string> = {
  [AiMessageRole.User]: "User",
  [AiMessageRole.Assistant]: "Assistant",
  [AiMessageRole.ToolCall]: "Tool call",
  [AiMessageRole.ToolResult]: "Tool result",
  [AiMessageRole.System]: "System",
};

export default function AiConversationDetail() {
  const { id } = useParams();
  const [detail, setDetail] = useState<AiConversationDetailModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!id) {
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const response = await adminService.ai.conversation(Number(id));
        setDetail(unwrap(response.data, "Unable to load the conversation."));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load the conversation.");
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, [id]);

  return (
    <>
      <PageHeader
        title={detail?.title ?? "Conversation"}
        subtitle={detail?.userEmail ?? "AI conversation trace"}
      />

      <PageBody>
        <section className="liquid-surface w-full rounded-3xl p-5 md:p-6">
          {isLoading && <p className="text-sm text-secondary">Loading…</p>}
          {error && <p className="text-sm text-danger">{error}</p>}

          {detail?.contentHiddenByUserPreference && (
            <p className="mb-4 rounded-2xl bg-amber-100 p-3 text-sm text-amber-900">
              This user disabled admin content review. Message bodies and tool payloads are hidden;
              metadata is still shown.
            </p>
          )}

          {detail && (
            <>
              <ol className="space-y-3">
                {detail.messages.map((message) => (
                  <li key={message.id} className="liquid-pill rounded-2xl p-3">
                    <p className="text-xs uppercase tracking-wide text-secondary">
                      {ROLE_LABELS[message.role] ?? message.role}
                      {message.toolName ? ` · ${message.toolName}` : ""}
                    </p>
                    <pre className="mt-1 whitespace-pre-wrap break-words text-sm">{message.content}</pre>
                  </li>
                ))}
              </ol>

              <h2 className="mt-6 mb-2 text-sm font-semibold text-primary">Tool executions</h2>
              <ul className="space-y-2">
                {detail.toolExecutions.map((execution) => (
                  <li key={execution.id} className="liquid-pill rounded-2xl p-3 text-sm">
                    <p className="font-semibold">
                      {execution.toolName} · {execution.status} · {execution.durationMilliseconds} ms
                    </p>
                    <pre className="mt-1 whitespace-pre-wrap break-words text-xs">
                      {execution.argumentsJson}
                    </pre>
                    {execution.resultJson && (
                      <pre className="mt-1 whitespace-pre-wrap break-words text-xs text-secondary">
                        {execution.resultJson}
                      </pre>
                    )}
                    {execution.errorMessage && (
                      <p className="mt-1 text-xs text-danger">{execution.errorMessage}</p>
                    )}
                  </li>
                ))}
              </ul>

              <h2 className="mt-6 mb-2 text-sm font-semibold text-primary">Runs</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-secondary">
                    <th className="py-1">Status</th>
                    <th className="py-1">Model</th>
                    <th className="py-1">Tokens</th>
                    <th className="py-1">Duration</th>
                    <th className="py-1">Cost</th>
                    <th className="py-1">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.runs.map((run) => (
                    <tr key={run.id}>
                      <td className="py-1">{run.status}</td>
                      <td className="py-1">{run.model}</td>
                      <td className="py-1">
                        {run.inputTokens} / {run.outputTokens}
                      </td>
                      <td className="py-1">{run.durationMilliseconds} ms</td>
                      <td className="py-1">{run.estimatedCost ?? "—"}</td>
                      <td className="py-1">{run.errorCode ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {detail.actions.length > 0 && (
                <>
                  <h2 className="mt-6 mb-2 text-sm font-semibold text-primary">Actions</h2>
                  <ul className="space-y-1 text-sm">
                    {detail.actions.map((action) => (
                      <li key={action.id}>
                        {action.actionType} · {action.status}
                        {action.executedAt ? ` · executed ${action.executedAt}` : ""}
                        {action.failureReason ? ` · ${action.failureReason}` : ""}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </section>
      </PageBody>
    </>
  );
}
```

- [ ] **Step 5: Write the runs grid** — `useAiRunsPage.ts` mirrors `useAiConversationsPage` but calls
`adminService.ai.runs` with `status`/`model` filters; `columns.tsx` shows started-at, user email,
status, model, tokens, duration, cost, error code and a view button that loads
`adminService.ai.run(id)` into a detail panel listing the tool trace (redacted). Register
`/management/ai/runs`.

- [ ] **Step 6: Wire routes, exports and tiles** — add three exports to
`client/src/pages/AdminPanel/index.ts`, three route entries under `management`
(`ai/conversations`, `ai/conversations/:id`, `ai/runs`), and two `AdminPanel.tsx` tiles
("AI Conversations", "AI Runs").

- [ ] **Step 7: Verify**

Run: `cd client && npm run lint && npx tsc -b --noEmit`
Expected: clean. Manual: open a conversation with a tool call and confirm arguments are redacted.

- [ ] **Step 8: Commit**

```bash
git add client/src
git commit -m "feat(admin-ui): AI conversations, detail viewer and runs grid"
```

---

### Task 15: Unsupported requests grid with inline triage

**Files:**
- Create: `client/src/pages/AdminPanel/UnsupportedRequestsGrid/{UnsupportedRequestsGrid.tsx, columns.tsx, hooks/useUnsupportedRequestsPage.ts, components/UnsupportedRequestEditorModal.tsx, index.ts}`
- Modify: `client/src/pages/AdminPanel/index.ts`, `client/src/routes.tsx`, `AdminPanel.tsx`

**Interfaces:**
- Consumes: `adminService.ai.unsupportedRequests`, `.unsupportedRequest`, `.updateUnsupportedRequest`.
- Produces: route `/management/ai/unsupported-requests`.

Columns (spec §57): requested functionality, category, unique users, total requests, first requested,
last requested, status, edit action. Filters: search, category, status; sort selector
(last / count / first). The editor modal shows the group's example occurrences (from the detail
endpoint) and edits status, admin notes, external tracking URL and key.

- [ ] **Step 1: Write the hook**

```typescript
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEventHandler } from "react";
import type { GridPaginationModel } from "@mui/x-data-grid";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { unwrap } from "@/lib/unwrap";
import { adminService } from "@/services/adminService";
import {
  UnsupportedRequestStatus,
  type PagedResponse,
  type UnsupportedAiRequestModel,
  type UpdateUnsupportedRequestRequest,
} from "@/types";
import { createUnsupportedRequestColumns } from "../columns";

export function useUnsupportedRequestsPage() {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput.trim());
  const [status, setStatus] = useState<UnsupportedRequestStatus | "">("");
  const [sortBy, setSortBy] = useState<"last" | "count" | "first">("last");
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 25,
  });

  const [paged, setPaged] = useState<PagedResponse<UnsupportedAiRequestModel> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadIndex, setReloadIndex] = useState(0);
  const [editing, setEditing] = useState<UnsupportedAiRequestModel | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadRows() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await adminService.ai.unsupportedRequests({
          page: paginationModel.page + 1,
          pageSize: paginationModel.pageSize,
          search: debouncedSearch || undefined,
          status: status === "" ? undefined : status,
          sortBy,
        });
        setPaged(unwrap(response.data, "Unable to load unsupported requests."));
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : "Unable to load unsupported requests.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadRows();
  }, [debouncedSearch, paginationModel.page, paginationModel.pageSize, reloadIndex, sortBy, status]);

  const openEditor = useCallback(async (row: UnsupportedAiRequestModel) => {
    try {
      const response = await adminService.ai.unsupportedRequest(row.id);
      setEditing(unwrap(response.data, "Unable to load the request."));
    } catch {
      setEditing(row);   // fall back to the grid row without occurrences
    }
  }, []);

  const save = useCallback(
    async (payload: UpdateUnsupportedRequestRequest) => {
      if (!editing) {
        return;
      }

      setIsSaving(true);
      try {
        await adminService.ai.updateUnsupportedRequest(editing.id, payload);
        setEditing(null);
        setReloadIndex((current) => current + 1);
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Unable to save the request.");
      } finally {
        setIsSaving(false);
      }
    },
    [editing],
  );

  const columns = useMemo(
    () => createUnsupportedRequestColumns({ onEdit: (row) => void openEditor(row) }),
    [openEditor],
  );

  const onSearchInputChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    setSearchInput(event.target.value);
    setPaginationModel((current) => ({ ...current, page: 0 }));
  };

  return {
    state: {
      rows: paged?.items ?? [],
      rowCount: paged?.totalCount ?? 0,
      columns,
      loading: isLoading,
      error,
      searchInput,
      status,
      sortBy,
      paginationModel,
      editing,
      isSaving,
    },
    actions: {
      onSearchInputChange,
      setStatus,
      setSortBy,
      changePagination: setPaginationModel,
      closeEditor: () => setEditing(null),
      save,
    },
  };
}
```

- [ ] **Step 2: Write `columns.tsx`**

```tsx
import type { GridColDef } from "@mui/x-data-grid";
import { LuPencil } from "react-icons/lu";
import { normalizeUtcIsoString } from "@/lib/helpers";
import { UnsupportedRequestStatus, type UnsupportedAiRequestModel } from "@/types";

const STATUS_LABELS: Record<number, string> = {
  [UnsupportedRequestStatus.New]: "New",
  [UnsupportedRequestStatus.Reviewed]: "Reviewed",
  [UnsupportedRequestStatus.Planned]: "Planned",
  [UnsupportedRequestStatus.Implemented]: "Implemented",
  [UnsupportedRequestStatus.Rejected]: "Rejected",
};

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDate(value?: string | null): string {
  if (!value) {
    return "—";
  }

  const date = new Date(normalizeUtcIsoString(value));
  return Number.isNaN(date.getTime()) ? "—" : DATE_FORMATTER.format(date);
}

export function createUnsupportedRequestColumns({
  onEdit,
}: {
  onEdit: (row: UnsupportedAiRequestModel) => void;
}): GridColDef<UnsupportedAiRequestModel>[] {
  return [
    { field: "requestedFunctionality", headerName: "Requested functionality", minWidth: 280, sortable: false },
    { field: "category", headerName: "Category", minWidth: 120, sortable: false },
    { field: "uniqueUserCount", headerName: "Users", width: 90, sortable: false },
    { field: "occurrenceCount", headerName: "Requests", width: 100, sortable: false },
    {
      field: "firstRequestedAt",
      headerName: "First",
      minWidth: 130,
      sortable: false,
      valueGetter: (_value, row) => formatDate(row.firstRequestedAt),
    },
    {
      field: "lastRequestedAt",
      headerName: "Last",
      minWidth: 130,
      sortable: false,
      valueGetter: (_value, row) => formatDate(row.lastRequestedAt),
    },
    {
      field: "status",
      headerName: "Status",
      width: 120,
      sortable: false,
      valueGetter: (_value, row) => STATUS_LABELS[row.status] ?? row.status,
    },
    {
      field: "actions",
      headerName: "",
      width: 70,
      sortable: false,
      renderCell: (params) => (
        <button
          type="button"
          aria-label="Edit request"
          className="liquid-pill rounded-full p-2"
          onClick={() => onEdit(params.row)}
        >
          <LuPencil />
        </button>
      ),
    },
  ];
}
```

- [ ] **Step 3: Write the editor modal** (`components/UnsupportedRequestEditorModal.tsx`) — a controlled
form over `status`, `adminNotes`, `externalTrackingUrl`, `externalTrackingKey`, plus a read-only list of
`recentOccurrences` (user email, conversation id, date). Follow the structure of the existing
`ErrorDetailModal` in `AdminPanel/ErrorGrid/components` for markup, overlay and close behavior.

- [ ] **Step 4: Write the page** — same shell as `AiConversationsGrid`, with search input, status
`<select>`, sort `<select>`, `EntityGrid`, and the editor modal rendered when `state.editing` is set.

- [ ] **Step 5: Wire route, export and tile** — `/management/ai/unsupported-requests`,
`export { default as UnsupportedRequestsGrid } from "./UnsupportedRequestsGrid";`, and an
`AdminPanel.tsx` tile ("Unsupported Requests — what users asked for that FitMate cannot do yet").

- [ ] **Step 6: Verify**

Run: `cd client && npm run lint && npx tsc -b --noEmit`
Expected: clean. Manual: change a status and confirm the grid refreshes with the new value.

- [ ] **Step 7: Commit**

```bash
git add client/src
git commit -m "feat(admin-ui): unsupported request backlog grid with triage editor"
```

---

### Task 16: Subscription admin pages (plans, subscriptions, usage)

**Files:**
- Create: `client/src/pages/AdminPanel/SubscriptionPlansGrid/{SubscriptionPlansGrid.tsx, columns.tsx, hooks/useSubscriptionPlansPage.ts, components/PlanEditorModal.tsx, index.ts}`
- Create: `client/src/pages/AdminPanel/SubscriptionsGrid/{SubscriptionsGrid.tsx, columns.tsx, hooks/useSubscriptionsPage.ts, components/OverrideDialog.tsx, index.ts}`
- Create: `client/src/pages/AdminPanel/UsageGrid/{UsageGrid.tsx, columns.tsx, hooks/useUsagePage.ts, index.ts}`
- Modify: `client/src/pages/AdminPanel/index.ts`, `client/src/routes.tsx`, `AdminPanel.tsx`

**Interfaces:**
- Consumes: `adminService.subscriptionPlans`, `adminService.subscriptions`, `adminService.usage`.
- Produces: routes `/management/subscription-plans`, `/management/subscriptions`, `/management/usage`.

Rules:
- **Plans grid** is not paginated (there are only a handful of plans) — `adminService.subscriptionPlans.list()`
  straight into `EntityGrid` with `rowCount = rows.length`. Columns: code, name, active, public, sort
  order, subscriber count, monthly price, edit action.
- **Plan editor modal** (spec §58): name, code (disabled when `isCodeLocked`, with a tooltip explaining
  why), description, public visibility, active state, sort order, monthly + yearly price rows with
  Stripe price IDs, and one row per `SubscriptionFeature` with enabled toggle and daily / monthly /
  max-per-request / soft / hard limit inputs plus a JSON configuration textarea. Empty limit input =
  `null` = unlimited (label it). Submitting posts the whole `SavePlanRequest`.
- **Subscriptions grid**: server-paginated; columns user email, effective plan, source, subscription
  plan, status, period end, cancel-at-period-end, active override; actions "Assign override" (dialog
  with plan select, reason textarea, optional end date) and "Revoke override" when one is active.
- **Usage grid**: server-paginated; filters user email, feature select, month picker; columns user,
  feature, period, used, reserved, effective limit, remaining (computed as
  `limit == null ? "Unlimited" : Math.max(0, limit - used - reserved)`).

- [ ] **Step 1: Write the plans hook + grid + editor modal**

```typescript
import { useCallback, useEffect, useMemo, useState } from "react";
import { unwrap } from "@/lib/unwrap";
import { adminService } from "@/services/adminService";
import type { SavePlanRequest, SubscriptionPlanAdminModel } from "@/types";
import { createSubscriptionPlanColumns } from "../columns";

export function useSubscriptionPlansPage() {
  const [plans, setPlans] = useState<SubscriptionPlanAdminModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<SubscriptionPlanAdminModel | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [reloadIndex, setReloadIndex] = useState(0);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await adminService.subscriptionPlans.list();
        setPlans(unwrap(response.data, "Unable to load plans."));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load plans.");
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, [reloadIndex]);

  const save = useCallback(
    async (payload: SavePlanRequest) => {
      if (!editing) {
        return;
      }

      setIsSaving(true);
      try {
        await adminService.subscriptionPlans.update(editing.id, payload);
        setEditing(null);
        setReloadIndex((current) => current + 1);
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Unable to save the plan.");
      } finally {
        setIsSaving(false);
      }
    },
    [editing],
  );

  const columns = useMemo(
    () => createSubscriptionPlanColumns({ onEdit: setEditing }),
    [],
  );

  return {
    state: { rows: plans, columns, loading: isLoading, error, editing, isSaving },
    actions: { closeEditor: () => setEditing(null), save },
  };
}
```

The editor modal builds its initial `SavePlanRequest` from the selected model:

```typescript
function toRequest(plan: SubscriptionPlanAdminModel): SavePlanRequest {
  return {
    code: plan.code,
    name: plan.name,
    description: plan.description,
    isActive: plan.isActive,
    isPublic: plan.isPublic,
    sortOrder: plan.sortOrder,
    prices: plan.prices.map((price) => ({
      id: price.id,
      currency: price.currency,
      amount: price.amount,
      billingInterval: price.billingInterval,
      stripePriceId: price.stripePriceId,
      isActive: price.isActive,
    })),
    entitlements: plan.entitlements.map((entitlement) => ({
      feature: entitlement.feature,
      isEnabled: entitlement.isEnabled,
      dailyLimit: entitlement.dailyLimit,
      monthlyLimit: entitlement.monthlyLimit,
      maximumPerRequest: entitlement.maximumPerRequest,
      softLimit: entitlement.softLimit,
      hardLimit: entitlement.hardLimit,
      configurationJson: entitlement.configurationJson,
    })),
  };
}
```

Empty numeric inputs must map to `null`, not `0`:

```typescript
function parseLimit(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
```

- [ ] **Step 2: Write the subscriptions hook + grid + override dialog** — server pagination exactly like
`useAiConversationsPage`; the dialog calls `adminService.subscriptions.assignOverride({ userId, planId, reason, endsAt })`
and the revoke button calls `adminService.subscriptions.revokeOverride(activeOverrideId)`. Both refresh
the grid on success and surface the API error message on failure (the backend rejects an empty reason).

- [ ] **Step 3: Write the usage hook + grid** — server pagination, filters (email, feature select from
the generated `SubscriptionFeature` enum, month input), remaining column computed client-side.

- [ ] **Step 4: Wire routes, exports and tiles** — three exports in
`client/src/pages/AdminPanel/index.ts`, three route entries under `management`
(`subscription-plans`, `subscriptions`, `usage`), and three `AdminPanel.tsx` tiles.

- [ ] **Step 5: Verify**

Run: `cd client && npm run lint && npx tsc -b --noEmit`
Expected: clean.

Manual QA checklist (no frontend test framework exists in this repo — do not add one):
1. `/management/ai` loads with the 30-day range and switches to 7 and 90 days.
2. `/management/ai/conversations` paginates and filters by email; the row action opens the detail page.
3. A conversation containing a tool call shows redacted arguments; a user with admin-review disabled
   shows the amber banner and hidden bodies.
4. `/management/ai/runs` filters by status and shows a tool trace.
5. `/management/ai/unsupported-requests` sorts by request count, and saving a status change persists
   after a reload.
6. `/management/subscription-plans` opens the Free plan editor; the code field is disabled when the plan
   has subscribers; clearing a limit saves as "Unlimited"; a negative limit shows the API error.
7. `/management/subscriptions` assigns an override (reason required) and revokes it; the effective plan
   column changes both times.
8. `/management/usage` filters by feature and month.

- [ ] **Step 6: Commit**

```bash
git add client/src
git commit -m "feat(admin-ui): subscription plan editor, subscriptions and usage grids"
```

---

## Acceptance criteria (Plan 08 done)

- The AI reports unsupported functionality through `report_unsupported_request`; similar phrasings
  collapse into one `(Category, NormalizedKey)` group with an incrementing `OccurrenceCount` and an
  occurrence row per report, and admin triage status is never reset by new reports.
- Administrators can see, for any conversation: what the user asked, what the assistant answered, which
  tools ran with their arguments and results, which actions were proposed and executed, token usage,
  estimated cost, errors, duration and the user's subscription plan (spec §Phase 7 acceptance).
- Every admin endpoint returns 401 without a token and 403 for non-admins (integration-tested).
- Conversation and run **list** endpoints never load message bodies; every list is paginated with a
  maximum page size of 100.
- Stored secrets stay redacted on read: a seeded JWT in a message body is not returned by the admin
  detail endpoint.
- `UserAiPreferences.AllowAdminContentReview == false` hides content while preserving metadata.
- Plan codes cannot change once subscriptions reference them; plans deactivate rather than delete;
  built-in `free`/`plus`/`pro` cannot be deactivated.
- Admin plan overrides record who, why, the previous plan and an optional expiry, never mutate the
  Stripe-controlled `UserSubscription`, and invalidate the entitlement cache.
- `dotnet build server/FitMate.sln` + `dotnet test server/FitMate.sln` green; `npm run lint` and
  `npx tsc -b --noEmit` clean; the manual QA checklist in Task 16 passes.

## Handoff notes for later plans

- **Plan 09** (Stripe) populates `UserSubscription` and `PlanPrice.StripePriceId`; the plan editor here
  is where those Stripe price IDs are entered, so run Plan 09's checkout only after the IDs are filled in.
- **Plan 11** adds retention jobs that purge `AiConversation`/`AiMessage` rows; `UnsupportedAiRequest`
  and its occurrences must survive those purges (no FKs — Task 1), and the admin dashboards must keep
  working when a referenced conversation no longer exists (the detail endpoint returns an error
  envelope, which the UI already surfaces).
