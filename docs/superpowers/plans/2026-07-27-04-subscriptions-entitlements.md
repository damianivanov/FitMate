# Subscription Plans, Entitlements and Usage Limits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every gated capability (AI features, active program plans, program duration, custom templates, exercise history) is driven by database-stored plan entitlements with concurrency-safe monthly usage limits, so Free/Plus/Pro behave differently without a single hardcoded limit in service code.

**Architecture:** `Plan` → `PlanPrice` / `PlanEntitlement` describe what a tier grants. A user's effective plan resolves in priority order: active `UserPlanOverride` → active `UserSubscription` → the seeded `free` plan. `EntitlementService` answers "is this allowed / how much is left" (cached briefly, explicitly invalidatable by Plan 09's Stripe webhook). `UsageService` implements the reserve → commit/release pattern against a per-user-per-feature-per-month `UsageBucket` guarded by a concurrency token, so two simultaneous requests can never both exceed a limit. Existing services (program plans, workout templates, exercise history) call into these instead of using constants.

**Tech Stack:** .NET 9, EF Core + Npgsql (Sqlite in tests), `IMemoryCache`, xUnit, Reinforced.Typings type export, React 19 + TypeScript.

## Global Constraints

- Follow repo conventions (roadmap D4): services take `(…, long userId)` and **no CancellationToken**; controllers extend `BaseApiController` and return `this.ReturnJson(...)`; DTOs live in `server/FitMate.Core/JsonModels/Subscriptions/`; entities in `server/FitMate.DB/Entities`; enums in `server/FitMate.DB/Enums`; configurations in `server/FitMate.DB/Configurations` (auto-discovered by `modelBuilder.ApplyConfigurationsFromAssembly` — no registration needed).
- Business failures throw `FitMateException` (or a subclass) — `LogApiErrorAttribute` maps it to a 400 error envelope today; this plan extends that filter with 403/429 for the two subscription exceptions (Task 2). Never add a second error pipeline.
- **No hardcoded limits anywhere in services** (spec §43). Every number comes from `PlanEntitlement` rows seeded by Task 3 and editable by Plan 08's admin UI.
- `null` limit means **unlimited**; `IsEnabled == false` means the feature is not in the plan at all (403, not 429).
- Usage periods are **calendar months in UTC**: `PeriodStart` = first day of the month, `PeriodEnd` = last day of the month, `ResetsAt` = `PeriodEnd.AddDays(1)` at 00:00 UTC.
- Sqlite (tests) and Postgres (prod) must both work: use an explicit `int Version` concurrency token (NOT Postgres `xmin`), and never `Sum`/`OrderBy` a `decimal` in a translated query.
- `AppDbContext.SaveChangesAsync()` stamps `DateCreated`/`DateModified` — never set them manually.
- After DTO changes: `dotnet build server/FitMate.Web/FitMate.Web.csproj` regenerates `client/src/types/backend.ts`, then `npm run process-types` in `client/`. **Never hand-write TS interfaces for API models.**
- Backend commands: `dotnet build server/FitMate.sln`, `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter <Name>`. Frontend: `cd client && npm run lint && npx tsc -b --noEmit`.
- All commands run from repo root `c:\Users\damian\Documents\Github\FitMate`.
- This plan depends on **Plan 01** (`ProgramPlanService.ActivateAsync` exists with the hard one-active rule to replace). It does **not** depend on Plans 05–11; `UserSubscription` is created here but only populated by Plan 09.

## File Structure

```
server/FitMate.DB/
├── Enums/SubscriptionFeature.cs, SubscriptionStatus.cs, BillingInterval.cs,
│         UsageEntryType.cs, UsageReservationStatus.cs, EntitlementSource.cs   (Task 1)
├── Entities/Plan.cs, PlanPrice.cs, PlanEntitlement.cs, UserSubscription.cs,
│         UserPlanOverride.cs, UsageBucket.cs, UsageEntry.cs,
│         UsageReservation.cs                                                  (Task 1)
├── Configurations/PlanConfiguration.cs, PlanPriceConfiguration.cs,
│         PlanEntitlementConfiguration.cs, UserSubscriptionConfiguration.cs,
│         UserPlanOverrideConfiguration.cs, UsageBucketConfiguration.cs,
│         UsageEntryConfiguration.cs, UsageReservationConfiguration.cs         (Task 1)
├── Constants/PlanCodes.cs                                                     (Task 3)
├── AppDbContext.cs (modify: 8 DbSets)                                         (Task 1)
└── Migrations/xxx_AddSubscriptionPlans.cs, xxx_AddUsageTracking.cs (generated) (Task 1)

server/FitMate.Core/
├── Exceptions/SubscriptionFeatureDisabledException.cs,
│              SubscriptionLimitExceededException.cs                           (Task 2)
└── JsonModels/Subscriptions/FeatureAvailabilityModel.cs,
      EffectiveEntitlementsModel.cs, SubscriptionLimitErrorModel.cs,
      CurrentSubscriptionModel.cs, SubscriptionPlanModel.cs,
      SubscriptionPlanPriceModel.cs, UsageReservationModel.cs                  (Tasks 2, 4)

server/FitMate.Services/Subscriptions/
├── IEntitlementService.cs, EntitlementService.cs                              (Task 5)
├── IUsageService.cs, UsageService.cs                                          (Task 6)
├── UsagePeriod.cs                                                             (Task 6)
└── SubscriptionMapper.cs                                                      (Task 4)

server/FitMate.Web/
├── Attributes/LogApiErrorAttribute.cs (modify: 403/429 mapping)               (Task 2)
├── Infrastructure/ApplicationBuilder.cs (modify: SeedPlans)                   (Task 3)
├── SeedData/plans.json                                                        (Task 3)
├── Controllers/SubscriptionController.cs                                      (Task 9)
└── Program.cs (modify: DI)                                                    (Task 9)

server/FitMate.Services/ (modified consumers)
├── ProgramPlans/ProgramPlanService.cs (active-plan + duration entitlements)   (Task 7)
├── WorkoutTemplates/WorkoutTemplateService.cs (template count limit)          (Task 8)
└── Workouts/WorkoutService.cs (exercise-history month clamp)                  (Task 8)

server/FitMate.Tests/
├── TestInfrastructure/SqliteTestDatabase.cs (modify: SeedPlans helper)        (Task 3)
├── Unit/Services/EntitlementServiceTests.cs                                   (Task 5)
├── Unit/Services/UsageServiceTests.cs                                         (Task 6)
├── Unit/Services/SubscriptionLimitIntegrationTests.cs                         (Tasks 7–8)
└── Integration/SubscriptionApiTests.cs                                        (Task 11)

client/src/
├── services/subscriptionService.ts                                            (Task 10)
├── pages/Subscription/{Subscription.tsx, components/UsageBar.tsx,
│     hooks/useSubscriptionPage.ts, index.ts}                                  (Task 10)
└── routes.tsx (modify: /subscription, /subscription/usage)                    (Task 10)
```

---

### Task 1: Enums, entities, EF configuration, migrations

**Files:**
- Create: the six enum files and eight entity files listed in File Structure
- Create: the eight configuration files
- Modify: `server/FitMate.DB/AppDbContext.cs`
- Test: existing `AppDbContextTests` must still pass (`EnsureCreated` validates the model)

**Interfaces:**
- Consumes: `BaseEntity`, `User`.
- Produces: all entity/enum names below. Every later task and Plans 05–10 use these exact names.

- [ ] **Step 1: Write the enums** (namespace `FitMate.DB.Enums`, one file each)

```csharp
namespace FitMate.DB.Enums;

public enum SubscriptionFeature
{
    AiChat = 1,
    AiWorkoutGeneration = 2,
    AiProgramGeneration = 3,
    AiExerciseRecognition = 4,
    AiImageGeneration = 5,
    AiTrainingAnalysis = 6,

    ActiveProgramPlans = 20,
    ProgramPlanDurationMonths = 21,
    CustomWorkoutTemplates = 22,
    ExerciseHistoryMonths = 23,
}

public enum SubscriptionStatus
{
    Trialing = 1,
    Active = 2,
    PastDue = 3,
    Cancelled = 4,
    Unpaid = 5,
    Incomplete = 6,
    IncompleteExpired = 7,
    Paused = 8,
}

public enum BillingInterval
{
    Monthly = 1,
    Yearly = 2,
}

public enum UsageEntryType
{
    Reservation = 1,
    Commit = 2,
    Release = 3,
    ManualAdjustment = 4,
    Refund = 5,
}

public enum UsageReservationStatus
{
    Active = 1,
    Committed = 2,
    Released = 3,
    Expired = 4,
}

public enum EntitlementSource
{
    FreePlan = 1,
    Subscription = 2,
    AdminOverride = 3,
}
```

- [ ] **Step 2: Write the entities** (namespace `FitMate.DB.Entities`)

```csharp
using FitMate.DB.Entities.Base;
using FitMate.DB.Enums;

namespace FitMate.DB.Entities;

public class Plan : BaseEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; }
    public bool IsPublic { get; set; }
    public int SortOrder { get; set; }

    public ICollection<PlanPrice> Prices { get; set; } = [];
    public ICollection<PlanEntitlement> Entitlements { get; set; } = [];
}

public class PlanPrice : BaseEntity
{
    public long PlanId { get; set; }
    public string Currency { get; set; } = "EUR";
    public decimal Amount { get; set; }
    public BillingInterval BillingInterval { get; set; }
    public string StripePriceId { get; set; } = string.Empty;
    public bool IsActive { get; set; }

    public Plan Plan { get; set; } = null!;
}

public class PlanEntitlement : BaseEntity
{
    public long PlanId { get; set; }
    public SubscriptionFeature Feature { get; set; }
    public bool IsEnabled { get; set; }
    public int? DailyLimit { get; set; }
    public int? MonthlyLimit { get; set; }
    public int? MaximumPerRequest { get; set; }
    public int? SoftLimit { get; set; }
    public int? HardLimit { get; set; }
    public string? ConfigurationJson { get; set; }

    public Plan Plan { get; set; } = null!;
}

public class UserSubscription : BaseEntity
{
    public long UserId { get; set; }
    public long PlanId { get; set; }
    public long? PlanPriceId { get; set; }
    public SubscriptionStatus Status { get; set; }
    public string? ExternalSubscriptionId { get; set; }
    public DateTime? CurrentPeriodStart { get; set; }
    public DateTime? CurrentPeriodEnd { get; set; }
    public bool CancelAtPeriodEnd { get; set; }
    public DateTime? CancelledAt { get; set; }

    public User User { get; set; } = null!;
    public Plan Plan { get; set; } = null!;
    public PlanPrice? PlanPrice { get; set; }
}

public class UserPlanOverride : BaseEntity
{
    public long UserId { get; set; }
    public long PlanId { get; set; }
    public long CreatedByUserId { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string? PreviousPlanCode { get; set; }
    public DateTime StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }
    public bool IsActive { get; set; }

    public Plan Plan { get; set; } = null!;
}

public class UsageBucket : BaseEntity
{
    public long UserId { get; set; }
    public SubscriptionFeature Feature { get; set; }
    public DateOnly PeriodStart { get; set; }
    public DateOnly PeriodEnd { get; set; }
    public int Used { get; set; }
    public int Reserved { get; set; }
    public int? EffectiveLimit { get; set; }

    /// Optimistic concurrency guard — incremented manually on every mutation so two
    /// simultaneous reservations cannot both pass the limit check (spec §48).
    public int Version { get; set; }
}

public class UsageEntry : BaseEntity
{
    public long UserId { get; set; }
    public SubscriptionFeature Feature { get; set; }
    public long? AiRunId { get; set; }
    public long? UsageReservationId { get; set; }
    public int Quantity { get; set; }
    public UsageEntryType Type { get; set; }
    public string? ReferenceType { get; set; }
    public long? ReferenceId { get; set; }
}

public class UsageReservation : BaseEntity
{
    public long UserId { get; set; }
    public SubscriptionFeature Feature { get; set; }
    public int Quantity { get; set; }
    public UsageReservationStatus Status { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? FinalizedAt { get; set; }
}
```

> The spec lists `CreatedAt`/`UpdatedAt` on several of these; `BaseEntity.DateCreated`/`DateModified`
> already provide that and are stamped automatically — do not add duplicate columns.
> `UserPlanOverride.PreviousPlanCode` is an addition required by spec §52 ("record previous plan").

- [ ] **Step 3: Write the configurations** (namespace `FitMate.DB.Configurations`; follow `WorkoutConfiguration.cs` style)

```csharp
using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

public class PlanConfiguration : IEntityTypeConfiguration<Plan>
{
    public void Configure(EntityTypeBuilder<Plan> builder)
    {
        builder.Property(x => x.Code).HasMaxLength(50).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(100).IsRequired();
        builder.Property(x => x.Description).HasMaxLength(1000);
        builder.HasIndex(x => x.Code).IsUnique();
    }
}

public class PlanPriceConfiguration : IEntityTypeConfiguration<PlanPrice>
{
    public void Configure(EntityTypeBuilder<PlanPrice> builder)
    {
        builder.Property(x => x.Currency).HasMaxLength(3).IsRequired();
        builder.Property(x => x.Amount).HasPrecision(18, 2);
        builder.Property(x => x.StripePriceId).HasMaxLength(200);

        builder.HasOne(x => x.Plan)
            .WithMany(x => x.Prices)
            .HasForeignKey(x => x.PlanId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => x.StripePriceId);
    }
}

public class PlanEntitlementConfiguration : IEntityTypeConfiguration<PlanEntitlement>
{
    public void Configure(EntityTypeBuilder<PlanEntitlement> builder)
    {
        builder.HasOne(x => x.Plan)
            .WithMany(x => x.Entitlements)
            .HasForeignKey(x => x.PlanId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => new { x.PlanId, x.Feature }).IsUnique();
    }
}

public class UserSubscriptionConfiguration : IEntityTypeConfiguration<UserSubscription>
{
    public void Configure(EntityTypeBuilder<UserSubscription> builder)
    {
        builder.Property(x => x.ExternalSubscriptionId).HasMaxLength(200);

        builder.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(x => x.Plan).WithMany().HasForeignKey(x => x.PlanId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.PlanPrice).WithMany().HasForeignKey(x => x.PlanPriceId).OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(x => new { x.UserId, x.Status });
        builder.HasIndex(x => x.ExternalSubscriptionId);
    }
}

public class UserPlanOverrideConfiguration : IEntityTypeConfiguration<UserPlanOverride>
{
    public void Configure(EntityTypeBuilder<UserPlanOverride> builder)
    {
        builder.Property(x => x.Reason).HasMaxLength(500).IsRequired();
        builder.Property(x => x.PreviousPlanCode).HasMaxLength(50);

        builder.HasOne(x => x.Plan).WithMany().HasForeignKey(x => x.PlanId).OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(x => new { x.UserId, x.IsActive });
    }
}

public class UsageBucketConfiguration : IEntityTypeConfiguration<UsageBucket>
{
    public void Configure(EntityTypeBuilder<UsageBucket> builder)
    {
        builder.Property(x => x.Version).IsConcurrencyToken();
        builder.HasIndex(x => new { x.UserId, x.Feature, x.PeriodStart, x.PeriodEnd }).IsUnique();
    }
}

public class UsageEntryConfiguration : IEntityTypeConfiguration<UsageEntry>
{
    public void Configure(EntityTypeBuilder<UsageEntry> builder)
    {
        builder.Property(x => x.ReferenceType).HasMaxLength(100);
        builder.HasIndex(x => new { x.UserId, x.Feature });
        builder.HasIndex(x => x.UsageReservationId);
    }
}

public class UsageReservationConfiguration : IEntityTypeConfiguration<UsageReservation>
{
    public void Configure(EntityTypeBuilder<UsageReservation> builder)
    {
        builder.HasIndex(x => new { x.UserId, x.Status });
        builder.HasIndex(x => new { x.Status, x.ExpiresAt });
    }
}
```

In `AppDbContext.cs`, add after the existing DbSets:

```csharp
    public DbSet<Plan> Plans => Set<Plan>();
    public DbSet<PlanPrice> PlanPrices => Set<PlanPrice>();
    public DbSet<PlanEntitlement> PlanEntitlements => Set<PlanEntitlement>();
    public DbSet<UserSubscription> UserSubscriptions => Set<UserSubscription>();
    public DbSet<UserPlanOverride> UserPlanOverrides => Set<UserPlanOverride>();
    public DbSet<UsageBucket> UsageBuckets => Set<UsageBucket>();
    public DbSet<UsageEntry> UsageEntries => Set<UsageEntry>();
    public DbSet<UsageReservation> UsageReservations => Set<UsageReservation>();
```

- [ ] **Step 2b: Build and run the DbContext tests**

Run: `dotnet build server/FitMate.sln && dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter AppDbContextTests`
Expected: build OK, PASS.

- [ ] **Step 3b: Add migrations** (two, per spec §74 grouping)

Run:
```bash
dotnet ef migrations add AddSubscriptionPlans --project server/FitMate.DB --startup-project server/FitMate.Web
```
Then temporarily comment out the three usage DbSets? **No** — simpler and equally correct: generate a single migration containing all eight tables and name it `AddSubscriptionPlans`, then generate an empty follow-up only if the spec's two-migration split is desired. Do the single migration:

Run: `dotnet ef migrations add AddSubscriptionPlans --project server/FitMate.DB --startup-project server/FitMate.Web`
Expected: creates `Plans`, `PlanPrices`, `PlanEntitlements`, `UserSubscriptions`, `UserPlanOverrides`, `UsageBuckets`, `UsageEntries`, `UsageReservations` with the unique indexes above. Inspect the file: no drops of existing tables.

- [ ] **Step 4: Commit**

```bash
git add server/FitMate.DB
git commit -m "feat(subscriptions): plan, entitlement and usage entities with migration"
```

---

### Task 2: Subscription exceptions and the limit error envelope

**Files:**
- Create: `server/FitMate.Core/Exceptions/SubscriptionFeatureDisabledException.cs`, `SubscriptionLimitExceededException.cs`
- Create: `server/FitMate.Core/JsonModels/Subscriptions/SubscriptionLimitErrorModel.cs`
- Modify: `server/FitMate.Web/Attributes/LogApiErrorAttribute.cs`
- Test: `server/FitMate.Tests/Integration/SubscriptionApiTests.cs` (created in Task 11 — the assertion for this behavior is written there; here just verify the filter compiles and the unit shape is right)

**Interfaces:**
- Produces: `SubscriptionFeatureDisabledException(SubscriptionFeature feature)` → HTTP **403**; `SubscriptionLimitExceededException(SubscriptionLimitErrorModel details)` → HTTP **429**. Both extend `FitMateException` so any existing `catch (FitMateException)` still behaves.

- [ ] **Step 1: Write the model and exceptions**

`SubscriptionLimitErrorModel.cs`:

```csharp
using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.Subscriptions;

public class SubscriptionLimitErrorModel
{
    public string Code { get; set; } = "subscription_limit_reached";
    public SubscriptionFeature Feature { get; set; }
    public int? Limit { get; set; }
    public int Used { get; set; }
    public int Reserved { get; set; }
    public DateTime? ResetsAt { get; set; }
    public bool UpgradeAvailable { get; set; }
}
```

`SubscriptionFeatureDisabledException.cs`:

```csharp
using FitMate.DB.Enums;

namespace FitMate.Core.Exceptions;

public class SubscriptionFeatureDisabledException : FitMateException
{
    public SubscriptionFeatureDisabledException(SubscriptionFeature feature)
        : base($"Your plan does not include {feature}.")
    {
        Feature = feature;
    }

    public SubscriptionFeature Feature { get; }
}
```

`SubscriptionLimitExceededException.cs`:

```csharp
using FitMate.Core.JsonModels.Subscriptions;

namespace FitMate.Core.Exceptions;

public class SubscriptionLimitExceededException : FitMateException
{
    public SubscriptionLimitExceededException(SubscriptionLimitErrorModel details)
        : base($"You have reached your monthly limit for {details.Feature}.")
    {
        Details = details;
    }

    public SubscriptionLimitErrorModel Details { get; }
}
```

> `FitMate.Core.Exceptions` referencing `FitMate.DB.Enums` requires FitMate.Core → FitMate.DB. Verify
> the reference direction with `dotnet build`; the existing `FitMate.Core/JsonModels/WorkoutTemplates`
> DTOs already use `FitMate.DB.Enums`, so the reference exists.

- [ ] **Step 2: Extend the exception filter** — in `LogApiErrorAttribute.OnException`, insert these two branches **before** the existing `if (context.Exception is FitMateException)` block:

```csharp
        if (context.Exception is SubscriptionLimitExceededException limitException)
        {
            logger.LogWarning(
                "Subscription limit reached on {Request} for {Feature}",
                requestDescriptor,
                limitException.Details.Feature);

            context.ExceptionHandled = true;
            context.Result = new JsonResult(
                new CommonJsonModel<SubscriptionLimitErrorModel>(
                    error: limitException.Message,
                    data: limitException.Details))
            {
                StatusCode = StatusCodes.Status429TooManyRequests,
            };
            return;
        }

        if (context.Exception is SubscriptionFeatureDisabledException disabledException)
        {
            logger.LogWarning(
                "Disabled feature requested on {Request}: {Feature}",
                requestDescriptor,
                disabledException.Feature);

            context.ExceptionHandled = true;
            context.Result = new JsonResult(
                new CommonJsonModel<SubscriptionLimitErrorModel>(
                    error: disabledException.Message,
                    data: new SubscriptionLimitErrorModel
                    {
                        Code = "subscription_feature_disabled",
                        Feature = disabledException.Feature,
                        UpgradeAvailable = true,
                    }))
            {
                StatusCode = StatusCodes.Status403Forbidden,
            };
            return;
        }
```

Add `using FitMate.Core.JsonModels.Subscriptions;` at the top.

> Verify the `CommonJsonModel<T>(string error, T data)` constructor signature against
> `server/FitMate.Core/Common/CommonJsonModel.cs` — `ControllerExtensions.ReturnJsonError<T>` uses
> exactly that overload, so it exists.

- [ ] **Step 3: Build**

Run: `dotnet build server/FitMate.sln`
Expected: OK.

- [ ] **Step 4: Commit**

```bash
git add server/FitMate.Core server/FitMate.Web
git commit -m "feat(subscriptions): 403/429 limit error envelope"
```

---

### Task 3: Plan seeding (Free / Plus / Pro), idempotent

**Files:**
- Create: `server/FitMate.DB/Constants/PlanCodes.cs`
- Create: `server/FitMate.Web/SeedData/plans.json`
- Modify: `server/FitMate.Web/Infrastructure/ApplicationBuilder.cs`
- Modify: `server/FitMate.Tests/TestInfrastructure/SqliteTestDatabase.cs`
- Test: `server/FitMate.Tests/Unit/Services/EntitlementServiceTests.cs` uses the seeded plans (Task 5)

**Interfaces:**
- Produces: `PlanCodes.Free = "free"`, `PlanCodes.Plus = "plus"`, `PlanCodes.Pro = "pro"`; `SqliteTestDatabase.SeedPlans(AppDbContext)` static helper + `SqliteTestDatabase.FreePlanId/PlusPlanId/ProPlanId` constants used by every subsequent test file.

Values seeded (spec §43 placeholders — editable later via Plan 08 admin UI; `null` = unlimited):

| Feature | Free | Plus | Pro |
|---|---|---|---|
| AiChat | 10 | 100 | 500 |
| AiWorkoutGeneration | 2 | 15 | 60 |
| AiProgramGeneration | disabled | 2 | 10 |
| AiExerciseRecognition | disabled | 10 | 50 |
| AiImageGeneration | disabled | 5 | 25 |
| AiTrainingAnalysis | 1 | 10 | 50 |
| ActiveProgramPlans | 1 | 3 | 10 |
| ProgramPlanDurationMonths | 1 | 6 | 12 |
| CustomWorkoutTemplates | 5 | 50 | null (unlimited) |
| ExerciseHistoryMonths | 1 | 12 | null (unlimited) |

For the four "count per month" features the number goes in `MonthlyLimit`. For `ActiveProgramPlans`,
`ProgramPlanDurationMonths`, `CustomWorkoutTemplates`, `ExerciseHistoryMonths` the number is a
**capability ceiling, not a consumable** — it goes in `HardLimit` (no usage bucket is ever created for
them). Disabled features have `IsEnabled = false` and all limits null.

- [ ] **Step 1: Write `PlanCodes`**

```csharp
namespace FitMate.DB.Constants;

public static class PlanCodes
{
    public const string Free = "free";
    public const string Plus = "plus";
    public const string Pro = "pro";

    public static readonly string[] All = [Free, Plus, Pro];
}
```

- [ ] **Step 2: Write `SeedData/plans.json`** (mirrors the shape of the existing `muscle-groups.json` /
`exercises.json` seed files — check one for the casing convention used by the existing loader and match it)

```json
[
  {
    "code": "free",
    "name": "Free",
    "description": "Everything you need to track training.",
    "isPublic": true,
    "sortOrder": 1,
    "entitlements": [
      { "feature": "AiChat", "isEnabled": true, "monthlyLimit": 10 },
      { "feature": "AiWorkoutGeneration", "isEnabled": true, "monthlyLimit": 2 },
      { "feature": "AiProgramGeneration", "isEnabled": false },
      { "feature": "AiExerciseRecognition", "isEnabled": false },
      { "feature": "AiImageGeneration", "isEnabled": false },
      { "feature": "AiTrainingAnalysis", "isEnabled": true, "monthlyLimit": 1 },
      { "feature": "ActiveProgramPlans", "isEnabled": true, "hardLimit": 1 },
      { "feature": "ProgramPlanDurationMonths", "isEnabled": true, "hardLimit": 1 },
      { "feature": "CustomWorkoutTemplates", "isEnabled": true, "hardLimit": 5 },
      { "feature": "ExerciseHistoryMonths", "isEnabled": true, "hardLimit": 1 }
    ]
  },
  {
    "code": "plus",
    "name": "Plus",
    "description": "AI coaching and multi-month programs.",
    "isPublic": true,
    "sortOrder": 2,
    "entitlements": [
      { "feature": "AiChat", "isEnabled": true, "monthlyLimit": 100 },
      { "feature": "AiWorkoutGeneration", "isEnabled": true, "monthlyLimit": 15 },
      { "feature": "AiProgramGeneration", "isEnabled": true, "monthlyLimit": 2 },
      { "feature": "AiExerciseRecognition", "isEnabled": true, "monthlyLimit": 10 },
      { "feature": "AiImageGeneration", "isEnabled": true, "monthlyLimit": 5 },
      { "feature": "AiTrainingAnalysis", "isEnabled": true, "monthlyLimit": 10 },
      { "feature": "ActiveProgramPlans", "isEnabled": true, "hardLimit": 3 },
      { "feature": "ProgramPlanDurationMonths", "isEnabled": true, "hardLimit": 6 },
      { "feature": "CustomWorkoutTemplates", "isEnabled": true, "hardLimit": 50 },
      { "feature": "ExerciseHistoryMonths", "isEnabled": true, "hardLimit": 12 }
    ]
  },
  {
    "code": "pro",
    "name": "Pro",
    "description": "Unlimited planning and the full AI toolset.",
    "isPublic": true,
    "sortOrder": 3,
    "entitlements": [
      { "feature": "AiChat", "isEnabled": true, "monthlyLimit": 500 },
      { "feature": "AiWorkoutGeneration", "isEnabled": true, "monthlyLimit": 60 },
      { "feature": "AiProgramGeneration", "isEnabled": true, "monthlyLimit": 10 },
      { "feature": "AiExerciseRecognition", "isEnabled": true, "monthlyLimit": 50 },
      { "feature": "AiImageGeneration", "isEnabled": true, "monthlyLimit": 25 },
      { "feature": "AiTrainingAnalysis", "isEnabled": true, "monthlyLimit": 50 },
      { "feature": "ActiveProgramPlans", "isEnabled": true, "hardLimit": 10 },
      { "feature": "ProgramPlanDurationMonths", "isEnabled": true, "hardLimit": 12 },
      { "feature": "CustomWorkoutTemplates", "isEnabled": true },
      { "feature": "ExerciseHistoryMonths", "isEnabled": true }
    ]
  }
]
```

Ensure the file is copied to output the same way the other seed files are — check
`FitMate.Web.csproj` for the `<Content Include="SeedData\**">` (or similar) item and add nothing if
the glob already covers it.

- [ ] **Step 3: Write the seeder** — in `ApplicationBuilder.cs`, add `await SeedPlans(dbContext, environment.ContentRootPath);` to `SeedDatabase` (after `SeedMuscleGroups`) and implement it following the exact style of `SeedMuscleGroups`/`SeedExercises` (read them first — reuse their JSON deserialization + `ContentRootPath` combination logic):

```csharp
    private static async Task SeedPlans(AppDbContext dbContext, string contentRootPath)
    {
        var path = Path.Combine(contentRootPath, "SeedData", "plans.json");
        if (!File.Exists(path))
        {
            return;
        }

        var json = await File.ReadAllTextAsync(path);
        var seedPlans = JsonSerializer.Deserialize<List<PlanSeedModel>>(json, JsonOptions) ?? [];

        foreach (var seed in seedPlans)
        {
            var plan = await dbContext.Plans
                .Include(p => p.Entitlements)
                .FirstOrDefaultAsync(p => p.Code == seed.Code);

            if (plan == null)
            {
                plan = new Plan { Code = seed.Code };
                dbContext.Plans.Add(plan);
            }

            // Descriptive fields are refreshed; admin-edited limits are NOT overwritten.
            plan.Name = seed.Name;
            plan.Description = seed.Description;
            plan.IsPublic = seed.IsPublic;
            plan.IsActive = true;
            plan.SortOrder = seed.SortOrder;

            foreach (var entitlementSeed in seed.Entitlements)
            {
                var existing = plan.Entitlements.FirstOrDefault(e => e.Feature == entitlementSeed.Feature);
                if (existing != null)
                {
                    continue;   // never clobber administrator edits (spec §43)
                }

                plan.Entitlements.Add(new PlanEntitlement
                {
                    Feature = entitlementSeed.Feature,
                    IsEnabled = entitlementSeed.IsEnabled,
                    DailyLimit = entitlementSeed.DailyLimit,
                    MonthlyLimit = entitlementSeed.MonthlyLimit,
                    MaximumPerRequest = entitlementSeed.MaximumPerRequest,
                    SoftLimit = entitlementSeed.SoftLimit,
                    HardLimit = entitlementSeed.HardLimit,
                    ConfigurationJson = entitlementSeed.ConfigurationJson,
                });
            }
        }

        await dbContext.SaveChangesAsync();
    }

    private sealed class PlanSeedModel
    {
        public string Code { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public bool IsPublic { get; set; }
        public int SortOrder { get; set; }
        public List<PlanEntitlementSeedModel> Entitlements { get; set; } = [];
    }

    private sealed class PlanEntitlementSeedModel
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

`JsonOptions` must include `new JsonStringEnumConverter()` and `PropertyNameCaseInsensitive = true` —
reuse the options object the existing seeders use if there is one, otherwise add a private static field.

- [ ] **Step 4: Add the test seed helper** — in `SqliteTestDatabase.cs` add constants and a public static
method (called explicitly by tests that need plans; do NOT add it to the default `Seed` so existing
tests stay unaffected):

```csharp
    public const long FreePlanId = 101;
    public const long PlusPlanId = 102;
    public const long ProPlanId = 103;

    /// Seeds the three plans with the same entitlement values as SeedData/plans.json.
    public static void SeedPlans(AppDbContext context)
    {
        if (context.Plans.Any())
        {
            return;
        }

        context.Plans.AddRange(
            NewPlan(FreePlanId, PlanCodes.Free, "Free", 1,
                (SubscriptionFeature.AiChat, true, 10, null),
                (SubscriptionFeature.AiWorkoutGeneration, true, 2, null),
                (SubscriptionFeature.AiProgramGeneration, false, null, null),
                (SubscriptionFeature.AiExerciseRecognition, false, null, null),
                (SubscriptionFeature.AiImageGeneration, false, null, null),
                (SubscriptionFeature.AiTrainingAnalysis, true, 1, null),
                (SubscriptionFeature.ActiveProgramPlans, true, null, 1),
                (SubscriptionFeature.ProgramPlanDurationMonths, true, null, 1),
                (SubscriptionFeature.CustomWorkoutTemplates, true, null, 5),
                (SubscriptionFeature.ExerciseHistoryMonths, true, null, 1)),
            NewPlan(PlusPlanId, PlanCodes.Plus, "Plus", 2,
                (SubscriptionFeature.AiChat, true, 100, null),
                (SubscriptionFeature.AiWorkoutGeneration, true, 15, null),
                (SubscriptionFeature.AiProgramGeneration, true, 2, null),
                (SubscriptionFeature.AiExerciseRecognition, true, 10, null),
                (SubscriptionFeature.AiImageGeneration, true, 5, null),
                (SubscriptionFeature.AiTrainingAnalysis, true, 10, null),
                (SubscriptionFeature.ActiveProgramPlans, true, null, 3),
                (SubscriptionFeature.ProgramPlanDurationMonths, true, null, 6),
                (SubscriptionFeature.CustomWorkoutTemplates, true, null, 50),
                (SubscriptionFeature.ExerciseHistoryMonths, true, null, 12)),
            NewPlan(ProPlanId, PlanCodes.Pro, "Pro", 3,
                (SubscriptionFeature.AiChat, true, 500, null),
                (SubscriptionFeature.AiWorkoutGeneration, true, 60, null),
                (SubscriptionFeature.AiProgramGeneration, true, 10, null),
                (SubscriptionFeature.AiExerciseRecognition, true, 50, null),
                (SubscriptionFeature.AiImageGeneration, true, 25, null),
                (SubscriptionFeature.AiTrainingAnalysis, true, 50, null),
                (SubscriptionFeature.ActiveProgramPlans, true, null, 10),
                (SubscriptionFeature.ProgramPlanDurationMonths, true, null, 12),
                (SubscriptionFeature.CustomWorkoutTemplates, true, null, null),
                (SubscriptionFeature.ExerciseHistoryMonths, true, null, null)));

        context.SaveChanges();
    }

    private static Plan NewPlan(
        long id,
        string code,
        string name,
        int sortOrder,
        params (SubscriptionFeature Feature, bool IsEnabled, int? MonthlyLimit, int? HardLimit)[] entitlements) => new()
    {
        Id = id,
        Code = code,
        Name = name,
        IsActive = true,
        IsPublic = true,
        SortOrder = sortOrder,
        Entitlements = entitlements
            .Select(e => new PlanEntitlement
            {
                Feature = e.Feature,
                IsEnabled = e.IsEnabled,
                MonthlyLimit = e.MonthlyLimit,
                HardLimit = e.HardLimit,
            })
            .ToList(),
    };
```

- [ ] **Step 5: Build + verify seeding runs**

Run: `dotnet build server/FitMate.sln`
Expected: OK. (Runtime verification happens in Task 11's integration test, which asserts three plans exist and that running the seeder twice does not duplicate them.)

- [ ] **Step 6: Commit**

```bash
git add server/FitMate.DB server/FitMate.Web server/FitMate.Tests
git commit -m "feat(subscriptions): idempotent Free/Plus/Pro plan seeding"
```

---

### Task 4: DTOs and mapper

**Files:**
- Create: `server/FitMate.Core/JsonModels/Subscriptions/FeatureAvailabilityModel.cs`, `EffectiveEntitlementsModel.cs`, `CurrentSubscriptionModel.cs`, `SubscriptionPlanModel.cs`, `SubscriptionPlanPriceModel.cs`, `UsageReservationModel.cs`
- Create: `server/FitMate.Services/Subscriptions/SubscriptionMapper.cs`

**Interfaces:**
- Produces the DTOs consumed by Tasks 5, 6, 9, 10 and by Plans 05–10 (`FeatureAvailabilityModel` is the roadmap's `FeatureAvailability`).

- [ ] **Step 1: Write the DTOs**

```csharp
using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.Subscriptions;

public class FeatureAvailabilityModel
{
    public SubscriptionFeature Feature { get; set; }
    public bool IsEnabled { get; set; }
    public int? Limit { get; set; }
    public int Used { get; set; }
    public int Reserved { get; set; }
    public int? Remaining => Limit.HasValue ? Math.Max(0, Limit.Value - Used - Reserved) : null;
    public DateTime? ResetsAt { get; set; }
}

public class EffectiveEntitlementsModel
{
    public long PlanId { get; set; }
    public string PlanCode { get; set; } = string.Empty;
    public string PlanName { get; set; } = string.Empty;
    public EntitlementSource Source { get; set; }
    public List<FeatureAvailabilityModel> Features { get; set; } = [];
}

public class CurrentSubscriptionModel
{
    public long PlanId { get; set; }
    public string PlanCode { get; set; } = string.Empty;
    public string PlanName { get; set; } = string.Empty;
    public EntitlementSource Source { get; set; }
    public SubscriptionStatus? Status { get; set; }
    public DateTime? CurrentPeriodEnd { get; set; }
    public bool CancelAtPeriodEnd { get; set; }
    public List<FeatureAvailabilityModel> Features { get; set; } = [];
}

public class SubscriptionPlanModel
{
    public long Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public List<SubscriptionPlanPriceModel> Prices { get; set; } = [];
    public List<PlanFeatureModel> Features { get; set; } = [];
}

public class SubscriptionPlanPriceModel
{
    public long Id { get; set; }
    public string Currency { get; set; } = "EUR";
    public decimal Amount { get; set; }
    public BillingInterval BillingInterval { get; set; }
}

public class PlanFeatureModel
{
    public SubscriptionFeature Feature { get; set; }
    public bool IsEnabled { get; set; }
    public int? MonthlyLimit { get; set; }
    public int? HardLimit { get; set; }
}

public class UsageReservationModel
{
    public long Id { get; set; }
    public SubscriptionFeature Feature { get; set; }
    public int Quantity { get; set; }
    public UsageReservationStatus Status { get; set; }
    public DateTime ExpiresAt { get; set; }
}
```

- [ ] **Step 2: Write the mapper**

```csharp
using FitMate.Core.JsonModels.Subscriptions;
using FitMate.DB.Entities;

namespace FitMate.Services.Subscriptions;

public static class SubscriptionMapper
{
    public static SubscriptionPlanModel ToModel(Plan plan) => new()
    {
        Id = plan.Id,
        Code = plan.Code,
        Name = plan.Name,
        Description = plan.Description,
        SortOrder = plan.SortOrder,
        Prices = plan.Prices
            .Where(p => p.IsActive)
            .OrderBy(p => p.BillingInterval)
            .Select(p => new SubscriptionPlanPriceModel
            {
                Id = p.Id,
                Currency = p.Currency,
                Amount = p.Amount,
                BillingInterval = p.BillingInterval,
            })
            .ToList(),
        Features = plan.Entitlements
            .OrderBy(e => e.Feature)
            .Select(e => new PlanFeatureModel
            {
                Feature = e.Feature,
                IsEnabled = e.IsEnabled,
                MonthlyLimit = e.MonthlyLimit,
                HardLimit = e.HardLimit,
            })
            .ToList(),
    };

    public static UsageReservationModel ToModel(UsageReservation reservation) => new()
    {
        Id = reservation.Id,
        Feature = reservation.Feature,
        Quantity = reservation.Quantity,
        Status = reservation.Status,
        ExpiresAt = reservation.ExpiresAt,
    };
}
```

- [ ] **Step 3: Build**

Run: `dotnet build server/FitMate.sln`
Expected: OK.

- [ ] **Step 4: Commit**

```bash
git add server/FitMate.Core server/FitMate.Services
git commit -m "feat(subscriptions): subscription DTOs and mapper"
```

---

### Task 5: EntitlementService (resolution priority + availability), TDD

**Files:**
- Create: `server/FitMate.Services/Subscriptions/IEntitlementService.cs`, `EntitlementService.cs`
- Test: `server/FitMate.Tests/Unit/Services/EntitlementServiceTests.cs`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces:

```csharp
using FitMate.Core.JsonModels.Subscriptions;
using FitMate.DB.Entities;
using FitMate.DB.Enums;

namespace FitMate.Services.Subscriptions;

public interface IEntitlementService
{
    /// Throws SubscriptionFeatureDisabledException (403) when the plan does not include the feature.
    Task RequireFeatureAsync(long userId, SubscriptionFeature feature);

    Task<FeatureAvailabilityModel> GetAvailabilityAsync(long userId, SubscriptionFeature feature);

    Task<EffectiveEntitlementsModel> GetAllAsync(long userId);

    /// The plan entitlement row that applies to this user (null when the feature has no row at all).
    Task<PlanEntitlement?> GetEntitlementAsync(long userId, SubscriptionFeature feature);

    /// Called by Plan 09's Stripe webhook and Plan 08's admin edits.
    void Invalidate(long userId);
}
```

Resolution (spec §52): active `UserPlanOverride` (`IsActive && StartsAt <= now && (EndsAt == null || EndsAt > now)`, newest first) → `UserSubscription` with `Status` in (`Active`, `Trialing`) → plan with `Code == PlanCodes.Free`. Resolved plan + entitlements are cached in `IMemoryCache` under `"entitlements:{userId}"` for 60 seconds; `Invalidate` removes the key.

`GetAvailabilityAsync` reads the current month's `UsageBucket` (may not exist → `Used = 0`, `Reserved = 0`) and reports `Limit = entitlement.MonthlyLimit ?? entitlement.HardLimit`, `ResetsAt` = first day of next month 00:00 UTC. Disabled/missing entitlement → `IsEnabled = false`, `Limit = 0`.

- [ ] **Step 1: Write failing tests**

```csharp
using FitMate.Core.Exceptions;
using FitMate.DB.Constants;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.Subscriptions;
using FitMate.Tests.TestInfrastructure;
using Microsoft.Extensions.Caching.Memory;

namespace FitMate.Tests.Unit.Services;

public class EntitlementServiceTests
{
    private static EntitlementService CreateService(SqliteTestDatabase db)
    {
        using (var seedContext = db.CreateContext())
        {
            SqliteTestDatabase.SeedPlans(seedContext);
        }

        return new EntitlementService(db.CreateContext(), new MemoryCache(new MemoryCacheOptions()));
    }

    private static async Task GiveSubscriptionAsync(SqliteTestDatabase db, long userId, long planId, SubscriptionStatus status)
    {
        await using var context = db.CreateContext();
        context.UserSubscriptions.Add(new UserSubscription
        {
            UserId = userId,
            PlanId = planId,
            Status = status,
        });
        await context.SaveChangesAsync();
    }

    [Fact]
    public async Task GetAll_NoSubscription_FallsBackToFreePlan()
    {
        using var db = new SqliteTestDatabase();
        var service = CreateService(db);

        var entitlements = await service.GetAllAsync(SqliteTestDatabase.UserId);

        Assert.Equal(PlanCodes.Free, entitlements.PlanCode);
        Assert.Equal(EntitlementSource.FreePlan, entitlements.Source);
        Assert.Equal(10, entitlements.Features.Single(f => f.Feature == SubscriptionFeature.AiChat).Limit);
    }

    [Fact]
    public async Task GetAll_ActiveSubscription_UsesSubscribedPlan()
    {
        using var db = new SqliteTestDatabase();
        await GiveSubscriptionAsync(db, SqliteTestDatabase.UserId, SqliteTestDatabase.PlusPlanId, SubscriptionStatus.Active);
        var service = CreateService(db);

        var entitlements = await service.GetAllAsync(SqliteTestDatabase.UserId);

        Assert.Equal(PlanCodes.Plus, entitlements.PlanCode);
        Assert.Equal(EntitlementSource.Subscription, entitlements.Source);
    }

    [Fact]
    public async Task GetAll_CancelledSubscription_FallsBackToFree()
    {
        using var db = new SqliteTestDatabase();
        await GiveSubscriptionAsync(db, SqliteTestDatabase.UserId, SqliteTestDatabase.ProPlanId, SubscriptionStatus.Cancelled);
        var service = CreateService(db);

        var entitlements = await service.GetAllAsync(SqliteTestDatabase.UserId);

        Assert.Equal(PlanCodes.Free, entitlements.PlanCode);
    }

    [Fact]
    public async Task GetAll_ActiveOverride_BeatsSubscription()
    {
        using var db = new SqliteTestDatabase();
        await GiveSubscriptionAsync(db, SqliteTestDatabase.UserId, SqliteTestDatabase.PlusPlanId, SubscriptionStatus.Active);
        await using (var context = db.CreateContext())
        {
            context.UserPlanOverrides.Add(new UserPlanOverride
            {
                UserId = SqliteTestDatabase.UserId,
                PlanId = SqliteTestDatabase.ProPlanId,
                CreatedByUserId = SqliteTestDatabase.AdminUserId,
                Reason = "Beta tester",
                StartsAt = DateTime.UtcNow.AddDays(-1),
                IsActive = true,
            });
            await context.SaveChangesAsync();
        }
        var service = CreateService(db);

        var entitlements = await service.GetAllAsync(SqliteTestDatabase.UserId);

        Assert.Equal(PlanCodes.Pro, entitlements.PlanCode);
        Assert.Equal(EntitlementSource.AdminOverride, entitlements.Source);
    }

    [Fact]
    public async Task GetAll_ExpiredOverride_Ignored()
    {
        using var db = new SqliteTestDatabase();
        await using (var context = db.CreateContext())
        {
            context.UserPlanOverrides.Add(new UserPlanOverride
            {
                UserId = SqliteTestDatabase.UserId,
                PlanId = SqliteTestDatabase.ProPlanId,
                CreatedByUserId = SqliteTestDatabase.AdminUserId,
                Reason = "Expired trial",
                StartsAt = DateTime.UtcNow.AddDays(-10),
                EndsAt = DateTime.UtcNow.AddDays(-1),
                IsActive = true,
            });
            await context.SaveChangesAsync();
        }
        var service = CreateService(db);

        var entitlements = await service.GetAllAsync(SqliteTestDatabase.UserId);

        Assert.Equal(PlanCodes.Free, entitlements.PlanCode);
    }

    [Fact]
    public async Task RequireFeature_DisabledOnFreePlan_Throws403Exception()
    {
        using var db = new SqliteTestDatabase();
        var service = CreateService(db);

        await Assert.ThrowsAsync<SubscriptionFeatureDisabledException>(() =>
            service.RequireFeatureAsync(SqliteTestDatabase.UserId, SubscriptionFeature.AiProgramGeneration));
    }

    [Fact]
    public async Task RequireFeature_EnabledFeature_DoesNotThrow()
    {
        using var db = new SqliteTestDatabase();
        var service = CreateService(db);

        await service.RequireFeatureAsync(SqliteTestDatabase.UserId, SubscriptionFeature.AiChat);
    }

    [Fact]
    public async Task GetAvailability_WithExistingUsage_ReportsRemaining()
    {
        using var db = new SqliteTestDatabase();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        await using (var context = db.CreateContext())
        {
            context.UsageBuckets.Add(new UsageBucket
            {
                UserId = SqliteTestDatabase.UserId,
                Feature = SubscriptionFeature.AiChat,
                PeriodStart = new DateOnly(today.Year, today.Month, 1),
                PeriodEnd = new DateOnly(today.Year, today.Month, 1).AddMonths(1).AddDays(-1),
                Used = 3,
                Reserved = 1,
            });
            await context.SaveChangesAsync();
        }
        var service = CreateService(db);

        var availability = await service.GetAvailabilityAsync(SqliteTestDatabase.UserId, SubscriptionFeature.AiChat);

        Assert.True(availability.IsEnabled);
        Assert.Equal(10, availability.Limit);
        Assert.Equal(3, availability.Used);
        Assert.Equal(1, availability.Reserved);
        Assert.Equal(6, availability.Remaining);
        Assert.NotNull(availability.ResetsAt);
    }

    [Fact]
    public async Task GetAvailability_UnlimitedFeatureOnPro_HasNullLimitAndRemaining()
    {
        using var db = new SqliteTestDatabase();
        await GiveSubscriptionAsync(db, SqliteTestDatabase.UserId, SqliteTestDatabase.ProPlanId, SubscriptionStatus.Active);
        var service = CreateService(db);

        var availability = await service.GetAvailabilityAsync(SqliteTestDatabase.UserId, SubscriptionFeature.CustomWorkoutTemplates);

        Assert.True(availability.IsEnabled);
        Assert.Null(availability.Limit);
        Assert.Null(availability.Remaining);
    }
}
```

- [ ] **Step 2: Run — expect FAIL** (`EntitlementService` missing)

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter EntitlementServiceTests`

- [ ] **Step 3: Implement**

```csharp
using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.Subscriptions;
using FitMate.DB;
using FitMate.DB.Constants;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace FitMate.Services.Subscriptions;

public class EntitlementService : IEntitlementService
{
    private static readonly TimeSpan CacheDuration = TimeSpan.FromSeconds(60);

    private readonly AppDbContext dbContext;
    private readonly IMemoryCache cache;

    public EntitlementService(AppDbContext dbContext, IMemoryCache cache)
    {
        this.dbContext = dbContext;
        this.cache = cache;
    }

    public void Invalidate(long userId) => cache.Remove(CacheKey(userId));

    public async Task RequireFeatureAsync(long userId, SubscriptionFeature feature)
    {
        var entitlement = await GetEntitlementAsync(userId, feature);
        if (entitlement is not { IsEnabled: true })
        {
            throw new SubscriptionFeatureDisabledException(feature);
        }
    }

    public async Task<PlanEntitlement?> GetEntitlementAsync(long userId, SubscriptionFeature feature)
    {
        var resolved = await ResolvePlanAsync(userId);
        return resolved.Plan.Entitlements.FirstOrDefault(e => e.Feature == feature);
    }

    public async Task<FeatureAvailabilityModel> GetAvailabilityAsync(long userId, SubscriptionFeature feature)
    {
        var resolved = await ResolvePlanAsync(userId);
        var period = UsagePeriod.CurrentMonth();
        var bucket = await dbContext.UsageBuckets
            .AsNoTracking()
            .FirstOrDefaultAsync(b => b.UserId == userId
                && b.Feature == feature
                && b.PeriodStart == period.Start
                && b.PeriodEnd == period.End);

        return BuildAvailability(resolved.Plan, feature, bucket, period);
    }

    public async Task<EffectiveEntitlementsModel> GetAllAsync(long userId)
    {
        var resolved = await ResolvePlanAsync(userId);
        var period = UsagePeriod.CurrentMonth();
        var buckets = await dbContext.UsageBuckets
            .AsNoTracking()
            .Where(b => b.UserId == userId && b.PeriodStart == period.Start && b.PeriodEnd == period.End)
            .ToListAsync();

        return new EffectiveEntitlementsModel
        {
            PlanId = resolved.Plan.Id,
            PlanCode = resolved.Plan.Code,
            PlanName = resolved.Plan.Name,
            Source = resolved.Source,
            Features = Enum.GetValues<SubscriptionFeature>()
                .Select(feature => BuildAvailability(
                    resolved.Plan,
                    feature,
                    buckets.FirstOrDefault(b => b.Feature == feature),
                    period))
                .ToList(),
        };
    }

    private static FeatureAvailabilityModel BuildAvailability(
        Plan plan,
        SubscriptionFeature feature,
        UsageBucket? bucket,
        UsagePeriod period)
    {
        var entitlement = plan.Entitlements.FirstOrDefault(e => e.Feature == feature);
        if (entitlement is not { IsEnabled: true })
        {
            return new FeatureAvailabilityModel
            {
                Feature = feature,
                IsEnabled = false,
                Limit = 0,
                Used = bucket?.Used ?? 0,
                Reserved = bucket?.Reserved ?? 0,
                ResetsAt = period.ResetsAt,
            };
        }

        return new FeatureAvailabilityModel
        {
            Feature = feature,
            IsEnabled = true,
            Limit = entitlement.MonthlyLimit ?? entitlement.HardLimit,
            Used = bucket?.Used ?? 0,
            Reserved = bucket?.Reserved ?? 0,
            ResetsAt = period.ResetsAt,
        };
    }

    private async Task<(Plan Plan, EntitlementSource Source)> ResolvePlanAsync(long userId)
    {
        if (cache.TryGetValue(CacheKey(userId), out (Plan Plan, EntitlementSource Source) cached))
        {
            return cached;
        }

        var now = DateTime.UtcNow;

        var overridePlanId = await dbContext.UserPlanOverrides
            .AsNoTracking()
            .Where(o => o.UserId == userId
                && o.IsActive
                && o.StartsAt <= now
                && (o.EndsAt == null || o.EndsAt > now))
            .OrderByDescending(o => o.StartsAt)
            .Select(o => (long?)o.PlanId)
            .FirstOrDefaultAsync();

        long? subscriptionPlanId = null;
        if (overridePlanId == null)
        {
            subscriptionPlanId = await dbContext.UserSubscriptions
                .AsNoTracking()
                .Where(s => s.UserId == userId
                    && (s.Status == SubscriptionStatus.Active || s.Status == SubscriptionStatus.Trialing))
                .OrderByDescending(s => s.DateCreated)
                .Select(s => (long?)s.PlanId)
                .FirstOrDefaultAsync();
        }

        var source = overridePlanId != null
            ? EntitlementSource.AdminOverride
            : subscriptionPlanId != null
                ? EntitlementSource.Subscription
                : EntitlementSource.FreePlan;

        var planId = overridePlanId ?? subscriptionPlanId;
        var plan = planId != null
            ? await LoadPlanAsync(p => p.Id == planId.Value)
            : null;

        // A deactivated or deleted plan must never grant more than Free.
        if (plan is not { IsActive: true })
        {
            plan = await LoadPlanAsync(p => p.Code == PlanCodes.Free)
                ?? throw new FitMateException("The Free plan is not seeded.");
            source = EntitlementSource.FreePlan;
        }

        var result = (plan, source);
        cache.Set(CacheKey(userId), result, CacheDuration);
        return result;
    }

    private Task<Plan?> LoadPlanAsync(System.Linq.Expressions.Expression<Func<Plan, bool>> predicate) =>
        dbContext.Plans
            .AsNoTracking()
            .Include(p => p.Entitlements)
            .FirstOrDefaultAsync(predicate);

    private static string CacheKey(long userId) => $"entitlements:{userId}";
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter EntitlementServiceTests`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add server/FitMate.Services server/FitMate.Tests
git commit -m "feat(subscriptions): entitlement resolution with override > subscription > free priority"
```

---

### Task 6: UsageService — concurrency-safe reserve / commit / release, TDD

**Files:**
- Create: `server/FitMate.Services/Subscriptions/UsagePeriod.cs`, `IUsageService.cs`, `UsageService.cs`
- Test: `server/FitMate.Tests/Unit/Services/UsageServiceTests.cs`

**Interfaces:**
- Consumes: `IEntitlementService`.
- Produces:

```csharp
using FitMate.Core.JsonModels.Subscriptions;
using FitMate.DB.Enums;

namespace FitMate.Services.Subscriptions;

public interface IUsageService
{
    /// Reserves quantity against the current month's bucket.
    /// Throws SubscriptionFeatureDisabledException (403) when the feature is not in the plan and
    /// SubscriptionLimitExceededException (429) when the quota is exhausted.
    Task<UsageReservationModel> ReserveAsync(long userId, SubscriptionFeature feature, int quantity);

    /// Moves Reserved → Used. Idempotent: committing a non-Active reservation is a no-op.
    Task CommitAsync(long reservationId);

    /// Frees Reserved. Idempotent: releasing a non-Active reservation is a no-op.
    Task ReleaseAsync(long reservationId);

    /// Expires Active reservations past ExpiresAt for this user (called at the start of ReserveAsync;
    /// Plan 11 also calls it from a maintenance job).
    Task ExpireStaleReservationsAsync(long userId);
}
```

`UsagePeriod`:

```csharp
namespace FitMate.Services.Subscriptions;

public readonly record struct UsagePeriod(DateOnly Start, DateOnly End)
{
    public static UsagePeriod CurrentMonth() => ForDate(DateOnly.FromDateTime(DateTime.UtcNow));

    public static UsagePeriod ForDate(DateOnly date)
    {
        var start = new DateOnly(date.Year, date.Month, 1);
        return new UsagePeriod(start, start.AddMonths(1).AddDays(-1));
    }

    public DateTime ResetsAt => End.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
}
```

Concurrency contract: `UsageBucket.Version` is an EF concurrency token incremented on every write.
`ReserveAsync` loads the bucket, checks `Used + Reserved + quantity <= limit`, increments `Reserved`
and `Version`, and saves. On `DbUpdateConcurrencyException` it reloads and retries (max 3 attempts);
if it still cannot fit, the limit exception is thrown. Two simultaneous callers therefore serialize —
exactly one can consume the last unit.

- [ ] **Step 1: Write failing tests**

```csharp
using FitMate.Core.Exceptions;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.Subscriptions;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace FitMate.Tests.Unit.Services;

public class UsageServiceTests
{
    private static UsageService CreateService(SqliteTestDatabase db, IMemoryCache? sharedCache = null)
    {
        using (var seedContext = db.CreateContext())
        {
            SqliteTestDatabase.SeedPlans(seedContext);
        }

        var context = db.CreateContext();
        var cache = sharedCache ?? new MemoryCache(new MemoryCacheOptions());
        return new UsageService(context, new EntitlementService(context, cache));
    }

    [Fact]
    public async Task Reserve_CreatesBucketAndReservation()
    {
        using var db = new SqliteTestDatabase();
        var service = CreateService(db);

        var reservation = await service.ReserveAsync(SqliteTestDatabase.UserId, SubscriptionFeature.AiChat, 1);

        Assert.Equal(UsageReservationStatus.Active, reservation.Status);
        await using var context = db.CreateContext();
        var bucket = await context.UsageBuckets.SingleAsync();
        Assert.Equal(1, bucket.Reserved);
        Assert.Equal(0, bucket.Used);
        Assert.Equal(10, bucket.EffectiveLimit);
        Assert.Equal(UsageEntryType.Reservation, context.UsageEntries.Single().Type);
    }

    [Fact]
    public async Task Commit_MovesReservedToUsed()
    {
        using var db = new SqliteTestDatabase();
        var service = CreateService(db);
        var reservation = await service.ReserveAsync(SqliteTestDatabase.UserId, SubscriptionFeature.AiChat, 1);

        await service.CommitAsync(reservation.Id);

        await using var context = db.CreateContext();
        var bucket = await context.UsageBuckets.SingleAsync();
        Assert.Equal(0, bucket.Reserved);
        Assert.Equal(1, bucket.Used);
        Assert.Equal(UsageReservationStatus.Committed, context.UsageReservations.Single().Status);
    }

    [Fact]
    public async Task Commit_Twice_IsIdempotent()
    {
        using var db = new SqliteTestDatabase();
        var service = CreateService(db);
        var reservation = await service.ReserveAsync(SqliteTestDatabase.UserId, SubscriptionFeature.AiChat, 1);

        await service.CommitAsync(reservation.Id);
        await service.CommitAsync(reservation.Id);

        await using var context = db.CreateContext();
        var bucket = await context.UsageBuckets.SingleAsync();
        Assert.Equal(1, bucket.Used);
    }

    [Fact]
    public async Task Release_FreesReservation()
    {
        using var db = new SqliteTestDatabase();
        var service = CreateService(db);
        var reservation = await service.ReserveAsync(SqliteTestDatabase.UserId, SubscriptionFeature.AiChat, 1);

        await service.ReleaseAsync(reservation.Id);

        await using var context = db.CreateContext();
        var bucket = await context.UsageBuckets.SingleAsync();
        Assert.Equal(0, bucket.Reserved);
        Assert.Equal(0, bucket.Used);
        Assert.Equal(UsageReservationStatus.Released, context.UsageReservations.Single().Status);
    }

    [Fact]
    public async Task Release_AfterCommit_DoesNotDecrementUsed()
    {
        using var db = new SqliteTestDatabase();
        var service = CreateService(db);
        var reservation = await service.ReserveAsync(SqliteTestDatabase.UserId, SubscriptionFeature.AiChat, 1);
        await service.CommitAsync(reservation.Id);

        await service.ReleaseAsync(reservation.Id);

        await using var context = db.CreateContext();
        var bucket = await context.UsageBuckets.SingleAsync();
        Assert.Equal(1, bucket.Used);
        Assert.Equal(0, bucket.Reserved);
    }

    [Fact]
    public async Task Reserve_BeyondMonthlyLimit_Throws429Exception()
    {
        using var db = new SqliteTestDatabase();
        var service = CreateService(db);

        // Free plan grants 2 AI workout generations per month.
        var first = await service.ReserveAsync(SqliteTestDatabase.UserId, SubscriptionFeature.AiWorkoutGeneration, 1);
        await service.CommitAsync(first.Id);
        var second = await service.ReserveAsync(SqliteTestDatabase.UserId, SubscriptionFeature.AiWorkoutGeneration, 1);
        await service.CommitAsync(second.Id);

        var exception = await Assert.ThrowsAsync<SubscriptionLimitExceededException>(() =>
            service.ReserveAsync(SqliteTestDatabase.UserId, SubscriptionFeature.AiWorkoutGeneration, 1));

        Assert.Equal("subscription_limit_reached", exception.Details.Code);
        Assert.Equal(2, exception.Details.Limit);
        Assert.Equal(2, exception.Details.Used);
        Assert.True(exception.Details.UpgradeAvailable);
    }

    [Fact]
    public async Task Reserve_DisabledFeature_Throws403Exception()
    {
        using var db = new SqliteTestDatabase();
        var service = CreateService(db);

        await Assert.ThrowsAsync<SubscriptionFeatureDisabledException>(() =>
            service.ReserveAsync(SqliteTestDatabase.UserId, SubscriptionFeature.AiProgramGeneration, 1));
    }

    [Fact]
    public async Task Reserve_UnlimitedFeature_NeverThrows()
    {
        using var db = new SqliteTestDatabase();
        await using (var context = db.CreateContext())
        {
            SqliteTestDatabase.SeedPlans(context);
            context.UserSubscriptions.Add(new UserSubscription
            {
                UserId = SqliteTestDatabase.UserId,
                PlanId = SqliteTestDatabase.ProPlanId,
                Status = SubscriptionStatus.Active,
            });
            await context.SaveChangesAsync();
        }
        var service = CreateService(db);

        for (var i = 0; i < 5; i++)
        {
            var reservation = await service.ReserveAsync(
                SqliteTestDatabase.UserId,
                SubscriptionFeature.CustomWorkoutTemplates,
                1);
            await service.CommitAsync(reservation.Id);
        }

        await using var verify = db.CreateContext();
        Assert.Equal(5, (await verify.UsageBuckets.SingleAsync()).Used);
    }

    [Fact]
    public async Task Reserve_ConcurrentCallsForLastUnit_OnlyOneSucceeds()
    {
        using var db = new SqliteTestDatabase();
        var cache = new MemoryCache(new MemoryCacheOptions());
        using (var seedContext = db.CreateContext())
        {
            SqliteTestDatabase.SeedPlans(seedContext);
        }

        // Free plan: AiWorkoutGeneration monthly limit 2. Consume one, leaving exactly one unit.
        var warmup = CreateService(db, cache);
        var used = await warmup.ReserveAsync(SqliteTestDatabase.UserId, SubscriptionFeature.AiWorkoutGeneration, 1);
        await warmup.CommitAsync(used.Id);

        var serviceA = CreateService(db, cache);
        var serviceB = CreateService(db, cache);

        var results = await Task.WhenAll(
            RunAsync(serviceA),
            RunAsync(serviceB));

        Assert.Equal(1, results.Count(r => r));   // exactly one reservation succeeded
        await using var context = db.CreateContext();
        var bucket = await context.UsageBuckets.SingleAsync(b => b.Feature == SubscriptionFeature.AiWorkoutGeneration);
        Assert.True(bucket.Used + bucket.Reserved <= 2);

        static async Task<bool> RunAsync(UsageService service)
        {
            try
            {
                await service.ReserveAsync(SqliteTestDatabase.UserId, SubscriptionFeature.AiWorkoutGeneration, 1);
                return true;
            }
            catch (SubscriptionLimitExceededException)
            {
                return false;
            }
        }
    }

    [Fact]
    public async Task ExpireStaleReservations_FreesReservedUnits()
    {
        using var db = new SqliteTestDatabase();
        var service = CreateService(db);
        var reservation = await service.ReserveAsync(SqliteTestDatabase.UserId, SubscriptionFeature.AiChat, 1);

        await using (var context = db.CreateContext())
        {
            var stored = await context.UsageReservations.SingleAsync(r => r.Id == reservation.Id);
            stored.ExpiresAt = DateTime.UtcNow.AddMinutes(-1);
            await context.SaveChangesAsync();
        }

        await service.ExpireStaleReservationsAsync(SqliteTestDatabase.UserId);

        await using var verify = db.CreateContext();
        Assert.Equal(0, (await verify.UsageBuckets.SingleAsync()).Reserved);
        Assert.Equal(UsageReservationStatus.Expired, (await verify.UsageReservations.SingleAsync()).Status);
    }
}
```

> Sqlite in-memory shares one connection across contexts (see `SqliteTestDatabase`), so the concurrency
> test exercises real EF concurrency-token behavior. If the parallel test proves flaky under Sqlite's
> single-writer locking, replace `Task.WhenAll` with sequential calls **on two separately-loaded
> contexts** (load both buckets first, then save both) — that still reproduces the stale-version race
> and keeps the assertion meaningful. Note which variant you used in the commit message.

- [ ] **Step 2: Run — expect FAIL**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter UsageServiceTests`

- [ ] **Step 3: Implement**

```csharp
using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.Subscriptions;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.Subscriptions;

public class UsageService : IUsageService
{
    private const int MaxConcurrencyRetries = 3;
    private static readonly TimeSpan ReservationLifetime = TimeSpan.FromMinutes(15);

    private readonly AppDbContext dbContext;
    private readonly IEntitlementService entitlementService;

    public UsageService(AppDbContext dbContext, IEntitlementService entitlementService)
    {
        this.dbContext = dbContext;
        this.entitlementService = entitlementService;
    }

    public async Task<UsageReservationModel> ReserveAsync(long userId, SubscriptionFeature feature, int quantity)
    {
        if (quantity <= 0)
        {
            throw new FitMateException("Reservation quantity must be positive.");
        }

        var entitlement = await entitlementService.GetEntitlementAsync(userId, feature);
        if (entitlement is not { IsEnabled: true })
        {
            throw new SubscriptionFeatureDisabledException(feature);
        }
        if (entitlement.MaximumPerRequest is { } perRequest && quantity > perRequest)
        {
            throw new FitMateException($"At most {perRequest} can be requested at once.");
        }

        await ExpireStaleReservationsAsync(userId);

        var limit = entitlement.MonthlyLimit ?? entitlement.HardLimit;
        var period = UsagePeriod.CurrentMonth();

        for (var attempt = 0; attempt < MaxConcurrencyRetries; attempt++)
        {
            var bucket = await GetOrCreateBucketAsync(userId, feature, period, limit);

            if (limit.HasValue && bucket.Used + bucket.Reserved + quantity > limit.Value)
            {
                throw new SubscriptionLimitExceededException(new SubscriptionLimitErrorModel
                {
                    Feature = feature,
                    Limit = limit,
                    Used = bucket.Used,
                    Reserved = bucket.Reserved,
                    ResetsAt = period.ResetsAt,
                    UpgradeAvailable = true,
                });
            }

            var reservation = new UsageReservation
            {
                UserId = userId,
                Feature = feature,
                Quantity = quantity,
                Status = UsageReservationStatus.Active,
                ExpiresAt = DateTime.UtcNow.Add(ReservationLifetime),
            };

            bucket.Reserved += quantity;
            bucket.EffectiveLimit = limit;
            bucket.Version++;
            dbContext.UsageReservations.Add(reservation);

            try
            {
                await dbContext.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                // Another request changed the bucket first — drop our pending changes and retry
                // with fresh values so the limit check is re-evaluated.
                dbContext.ChangeTracker.Clear();
                continue;
            }

            dbContext.UsageEntries.Add(new UsageEntry
            {
                UserId = userId,
                Feature = feature,
                UsageReservationId = reservation.Id,
                Quantity = quantity,
                Type = UsageEntryType.Reservation,
            });
            await dbContext.SaveChangesAsync();

            return SubscriptionMapper.ToModel(reservation);
        }

        throw new FitMateException("Could not reserve usage because of concurrent requests. Please retry.");
    }

    public Task CommitAsync(long reservationId) => FinalizeAsync(reservationId, commit: true);

    public Task ReleaseAsync(long reservationId) => FinalizeAsync(reservationId, commit: false);

    public async Task ExpireStaleReservationsAsync(long userId)
    {
        var now = DateTime.UtcNow;
        var stale = await dbContext.UsageReservations
            .Where(r => r.UserId == userId
                && r.Status == UsageReservationStatus.Active
                && r.ExpiresAt < now)
            .ToListAsync();

        foreach (var reservation in stale)
        {
            reservation.Status = UsageReservationStatus.Expired;
            reservation.FinalizedAt = now;
            await AdjustBucketAsync(reservation, commit: false);
            dbContext.UsageEntries.Add(new UsageEntry
            {
                UserId = reservation.UserId,
                Feature = reservation.Feature,
                UsageReservationId = reservation.Id,
                Quantity = reservation.Quantity,
                Type = UsageEntryType.Release,
            });
        }

        if (stale.Count > 0)
        {
            await dbContext.SaveChangesAsync();
        }
    }

    private async Task FinalizeAsync(long reservationId, bool commit)
    {
        var reservation = await dbContext.UsageReservations.FirstOrDefaultAsync(r => r.Id == reservationId);
        if (reservation == null || reservation.Status != UsageReservationStatus.Active)
        {
            return;   // idempotent
        }

        reservation.Status = commit ? UsageReservationStatus.Committed : UsageReservationStatus.Released;
        reservation.FinalizedAt = DateTime.UtcNow;
        await AdjustBucketAsync(reservation, commit);

        dbContext.UsageEntries.Add(new UsageEntry
        {
            UserId = reservation.UserId,
            Feature = reservation.Feature,
            UsageReservationId = reservation.Id,
            Quantity = reservation.Quantity,
            Type = commit ? UsageEntryType.Commit : UsageEntryType.Release,
        });

        await dbContext.SaveChangesAsync();
    }

    private async Task AdjustBucketAsync(UsageReservation reservation, bool commit)
    {
        var period = UsagePeriod.ForDate(DateOnly.FromDateTime(reservation.DateCreated));
        var bucket = await dbContext.UsageBuckets.FirstOrDefaultAsync(b =>
            b.UserId == reservation.UserId
            && b.Feature == reservation.Feature
            && b.PeriodStart == period.Start
            && b.PeriodEnd == period.End);

        if (bucket == null)
        {
            return;
        }

        bucket.Reserved = Math.Max(0, bucket.Reserved - reservation.Quantity);
        if (commit)
        {
            bucket.Used += reservation.Quantity;
        }
        bucket.Version++;
    }

    private async Task<UsageBucket> GetOrCreateBucketAsync(
        long userId,
        SubscriptionFeature feature,
        UsagePeriod period,
        int? limit)
    {
        var bucket = await dbContext.UsageBuckets.FirstOrDefaultAsync(b =>
            b.UserId == userId
            && b.Feature == feature
            && b.PeriodStart == period.Start
            && b.PeriodEnd == period.End);

        if (bucket != null)
        {
            return bucket;
        }

        bucket = new UsageBucket
        {
            UserId = userId,
            Feature = feature,
            PeriodStart = period.Start,
            PeriodEnd = period.End,
            EffectiveLimit = limit,
        };
        dbContext.UsageBuckets.Add(bucket);

        try
        {
            await dbContext.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // Lost the create race against a parallel request — reload the winner's row.
            dbContext.ChangeTracker.Clear();
            bucket = await dbContext.UsageBuckets.FirstAsync(b =>
                b.UserId == userId
                && b.Feature == feature
                && b.PeriodStart == period.Start
                && b.PeriodEnd == period.End);
        }

        return bucket;
    }
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter UsageServiceTests`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add server/FitMate.Services server/FitMate.Tests
git commit -m "feat(subscriptions): concurrency-safe usage reservations"
```

---

### Task 7: Wire entitlements into Program Plans (replaces Plan 01's hard rule)

**Files:**
- Modify: `server/FitMate.Services/ProgramPlans/ProgramPlanService.cs`
- Test: `server/FitMate.Tests/Unit/Services/SubscriptionLimitIntegrationTests.cs`
- Modify: `server/FitMate.Tests/Unit/Services/ProgramPlanServiceTests.cs` (constructor gains a 4th argument)

**Interfaces:**
- Consumes: `IEntitlementService`.
- Produces: `ProgramPlanService(AppDbContext, IProgramPlanScheduleService, IProgramPlanDayService, IEntitlementService)`. The `ActiveProgramPlans` `HardLimit` replaces the constant `1`; `ProgramPlanDurationMonths` bounds fixed-length plans.

- [ ] **Step 1: Write failing tests**

```csharp
using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.ProgramPlans;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.ProgramPlans;
using FitMate.Services.Subscriptions;
using FitMate.Tests.TestInfrastructure;
using Microsoft.Extensions.Caching.Memory;

namespace FitMate.Tests.Unit.Services;

public class SubscriptionLimitIntegrationTests
{
    private static async Task<long> SeedTemplateAsync(SqliteTestDatabase db, long userId, string name)
    {
        await using var context = db.CreateContext();
        var template = new WorkoutTemplate { UserId = userId, Name = name, IsPublic = false };
        context.WorkoutTemplates.Add(template);
        await context.SaveChangesAsync();
        return template.Id;
    }

    private static ProgramPlanService CreateProgramPlanService(SqliteTestDatabase db)
    {
        using (var seedContext = db.CreateContext())
        {
            SqliteTestDatabase.SeedPlans(seedContext);
        }

        var context = db.CreateContext();
        var entitlements = new EntitlementService(context, new MemoryCache(new MemoryCacheOptions()));
        var workoutService = TestWorkoutServiceFactory.Create(context);
        return new ProgramPlanService(
            context,
            new ProgramPlanScheduleService(),
            new ProgramPlanDayService(context, workoutService),
            entitlements);
    }

    private static SaveProgramPlanRequest PlanRequest(long templateId, DateOnly start, DateOnly? end) => new()
    {
        Name = "Limit test",
        Goal = TrainingGoal.Hypertrophy,
        ScheduleType = ProgramScheduleType.FixedWeekdays,
        StartDate = start,
        EndDate = end,
        TargetWorkoutsPerWeek = 1,
        ScheduleRules =
        [
            new ProgramScheduleRuleRequest
            {
                DayOfWeek = DayOfWeek.Monday,
                DayType = ProgramPlanDayType.Workout,
                WorkoutTemplateId = templateId,
                OrderIndex = 0,
            },
        ],
    };

    [Fact]
    public async Task Activate_SecondPlanOnFreePlan_ThrowsLimitException()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var service = CreateProgramPlanService(db);
        var start = new DateOnly(2026, 8, 3);

        var first = await service.CreateDraftAsync(PlanRequest(templateId, start, start.AddDays(21)), SqliteTestDatabase.UserId);
        await service.ActivateAsync(first.Id, SqliteTestDatabase.UserId);
        var second = await service.CreateDraftAsync(PlanRequest(templateId, start, start.AddDays(21)), SqliteTestDatabase.UserId);

        await Assert.ThrowsAsync<SubscriptionLimitExceededException>(() =>
            service.ActivateAsync(second.Id, SqliteTestDatabase.UserId));
    }

    [Fact]
    public async Task Activate_ThreeMonthPlanOnFreePlan_ThrowsLimitException()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var service = CreateProgramPlanService(db);
        var start = new DateOnly(2026, 8, 3);

        var plan = await service.CreateDraftAsync(PlanRequest(templateId, start, start.AddMonths(3)), SqliteTestDatabase.UserId);

        await Assert.ThrowsAsync<SubscriptionLimitExceededException>(() =>
            service.ActivateAsync(plan.Id, SqliteTestDatabase.UserId));
    }

    [Fact]
    public async Task Activate_ThreeMonthPlanOnPlusPlan_Succeeds()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        await using (var context = db.CreateContext())
        {
            SqliteTestDatabase.SeedPlans(context);
            context.UserSubscriptions.Add(new UserSubscription
            {
                UserId = SqliteTestDatabase.UserId,
                PlanId = SqliteTestDatabase.PlusPlanId,
                Status = SubscriptionStatus.Active,
            });
            await context.SaveChangesAsync();
        }
        var service = CreateProgramPlanService(db);
        var start = new DateOnly(2026, 8, 3);

        var plan = await service.CreateDraftAsync(PlanRequest(templateId, start, start.AddMonths(3)), SqliteTestDatabase.UserId);
        var activated = await service.ActivateAsync(plan.Id, SqliteTestDatabase.UserId);

        Assert.Equal(ProgramPlanStatus.Active, activated.Status);
    }

    [Fact]
    public async Task Activate_OpenEndedPlan_SkipsDurationCheck()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var service = CreateProgramPlanService(db);

        var plan = await service.CreateDraftAsync(
            PlanRequest(templateId, DateOnly.FromDateTime(DateTime.UtcNow), null),
            SqliteTestDatabase.UserId);
        var activated = await service.ActivateAsync(plan.Id, SqliteTestDatabase.UserId);

        Assert.Equal(ProgramPlanStatus.Active, activated.Status);
    }
}
```

> **Review decision (spec gap):** open-ended plans have no duration to compare against
> `ProgramPlanDurationMonths`, so the duration check is skipped for them on every plan tier. If
> open-ended programs should be a paid-only capability, add a dedicated entitlement later — do not
> repurpose the duration limit.

- [ ] **Step 2: Run — expect FAIL** (constructor arity + no entitlement checks)

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter SubscriptionLimitIntegrationTests`

- [ ] **Step 3: Implement** — in `ProgramPlanService`, add the field/constructor parameter and replace the
one-active block inside `ActivateAsync`:

```csharp
    private readonly IEntitlementService entitlementService;
```

```csharp
        // Replaces Plan 01's hard-coded single-active-plan rule.
        var activePlansEntitlement = await entitlementService.GetEntitlementAsync(
            userId,
            SubscriptionFeature.ActiveProgramPlans);
        if (activePlansEntitlement is not { IsEnabled: true })
        {
            throw new SubscriptionFeatureDisabledException(SubscriptionFeature.ActiveProgramPlans);
        }

        if (activePlansEntitlement.HardLimit is { } maxActivePlans)
        {
            var activeCount = await dbContext.ProgramPlans
                .CountAsync(p => p.UserId == userId && p.Status == ProgramPlanStatus.Active && p.Id != planId);
            if (activeCount >= maxActivePlans)
            {
                throw new SubscriptionLimitExceededException(new SubscriptionLimitErrorModel
                {
                    Feature = SubscriptionFeature.ActiveProgramPlans,
                    Limit = maxActivePlans,
                    Used = activeCount,
                    UpgradeAvailable = true,
                });
            }
        }

        if (plan.EndDate is { } endDate)
        {
            var durationEntitlement = await entitlementService.GetEntitlementAsync(
                userId,
                SubscriptionFeature.ProgramPlanDurationMonths);
            if (durationEntitlement?.HardLimit is { } maxMonths
                && endDate > plan.StartDate.AddMonths(maxMonths))
            {
                throw new SubscriptionLimitExceededException(new SubscriptionLimitErrorModel
                {
                    Feature = SubscriptionFeature.ProgramPlanDurationMonths,
                    Limit = maxMonths,
                    Used = maxMonths,
                    UpgradeAvailable = true,
                });
            }
        }
```

Add `using FitMate.Core.Exceptions; using FitMate.Core.JsonModels.Subscriptions; using FitMate.Services.Subscriptions;`.
Update the `CreateService` helpers in `ProgramPlanServiceTests.cs` and `ProgramPlanProgressTests.cs` to
pass a fourth argument (seed plans there too, so the Free plan's `ActiveProgramPlans = 1` keeps their
existing expectations valid — the "second active plan throws" test in Plan 01 now throws
`SubscriptionLimitExceededException`, which still satisfies its `ThrowsAnyAsync<Exception>` assertion).

- [ ] **Step 4: Run — expect PASS**, then the whole ProgramPlan suite

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter "SubscriptionLimitIntegrationTests|ProgramPlan"`

- [ ] **Step 5: Commit**

```bash
git add server/FitMate.Services server/FitMate.Tests
git commit -m "feat(subscriptions): program plan limits driven by entitlements"
```

---

### Task 8: Wire entitlements into templates and exercise history

**Files:**
- Modify: `server/FitMate.Services/WorkoutTemplates/WorkoutTemplateService.cs`
- Modify: `server/FitMate.Services/Workouts/WorkoutService.cs`
- Test: append to `server/FitMate.Tests/Unit/Services/SubscriptionLimitIntegrationTests.cs`

**Interfaces:**
- Produces: `WorkoutTemplateService` and `WorkoutService` each gain an `IEntitlementService` constructor
  parameter (appended last, so existing argument order is unchanged).

Rules:
- `WorkoutTemplateService.CreateAsync` and `CreateFromWorkoutAsync`: count the user's own templates
  (`UserId == userId`); if `CustomWorkoutTemplates.HardLimit` is non-null and the count is at or above
  it, throw `SubscriptionLimitExceededException`. `UpdateAsync` is never blocked.
- `WorkoutService.GetExerciseHistoryAsync`: clamp the query window to
  `ExerciseHistoryMonths.HardLimit` months back from today (null = no clamp).

- [ ] **Step 1: Write failing tests** (append)

```csharp
    [Fact]
    public async Task CreateTemplate_BeyondFreeLimit_ThrowsLimitException()
    {
        using var db = new SqliteTestDatabase();
        using (var seedContext = db.CreateContext())
        {
            SqliteTestDatabase.SeedPlans(seedContext);
        }

        // Free plan allows 5 custom templates.
        await using (var context = db.CreateContext())
        {
            for (var i = 0; i < 5; i++)
            {
                context.WorkoutTemplates.Add(new WorkoutTemplate
                {
                    UserId = SqliteTestDatabase.UserId,
                    Name = $"Template {i}",
                });
            }
            await context.SaveChangesAsync();
        }

        var context2 = db.CreateContext();
        var service = new FitMate.Services.WorkoutTemplates.WorkoutTemplateService(
            context2,
            new FakePhotoUrlResolver(),
            new EntitlementService(context2, new MemoryCache(new MemoryCacheOptions())));

        await Assert.ThrowsAsync<SubscriptionLimitExceededException>(() =>
            service.CreateAsync(
                new FitMate.Core.JsonModels.WorkoutTemplates.CreateWorkoutTemplateRequest { Name = "Sixth" },
                SqliteTestDatabase.UserId));
    }

    [Fact]
    public async Task CreateTemplate_UnderFreeLimit_Succeeds()
    {
        using var db = new SqliteTestDatabase();
        using (var seedContext = db.CreateContext())
        {
            SqliteTestDatabase.SeedPlans(seedContext);
        }

        var context = db.CreateContext();
        var service = new FitMate.Services.WorkoutTemplates.WorkoutTemplateService(
            context,
            new FakePhotoUrlResolver(),
            new EntitlementService(context, new MemoryCache(new MemoryCacheOptions())));

        var created = await service.CreateAsync(
            new FitMate.Core.JsonModels.WorkoutTemplates.CreateWorkoutTemplateRequest { Name = "First" },
            SqliteTestDatabase.UserId);

        Assert.Equal("First", created.Name);
    }
```

> Verify `WorkoutTemplateService`'s existing constructor signature (`AppDbContext`, `IPhotoUrlResolver`
> per `WorkoutTemplateServiceTests`) and append the entitlement service as the last parameter; update
> the existing `WorkoutTemplateServiceTests` construction lines accordingly (they will not compile
> otherwise — that is the intended signal).

- [ ] **Step 2: Run — expect FAIL**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter SubscriptionLimitIntegrationTests`

- [ ] **Step 3: Implement** — in `WorkoutTemplateService`, add the dependency and a guard called at the top
of `CreateAsync` and `CreateFromWorkoutAsync`:

```csharp
    private async Task RequireTemplateQuotaAsync(long userId)
    {
        var entitlement = await entitlementService.GetEntitlementAsync(
            userId,
            SubscriptionFeature.CustomWorkoutTemplates);

        if (entitlement is not { IsEnabled: true })
        {
            throw new SubscriptionFeatureDisabledException(SubscriptionFeature.CustomWorkoutTemplates);
        }

        if (entitlement.HardLimit is not { } maxTemplates)
        {
            return;   // unlimited
        }

        var owned = await dbContext.WorkoutTemplates.CountAsync(t => t.UserId == userId);
        if (owned >= maxTemplates)
        {
            throw new SubscriptionLimitExceededException(new SubscriptionLimitErrorModel
            {
                Feature = SubscriptionFeature.CustomWorkoutTemplates,
                Limit = maxTemplates,
                Used = owned,
                UpgradeAvailable = true,
            });
        }
    }
```

In `WorkoutService.GetExerciseHistoryAsync`, add the dependency and clamp before querying:

```csharp
        var historyEntitlement = await entitlementService.GetEntitlementAsync(
            userId,
            SubscriptionFeature.ExerciseHistoryMonths);
        DateTime? earliest = historyEntitlement?.HardLimit is { } months
            ? DateTime.UtcNow.AddMonths(-months)
            : null;
```

and add `&& (earliest == null || w.StartedAt >= earliest)` to the workout filter of that query
(match the existing property used for the session date — verify against the current implementation).

- [ ] **Step 4: Run — expect PASS**, then the full suite (`dotnet test server/FitMate.sln`) since two
widely-used service constructors changed.

- [ ] **Step 5: Commit**

```bash
git add server/FitMate.Services server/FitMate.Tests
git commit -m "feat(subscriptions): template count and exercise-history limits from entitlements"
```

---

### Task 9: Subscription API + DI

**Files:**
- Create: `server/FitMate.Web/Controllers/SubscriptionController.cs`
- Modify: `server/FitMate.Web/Program.cs`

**Interfaces:**
- Produces:

```
GET /api/subscriptions/me     → CurrentSubscriptionModel   (plan + status + all FeatureAvailabilityModel)
GET /api/subscriptions/plans  → SubscriptionPlanModel[]    (public + active plans, ordered by SortOrder)
GET /api/subscriptions/usage  → EffectiveEntitlementsModel (usage only; feeds /subscription/usage)
```

- [ ] **Step 1: Write the controller** (copy `WorkoutTemplateController`'s shape exactly)

```csharp
using FitMate.Core.JsonModels.Subscriptions;
using FitMate.DB;
using FitMate.Services.Subscriptions;
using FitMate.Services.Users;
using FitMate.Web.Controllers.Base;
using FitMate.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Web.Controllers;

[Authorize]
[Route("api/subscriptions")]
public class SubscriptionController : BaseApiController
{
    private readonly IEntitlementService entitlementService;

    public SubscriptionController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService,
        IEntitlementService entitlementService)
        : base(logger, dbContext, userService)
    {
        this.entitlementService = entitlementService;
    }

    [HttpGet("me")]
    public async Task<ActionResult> GetMine()
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var entitlements = await entitlementService.GetAllAsync(userId.Value);
        var subscription = await DbContext.UserSubscriptions
            .AsNoTracking()
            .Where(s => s.UserId == userId.Value)
            .OrderByDescending(s => s.DateCreated)
            .FirstOrDefaultAsync();

        return this.ReturnJson(new CurrentSubscriptionModel
        {
            PlanId = entitlements.PlanId,
            PlanCode = entitlements.PlanCode,
            PlanName = entitlements.PlanName,
            Source = entitlements.Source,
            Status = subscription?.Status,
            CurrentPeriodEnd = subscription?.CurrentPeriodEnd,
            CancelAtPeriodEnd = subscription?.CancelAtPeriodEnd ?? false,
            Features = entitlements.Features,
        });
    }

    [HttpGet("plans")]
    public async Task<ActionResult> GetPlans()
    {
        var plans = await DbContext.Plans
            .AsNoTracking()
            .Include(p => p.Prices)
            .Include(p => p.Entitlements)
            .Where(p => p.IsActive && p.IsPublic)
            .OrderBy(p => p.SortOrder)
            .ToListAsync();

        return this.ReturnJson(plans.Select(SubscriptionMapper.ToModel).ToList());
    }

    [HttpGet("usage")]
    public async Task<ActionResult> GetUsage()
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        return this.ReturnJson(await entitlementService.GetAllAsync(userId.Value));
    }
}
```

> Verify `BaseApiController` exposes the `AppDbContext` as `DbContext` (check
> `server/FitMate.Web/Controllers/Base/BaseApiController.cs`); if the protected member has a different
> name, use that. If it is not exposed at all, inject `AppDbContext` as a private field instead.

- [ ] **Step 2: Register DI** — in `Program.cs`, after `IWorkoutTemplateService` (and confirm
`builder.Services.AddMemoryCache();` is present — add it if not):

```csharp
builder.Services.AddMemoryCache();
builder.Services.AddScoped<IEntitlementService, EntitlementService>();
builder.Services.AddScoped<IUsageService, UsageService>();
```

- [ ] **Step 3: Build + regenerate types**

Run: `dotnet build server/FitMate.Web/FitMate.Web.csproj`
Then: `cd client && npm run process-types && npx tsc -b --noEmit`
Expected: `client/src/types/backend.ts` contains `CurrentSubscriptionModel`, `FeatureAvailabilityModel`,
`SubscriptionPlanModel`, `EffectiveEntitlementsModel`, `SubscriptionFeature`, `SubscriptionStatus`.

- [ ] **Step 4: Commit**

```bash
git add server/FitMate.Web client/src/types
git commit -m "feat(subscriptions): subscription API and DI registration"
```

---

### Task 10: Frontend — usage page

**Files:**
- Create: `client/src/services/subscriptionService.ts`
- Create: `client/src/pages/Subscription/Subscription.tsx`, `components/UsageBar.tsx`, `hooks/useSubscriptionPage.ts`, `index.ts`
- Modify: `client/src/routes.tsx`

**Interfaces:**
- Consumes: generated types only (`CurrentSubscriptionModel`, `FeatureAvailabilityModel`, `SubscriptionFeature`).
- Produces: routes `/subscription` and `/subscription/usage` (both render the same page; the plan-cards
  page `/subscription/plans` arrives with Plan 09).

- [ ] **Step 1: Write the service** (object-literal pattern, matching `workoutTemplateService.ts`)

```typescript
import api from "@/lib/api";
import type {
  CurrentSubscriptionModel,
  EffectiveEntitlementsModel,
  JsonData,
  SubscriptionPlanModel,
} from "@/types";

export const subscriptionService = {
  async getMine() {
    return api.get<JsonData<CurrentSubscriptionModel>>("subscriptions/me");
  },

  async getPlans() {
    return api.get<JsonData<SubscriptionPlanModel[]>>("subscriptions/plans");
  },

  async getUsage() {
    return api.get<JsonData<EffectiveEntitlementsModel>>("subscriptions/usage");
  },
};
```

- [ ] **Step 2: Write the hook**

```typescript
import { useCallback, useEffect, useState } from "react";
import { subscriptionService } from "@/services/subscriptionService";
import type { CurrentSubscriptionModel } from "@/types";

export function useSubscriptionPage() {
  const [subscription, setSubscription] = useState<CurrentSubscriptionModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await subscriptionService.getMine();
      if (!response.data.success || !response.data.data) {
        setError(response.data.error ?? "Could not load your subscription.");
        return;
      }
      setSubscription(response.data.data);
    } catch {
      setError("Could not load your subscription.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { subscription, isLoading, error, reload: load };
}
```

> Uses `async/await` throughout — no `.then()`/`.catch()` chains (user preference). Verify the
> `JsonData<T>` field names (`success`/`data`/`error`) against `client/src/types/index.ts`.

- [ ] **Step 3: Write `UsageBar`**

```tsx
import type { FeatureAvailabilityModel } from "@/types";

const FEATURE_LABELS: Record<number, string> = {
  1: "AI chat messages",
  2: "AI workout generation",
  3: "AI program generation",
  4: "Exercise recognition",
  5: "AI image generation",
  6: "AI training analysis",
  20: "Active program plans",
  21: "Program length (months)",
  22: "Custom workout templates",
  23: "Exercise history (months)",
};

interface UsageBarProps {
  availability: FeatureAvailabilityModel;
}

export default function UsageBar({ availability }: UsageBarProps) {
  const label = FEATURE_LABELS[availability.feature] ?? `Feature ${availability.feature}`;

  if (!availability.isEnabled) {
    return (
      <div className="flex items-center justify-between py-2">
        <span className="text-sm text-neutral-500">{label}</span>
        <span className="text-xs font-medium text-neutral-400">Not included</span>
      </div>
    );
  }

  if (availability.limit === null || availability.limit === undefined) {
    return (
      <div className="flex items-center justify-between py-2">
        <span className="text-sm">{label}</span>
        <span className="text-xs font-medium text-emerald-600">Unlimited</span>
      </div>
    );
  }

  const used = availability.used + availability.reserved;
  const percentage = availability.limit === 0 ? 100 : Math.min(100, (used / availability.limit) * 100);

  return (
    <div className="py-2">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="text-neutral-500">
          {used} of {availability.limit} used
        </span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
        <div
          className={percentage >= 100 ? "h-full bg-red-500" : "h-full bg-emerald-500"}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
```

> Match the repo's actual styling approach before writing this — check whether pages use Tailwind
> classes (there is a `tailwind.config.mjs`) or MUI `sx` props, and follow whichever the neighbouring
> pages under `client/src/pages` use.

- [ ] **Step 4: Write the page + route**

```tsx
import UsageBar from "./components/UsageBar";
import { useSubscriptionPage } from "./hooks/useSubscriptionPage";

export default function Subscription() {
  const { subscription, isLoading, error } = useSubscriptionPage();

  if (isLoading) {
    return <div className="p-4">Loading…</div>;
  }

  if (error || !subscription) {
    return <div className="p-4 text-red-600">{error ?? "Could not load your subscription."}</div>;
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-4">
      <section>
        <h1 className="text-xl font-semibold">{subscription.planName}</h1>
        {subscription.currentPeriodEnd && (
          <p className="text-sm text-neutral-500">
            {subscription.cancelAtPeriodEnd ? "Ends" : "Renews"} on{" "}
            {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-neutral-500">
          This month
        </h2>
        {subscription.features.map((feature) => (
          <UsageBar key={feature.feature} availability={feature} />
        ))}
      </section>
    </div>
  );
}
```

`index.ts`: `export { default } from "./Subscription";`

In `routes.tsx`, add inside the authenticated section (follow the existing `AccessGate` usage of
neighbouring authenticated routes):

```tsx
      {
        path: "subscription",
        element: (
          <AccessGate>
            <Subscription />
          </AccessGate>
        ),
      },
      {
        path: "subscription/usage",
        element: (
          <AccessGate>
            <Subscription />
          </AccessGate>
        ),
      },
```

with `import Subscription from "./pages/Subscription";` at the top.

- [ ] **Step 5: Verify**

Run: `cd client && npm run lint && npx tsc -b --noEmit`
Expected: clean. Manual check: log in, open `/subscription`, confirm the Free plan shows
"AI chat messages 0 of 10 used" and "AI program generation — Not included".

- [ ] **Step 6: Commit**

```bash
git add client/src
git commit -m "feat(subscriptions): subscription and usage page"
```

---

### Task 11: Integration tests (seeding, 403/429 envelopes, ownership)

**Files:**
- Create: `server/FitMate.Tests/Integration/SubscriptionApiTests.cs`

**Interfaces:** consumes `TestWebApplicationFactory`, `IntegrationTestExtensions` (`CreateApiClient`,
`CreateUserClientAsync`), `ApiResponse<T>`.

- [ ] **Step 1: Write tests**

```csharp
using System.Net;
using System.Net.Http.Json;
using FitMate.Core.JsonModels.Subscriptions;
using FitMate.DB;
using FitMate.DB.Constants;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitMate.Tests.Integration;

public class SubscriptionApiTests
{
    [Fact]
    public async Task SubscriptionEndpoints_WithoutAuth_Return401()
    {
        using var factory = new TestWebApplicationFactory();
        var client = factory.CreateApiClient();

        var response = await client.GetAsync("/api/subscriptions/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Seeding_CreatesThreePlansExactlyOnce()
    {
        using var factory = new TestWebApplicationFactory();
        _ = factory.CreateApiClient();   // forces host startup + seeding

        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var codes = await context.Plans.Select(p => p.Code).ToListAsync();
        Assert.Equal(3, codes.Count);
        Assert.Contains(PlanCodes.Free, codes);
        Assert.Contains(PlanCodes.Plus, codes);
        Assert.Contains(PlanCodes.Pro, codes);
        Assert.Equal(codes.Count, codes.Distinct().Count());
    }

    [Fact]
    public async Task GetMine_NewUser_ReturnsFreePlanWithUsage()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateUserClientAsync("subscriber@test.local");

        var response = await client.GetAsync("/api/subscriptions/me");
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<CurrentSubscriptionModel>>();

        Assert.True(body!.Success);
        Assert.Equal(PlanCodes.Free, body.Data!.PlanCode);
        Assert.NotEmpty(body.Data.Features);
    }

    [Fact]
    public async Task GetPlans_ReturnsPublicPlansOrdered()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateUserClientAsync("plan-viewer@test.local");

        var response = await client.GetAsync("/api/subscriptions/plans");
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<List<SubscriptionPlanModel>>>();

        Assert.True(body!.Success);
        Assert.Equal(3, body.Data!.Count);
        Assert.Equal(PlanCodes.Free, body.Data[0].Code);
    }
}
```

> If `TestWebApplicationFactory` bypasses `SeedDatabase` (check its `ConfigureWebHost`), either enable
> plan seeding there or seed plans in the fixture — record which you did in the commit message. The
> `GetMine` test cannot pass without the Free plan existing.

- [ ] **Step 2: Run — expect PASS**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter SubscriptionApiTests`

- [ ] **Step 3: Run the full suite**

Run: `dotnet test server/FitMate.sln`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/FitMate.Tests
git commit -m "test(subscriptions): integration coverage for seeding and subscription API"
```

---

## Acceptance criteria (Plan 04 done)

- Features can be enabled/disabled and limited per plan purely from database rows — no limit constants remain in service code (`grep -rn "MonthlyLimit\|HardLimit" server/FitMate.Services` shows only entitlement reads).
- Effective plan resolves override → active subscription → Free, and a deactivated plan degrades to Free.
- `ReserveAsync`/`CommitAsync`/`ReleaseAsync` are concurrency-safe (the last-unit race test passes), idempotent, and expire stale reservations.
- Program plan activation enforces `ActiveProgramPlans` and `ProgramPlanDurationMonths`; template creation enforces `CustomWorkoutTemplates`; exercise history is clamped to `ExerciseHistoryMonths`.
- Disabled feature → HTTP 403; exhausted quota → HTTP 429 with the spec §49 body.
- `GET /api/subscriptions/me` drives a working `/subscription` page showing per-feature usage.
- `dotnet build server/FitMate.sln` + `dotnet test server/FitMate.sln` green; `npm run lint` and `npx tsc -b --noEmit` clean.

## Handoff notes for later plans

- **Plan 05/06/07/10** call `IEntitlementService.RequireFeatureAsync` + `IUsageService.ReserveAsync/CommitAsync/ReleaseAsync` exactly as written above; the namespace is `FitMate.Services.Subscriptions`.
- **Plan 09** must call `IEntitlementService.Invalidate(userId)` after every webhook that changes a subscription, and populates `UserSubscription` + `PlanPrice.StripePriceId`.
- **Plan 08** edits `Plan`/`PlanEntitlement` rows and must call `Invalidate` for affected users (or accept the 60-second cache delay — state which in that plan).
- **Plan 11** calls `IUsageService.ExpireStaleReservationsAsync` from the maintenance job for all users, not just on-demand.
