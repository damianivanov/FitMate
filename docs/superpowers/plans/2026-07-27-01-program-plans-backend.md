# Program Plans Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users create a training program from workout templates (fixed weekdays, rotation, or custom calendar; fixed-length **or** open-ended), activate it, and the API deterministically answers "what should I train today", with start/complete/move/skip/restore and progress tracking.

**Architecture:** New `ProgramPlan` → `ProgramPlanScheduleRule` (the recurring pattern) → `ProgramPlanDay` (persisted concrete calendar) entity chain in FitMate.DB. `ProgramPlanScheduleService` is a pure generator that expands rules into dated `ProgramPlanDay` rows; `ProgramPlanService` owns lifecycle (draft → active → completed/cancelled); `ProgramPlanDayService` owns per-day actions (start/move/skip/restore/missed). Workouts link back via `Workout.ProgramPlanDayId`; finishing a workout completes its program day. The home "today" endpoint only reads persisted rows — no AI, no on-the-fly schedule math.

**Tech Stack:** .NET 9, EF Core + Npgsql (Sqlite in tests), xUnit, existing FitMate service/controller conventions, Reinforced.Typings type export.

## Global Constraints

- Follow repo conventions (roadmap D4): services take `(request, long userId)`, no CancellationToken; controllers extend `BaseApiController` and use `ReturnJson`/`ReturnJsonError`; DTOs in `FitMate.Core/JsonModels/ProgramPlans/`; enums in `FitMate.DB/Enums`; entity configs in `FitMate.DB/Configurations`.
- `EndDate` is **nullable** (roadmap D1): null = open-ended plan with a rolling 28-day generated horizon.
- One active plan per user (roadmap D3) — enforced in `ActivateAsync`, in one place, so Plan 04 can swap in the entitlement lookup.
- "Today" uses a client-supplied `date` query parameter, falling back to `DateOnly.FromDateTime(DateTime.UtcNow)` (roadmap D2).
- Persist Workout / OptionalWorkout / Recovery / Deload days; do NOT persist plain Rest days (spec §23) — absence of a row on a date means rest.
- Start endpoint must be idempotent; activation and start run inside transactions.
- `AppDbContext.SaveChangesAsync()` stamps `DateCreated`/`DateModified` — never set them manually.
- After backend DTO changes: `dotnet build server/FitMate.Web/FitMate.Web.csproj` regenerates `client/src/types/backend.ts`; run `npm run process-types` in `client/` (Plan 02 consumes them).
- All commands run from repo root `c:\Users\damian\Documents\Github\FitMate`.

## File Structure

```
server/FitMate.DB/
├── Enums/TrainingGoal.cs, ProgramPlanStatus.cs, ProgramScheduleType.cs,
│         ProgramPlanDayType.cs, ProgramPlanDayStatus.cs          (Task 1)
├── Entities/ProgramPlan.cs, ProgramPlanScheduleRule.cs, ProgramPlanDay.cs
│         Workout.cs (modify)                                     (Task 1)
├── Configurations/ProgramPlanConfiguration.cs,
│         ProgramPlanScheduleRuleConfiguration.cs, ProgramPlanDayConfiguration.cs,
│         WorkoutConfiguration.cs (modify)                        (Task 1)
├── AppDbContext.cs (modify: 3 DbSets)                            (Task 1)
└── Migrations/xxx_AddProgramPlans.cs (generated)                 (Task 1)

server/FitMate.Core/JsonModels/ProgramPlans/
├── ProgramPlanModel.cs, ProgramPlanScheduleRuleModel.cs, ProgramPlanDayModel.cs,
│   ProgramTodayModel.cs, ProgramProgressModel.cs,
│   SaveProgramPlanRequest.cs, ProgramScheduleRuleRequest.cs,
│   CustomProgramDayRequest.cs, MoveProgramDayRequest.cs          (Task 2)

server/FitMate.Services/ProgramPlans/
├── IProgramPlanScheduleService.cs, ProgramPlanScheduleService.cs (Task 3)
├── IProgramPlanService.cs, ProgramPlanService.cs                 (Tasks 4–5, 8–9)
├── IProgramPlanDayService.cs, ProgramPlanDayService.cs           (Tasks 6, 8)
├── ProgramPlanMapper.cs                                          (Task 2)
└── ProgramPlanValidator.cs                                       (Task 4)

server/FitMate.Services/Workouts/WorkoutService.cs (modify)       (Tasks 6–7)
server/FitMate.Web/Controllers/ProgramPlanController.cs           (Task 10)
server/FitMate.Web/Controllers/ProgramPlanDayController.cs        (Task 10)
server/FitMate.Web/Program.cs (modify: DI)                        (Task 10)

server/FitMate.Tests/Unit/Services/
├── ProgramPlanScheduleServiceTests.cs                            (Task 3)
├── ProgramPlanServiceTests.cs                                    (Tasks 4–5, 9)
├── ProgramPlanDayServiceTests.cs                                 (Tasks 6–8)
└── ProgramPlanProgressTests.cs                                   (Task 9)
```

---

### Task 1: Enums, entities, EF configuration, migration

**Files:**
- Create: `server/FitMate.DB/Enums/TrainingGoal.cs`, `ProgramPlanStatus.cs`, `ProgramScheduleType.cs`, `ProgramPlanDayType.cs`, `ProgramPlanDayStatus.cs`
- Create: `server/FitMate.DB/Entities/ProgramPlan.cs`, `ProgramPlanScheduleRule.cs`, `ProgramPlanDay.cs`
- Modify: `server/FitMate.DB/Entities/Workout.cs` (add `ProgramPlanDayId`)
- Create: `server/FitMate.DB/Configurations/ProgramPlanConfiguration.cs`, `ProgramPlanScheduleRuleConfiguration.cs`, `ProgramPlanDayConfiguration.cs`
- Modify: `server/FitMate.DB/Configurations/WorkoutConfiguration.cs`, `server/FitMate.DB/AppDbContext.cs`
- Test: `server/FitMate.Tests/Unit/Database/AppDbContextTests.cs` (existing suite must still pass — `EnsureCreated` exercises the new model)

**Interfaces:**
- Consumes: `BaseEntity`, existing `Workout`, `WorkoutTemplate`, `User` entities.
- Produces: the three entities + five enums exactly as below; every later task uses these property names.

- [ ] **Step 1: Write the enums** (one file each, namespace `FitMate.DB.Enums`)

```csharp
namespace FitMate.DB.Enums;

public enum TrainingGoal
{
    GeneralFitness = 1,
    Hypertrophy = 2,
    Strength = 3,
    FatLoss = 4,
    Endurance = 5,
    Maintenance = 6,
}

public enum ProgramPlanStatus
{
    Draft = 1,
    Active = 2,
    Paused = 3,
    Completed = 4,
    Cancelled = 5,
}

public enum ProgramScheduleType
{
    FixedWeekdays = 1,
    Rotation = 2,
    CustomCalendar = 3,
}

public enum ProgramPlanDayType
{
    Workout = 1,
    Rest = 2,
    OptionalWorkout = 3,
    Recovery = 4,
    Deload = 5,
}

public enum ProgramPlanDayStatus
{
    Scheduled = 1,
    Started = 2,
    Completed = 3,
    Skipped = 4,
    Missed = 5,
    Rescheduled = 6,
    Cancelled = 7,
}
```

- [ ] **Step 2: Write the entities**

`server/FitMate.DB/Entities/ProgramPlan.cs`:

```csharp
using FitMate.DB.Entities.Base;
using FitMate.DB.Enums;

namespace FitMate.DB.Entities;

public class ProgramPlan : BaseEntity
{
    public long UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public TrainingGoal Goal { get; set; }
    public ProgramPlanStatus Status { get; set; }
    public ProgramScheduleType ScheduleType { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly? EndDate { get; set; }          // null = open-ended ("keeps going")
    public int TargetWorkoutsPerWeek { get; set; }
    public bool IsAiGenerated { get; set; }
    public long? SourceAiActionId { get; set; }     // plain column; FK added in Plan 06
    public DateTime? ActivatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }

    public User User { get; set; } = null!;
    public ICollection<ProgramPlanScheduleRule> ScheduleRules { get; set; } = [];
    public ICollection<ProgramPlanDay> Days { get; set; } = [];
}
```

`server/FitMate.DB/Entities/ProgramPlanScheduleRule.cs`:

```csharp
using FitMate.DB.Entities.Base;
using FitMate.DB.Enums;

namespace FitMate.DB.Entities;

public class ProgramPlanScheduleRule : BaseEntity
{
    public long ProgramPlanId { get; set; }
    public DayOfWeek? DayOfWeek { get; set; }       // FixedWeekdays only
    public int? RotationDayIndex { get; set; }      // Rotation only, 1-based sequential
    public ProgramPlanDayType DayType { get; set; }
    public long? WorkoutTemplateId { get; set; }
    public int WeekInterval { get; set; } = 1;
    public int OrderIndex { get; set; }
    public bool IsOptional { get; set; }

    public ProgramPlan ProgramPlan { get; set; } = null!;
    public WorkoutTemplate? WorkoutTemplate { get; set; }
}
```

`server/FitMate.DB/Entities/ProgramPlanDay.cs`:

```csharp
using FitMate.DB.Entities.Base;
using FitMate.DB.Enums;

namespace FitMate.DB.Entities;

public class ProgramPlanDay : BaseEntity
{
    public long ProgramPlanId { get; set; }
    public DateOnly ScheduledDate { get; set; }
    public DateOnly? OriginalScheduledDate { get; set; }
    public ProgramPlanDayType DayType { get; set; }
    public ProgramPlanDayStatus Status { get; set; }
    public long? WorkoutTemplateId { get; set; }
    public long? StartedWorkoutId { get; set; }
    public long? CompletedWorkoutId { get; set; }
    public string? Notes { get; set; }
    public int OrderIndex { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }

    public ProgramPlan ProgramPlan { get; set; } = null!;
    public WorkoutTemplate? WorkoutTemplate { get; set; }
    public Workout? StartedWorkout { get; set; }
    public Workout? CompletedWorkout { get; set; }
}
```

Modify `server/FitMate.DB/Entities/Workout.cs` — add after `WorkoutTemplateId`:

```csharp
    public long? ProgramPlanDayId { get; set; }
```

and after the `WorkoutTemplate` navigation:

```csharp
    public ProgramPlanDay? ProgramPlanDay { get; set; }
```

- [ ] **Step 3: Write the configurations** (mirror the style of `WorkoutConfiguration.cs` — read it first and copy its structure)

`ProgramPlanConfiguration.cs`:

```csharp
using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

public class ProgramPlanConfiguration : IEntityTypeConfiguration<ProgramPlan>
{
    public void Configure(EntityTypeBuilder<ProgramPlan> builder)
    {
        builder.Property(x => x.Name).HasMaxLength(200).IsRequired();
        builder.Property(x => x.Description).HasMaxLength(2000);

        builder.HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => x.UserId);
        builder.HasIndex(x => new { x.UserId, x.Status });
        builder.HasIndex(x => x.StartDate);
        builder.HasIndex(x => x.EndDate);
    }
}
```

`ProgramPlanScheduleRuleConfiguration.cs`:

```csharp
using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

public class ProgramPlanScheduleRuleConfiguration : IEntityTypeConfiguration<ProgramPlanScheduleRule>
{
    public void Configure(EntityTypeBuilder<ProgramPlanScheduleRule> builder)
    {
        builder.HasOne(x => x.ProgramPlan)
            .WithMany(x => x.ScheduleRules)
            .HasForeignKey(x => x.ProgramPlanId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.WorkoutTemplate)
            .WithMany()
            .HasForeignKey(x => x.WorkoutTemplateId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(x => x.ProgramPlanId);
    }
}
```

`ProgramPlanDayConfiguration.cs`:

```csharp
using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

public class ProgramPlanDayConfiguration : IEntityTypeConfiguration<ProgramPlanDay>
{
    public void Configure(EntityTypeBuilder<ProgramPlanDay> builder)
    {
        builder.Property(x => x.Notes).HasMaxLength(1000);

        builder.HasOne(x => x.ProgramPlan)
            .WithMany(x => x.Days)
            .HasForeignKey(x => x.ProgramPlanId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.WorkoutTemplate)
            .WithMany()
            .HasForeignKey(x => x.WorkoutTemplateId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.StartedWorkout)
            .WithMany()
            .HasForeignKey(x => x.StartedWorkoutId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(x => x.CompletedWorkout)
            .WithMany()
            .HasForeignKey(x => x.CompletedWorkoutId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(x => new { x.ProgramPlanId, x.ScheduledDate, x.OrderIndex }).IsUnique();
        builder.HasIndex(x => new { x.ProgramPlanId, x.Status });
    }
}
```

In `WorkoutConfiguration.cs` add (inside `Configure`):

```csharp
        builder.HasOne(x => x.ProgramPlanDay)
            .WithMany()
            .HasForeignKey(x => x.ProgramPlanDayId)
            .OnDelete(DeleteBehavior.SetNull);
```

In `AppDbContext.cs` add after the `PersonalRecords` DbSet:

```csharp
    public DbSet<ProgramPlan> ProgramPlans => Set<ProgramPlan>();
    public DbSet<ProgramPlanScheduleRule> ProgramPlanScheduleRules => Set<ProgramPlanScheduleRule>();
    public DbSet<ProgramPlanDay> ProgramPlanDays => Set<ProgramPlanDay>();
```

(Configurations are picked up however the existing ones are — check `OnModelCreating`; if configs are applied one-by-one, add the three new ones the same way.)

- [ ] **Step 4: Build and run existing tests** (model must be valid for Sqlite `EnsureCreated`)

Run: `dotnet build server/FitMate.sln` then `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter AppDbContextTests`
Expected: build OK, tests PASS.

- [ ] **Step 5: Add migration**

Run: `dotnet ef migrations add AddProgramPlans --project server/FitMate.DB --startup-project server/FitMate.Web`
Expected: migration adds 3 tables + `ProgramPlanDayId` column on `Workouts`, with the unique index on `(ProgramPlanId, ScheduledDate, OrderIndex)`. Inspect the generated file — no drops of existing tables/columns.

- [ ] **Step 6: Commit**

```bash
git add server/FitMate.DB docs/superpowers/plans
git commit -m "feat(program-plans): add ProgramPlan entities, enums and migration"
```

---

### Task 2: DTOs (JsonModels) + mapper

**Files:**
- Create: all files in `server/FitMate.Core/JsonModels/ProgramPlans/` listed below
- Create: `server/FitMate.Services/ProgramPlans/ProgramPlanMapper.cs`

**Interfaces:**
- Consumes: Task 1 entities/enums.
- Produces: `ProgramPlanModel`, `ProgramPlanScheduleRuleModel`, `ProgramPlanDayModel`, `ProgramTodayModel`, `ProgramProgressModel`, `SaveProgramPlanRequest`, `ProgramScheduleRuleRequest`, `CustomProgramDayRequest`, `MoveProgramDayRequest`, and static `ProgramPlanMapper.ToModel(...)` overloads. All later tasks and the frontend (via generated types) use these names.

- [ ] **Step 1: Write the request DTOs** (namespace `FitMate.Core.JsonModels.ProgramPlans`; enums referenced from `FitMate.DB.Enums` — same pattern as `CreateWorkoutTemplateExerciseRequest` which uses `FitMate.DB.Enums.ExerciseGroupType`)

```csharp
using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.ProgramPlans;

public class SaveProgramPlanRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public TrainingGoal Goal { get; set; }
    public ProgramScheduleType ScheduleType { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public int TargetWorkoutsPerWeek { get; set; }
    public List<ProgramScheduleRuleRequest> ScheduleRules { get; set; } = [];
    public List<CustomProgramDayRequest> CustomDays { get; set; } = [];
}

public class ProgramScheduleRuleRequest
{
    public DayOfWeek? DayOfWeek { get; set; }
    public int? RotationDayIndex { get; set; }
    public ProgramPlanDayType DayType { get; set; }
    public long? WorkoutTemplateId { get; set; }
    public int WeekInterval { get; set; } = 1;
    public int OrderIndex { get; set; }
    public bool IsOptional { get; set; }
}

public class CustomProgramDayRequest
{
    public DateOnly Date { get; set; }
    public ProgramPlanDayType DayType { get; set; }
    public long? WorkoutTemplateId { get; set; }
    public string? Notes { get; set; }
}

public class MoveProgramDayRequest
{
    public DateOnly NewDate { get; set; }
}
```

- [ ] **Step 2: Write the response DTOs**

```csharp
using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.ProgramPlans;

public class ProgramPlanModel
{
    public long Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public TrainingGoal Goal { get; set; }
    public ProgramPlanStatus Status { get; set; }
    public ProgramScheduleType ScheduleType { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public int TargetWorkoutsPerWeek { get; set; }
    public bool IsAiGenerated { get; set; }
    public DateTime? ActivatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public List<ProgramPlanScheduleRuleModel> ScheduleRules { get; set; } = [];
}

public class ProgramPlanScheduleRuleModel
{
    public long Id { get; set; }
    public DayOfWeek? DayOfWeek { get; set; }
    public int? RotationDayIndex { get; set; }
    public ProgramPlanDayType DayType { get; set; }
    public long? WorkoutTemplateId { get; set; }
    public string? WorkoutTemplateName { get; set; }
    public int WeekInterval { get; set; }
    public int OrderIndex { get; set; }
    public bool IsOptional { get; set; }
}

public class ProgramPlanDayModel
{
    public long Id { get; set; }
    public long ProgramPlanId { get; set; }
    public DateOnly ScheduledDate { get; set; }
    public DateOnly? OriginalScheduledDate { get; set; }
    public ProgramPlanDayType DayType { get; set; }
    public ProgramPlanDayStatus Status { get; set; }
    public long? WorkoutTemplateId { get; set; }
    public string? WorkoutTemplateName { get; set; }
    public int? EstimatedDurationMinutes { get; set; }
    public int ExerciseCount { get; set; }
    public long? StartedWorkoutId { get; set; }
    public long? CompletedWorkoutId { get; set; }
    public string? Notes { get; set; }
}

public class ProgramTodayModel
{
    public DateOnly Date { get; set; }
    public bool HasActiveProgram { get; set; }
    public long? ProgramId { get; set; }
    public string? ProgramName { get; set; }
    public ProgramPlanDayModel? Today { get; set; }
    public ProgramPlanDayModel? MissedWorkout { get; set; }
    public ProgramPlanDayModel? NextWorkout { get; set; }
}

public class ProgramProgressModel
{
    public int ScheduledWorkouts { get; set; }
    public int CompletedWorkouts { get; set; }
    public int StartedWorkouts { get; set; }
    public int MissedWorkouts { get; set; }
    public int SkippedWorkouts { get; set; }
    public int RemainingWorkouts { get; set; }
    public decimal? CompletionPercentage { get; set; }   // null for open-ended plans
    public decimal AdherencePercentage { get; set; }
    public int CurrentStreak { get; set; }
}
```

- [ ] **Step 3: Write the mapper** (`server/FitMate.Services/ProgramPlans/ProgramPlanMapper.cs`)

```csharp
using FitMate.Core.JsonModels.ProgramPlans;
using FitMate.DB.Entities;

namespace FitMate.Services.ProgramPlans;

public static class ProgramPlanMapper
{
    public static ProgramPlanModel ToModel(ProgramPlan plan) => new()
    {
        Id = plan.Id,
        Name = plan.Name,
        Description = plan.Description,
        Goal = plan.Goal,
        Status = plan.Status,
        ScheduleType = plan.ScheduleType,
        StartDate = plan.StartDate,
        EndDate = plan.EndDate,
        TargetWorkoutsPerWeek = plan.TargetWorkoutsPerWeek,
        IsAiGenerated = plan.IsAiGenerated,
        ActivatedAt = plan.ActivatedAt,
        CompletedAt = plan.CompletedAt,
        ScheduleRules = plan.ScheduleRules
            .OrderBy(r => r.OrderIndex)
            .Select(ToModel)
            .ToList(),
    };

    public static ProgramPlanScheduleRuleModel ToModel(ProgramPlanScheduleRule rule) => new()
    {
        Id = rule.Id,
        DayOfWeek = rule.DayOfWeek,
        RotationDayIndex = rule.RotationDayIndex,
        DayType = rule.DayType,
        WorkoutTemplateId = rule.WorkoutTemplateId,
        WorkoutTemplateName = rule.WorkoutTemplate?.Name,
        WeekInterval = rule.WeekInterval,
        OrderIndex = rule.OrderIndex,
        IsOptional = rule.IsOptional,
    };

    public static ProgramPlanDayModel ToModel(ProgramPlanDay day) => new()
    {
        Id = day.Id,
        ProgramPlanId = day.ProgramPlanId,
        ScheduledDate = day.ScheduledDate,
        OriginalScheduledDate = day.OriginalScheduledDate,
        DayType = day.DayType,
        Status = day.Status,
        WorkoutTemplateId = day.WorkoutTemplateId,
        WorkoutTemplateName = day.WorkoutTemplate?.Name,
        EstimatedDurationMinutes = day.WorkoutTemplate?.EstimatedDurationMinutes,
        ExerciseCount = day.WorkoutTemplate?.ExerciseGroups?.Sum(g => g.Exercises?.Count ?? 0) ?? 0,
        StartedWorkoutId = day.StartedWorkoutId,
        CompletedWorkoutId = day.CompletedWorkoutId,
        Notes = day.Notes,
    };
}
```

> Note: check `TemplateExerciseGroup`'s actual collection property name before using `g.Exercises` —
> open `server/FitMate.DB/Entities/TemplateExerciseGroup.cs` and use its real name (the
> `WorkoutTemplateModel.ExerciseCount` computation in `WorkoutTemplateService` shows the working
> pattern; copy it).

- [ ] **Step 4: Build**

Run: `dotnet build server/FitMate.sln`
Expected: OK.

- [ ] **Step 5: Commit**

```bash
git add server/FitMate.Core server/FitMate.Services
git commit -m "feat(program-plans): add DTOs and mapper"
```

---

### Task 3: Schedule generation service (pure logic, TDD)

**Files:**
- Create: `server/FitMate.Services/ProgramPlans/IProgramPlanScheduleService.cs`, `ProgramPlanScheduleService.cs`
- Test: `server/FitMate.Tests/Unit/Services/ProgramPlanScheduleServiceTests.cs`

**Interfaces:**
- Consumes: Task 1 entities.
- Produces:

```csharp
public interface IProgramPlanScheduleService
{
    /// Expands the plan's schedule rules into concrete days for [from, toInclusive].
    /// Pure: does not touch the database. Rest days are not emitted.
    IReadOnlyList<ProgramPlanDay> GenerateDays(ProgramPlan plan, DateOnly from, DateOnly toInclusive);
}
```

Rules implemented:
- **FixedWeekdays:** for each date in range, emit one day per rule whose `DayOfWeek` matches, honoring `WeekInterval` (rule fires only when `((weeksSinceStart) % WeekInterval) == 0`, where `weeksSinceStart = (date.DayNumber - plan.StartDate.DayNumber) / 7`). `OrderIndex` copied from rule.
- **Rotation:** cycle length = max `RotationDayIndex`. For each date, `dayIndex = ((date.DayNumber - plan.StartDate.DayNumber) % cycleLength) + 1`; emit the rule(s) with that index unless the rule's `DayType == Rest` (rest rules define the cycle but emit nothing).
- **CustomCalendar:** `GenerateDays` returns `[]` — custom days come straight from the request (Task 5 persists them directly).
- Emitted days: `Status = Scheduled`, `DayType`/`WorkoutTemplateId`/`OrderIndex` from rule, `IsOptional` rules emit `DayType = OptionalWorkout` when their `DayType == Workout`.
- Never emit plain `Rest` days.

- [ ] **Step 1: Write failing tests** (`ProgramPlanScheduleServiceTests.cs` — pure unit tests, no database)

```csharp
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.ProgramPlans;

namespace FitMate.Tests.Unit.Services;

public class ProgramPlanScheduleServiceTests
{
    private static ProgramPlan FixedWeekdayPlan() => new()
    {
        Id = 1,
        UserId = 1,
        ScheduleType = ProgramScheduleType.FixedWeekdays,
        StartDate = new DateOnly(2026, 8, 3),  // a Monday
        EndDate = new DateOnly(2026, 8, 30),
        ScheduleRules =
        [
            new ProgramPlanScheduleRule { DayOfWeek = DayOfWeek.Monday, DayType = ProgramPlanDayType.Workout, WorkoutTemplateId = 10, OrderIndex = 0 },
            new ProgramPlanScheduleRule { DayOfWeek = DayOfWeek.Tuesday, DayType = ProgramPlanDayType.Workout, WorkoutTemplateId = 11, OrderIndex = 1 },
            new ProgramPlanScheduleRule { DayOfWeek = DayOfWeek.Thursday, DayType = ProgramPlanDayType.Workout, WorkoutTemplateId = 12, OrderIndex = 2 },
            new ProgramPlanScheduleRule { DayOfWeek = DayOfWeek.Saturday, DayType = ProgramPlanDayType.Workout, WorkoutTemplateId = 13, OrderIndex = 3 },
        ],
    };

    [Fact]
    public void FixedWeekdays_FourWeeks_Generates16Workouts()
    {
        var plan = FixedWeekdayPlan();
        var service = new ProgramPlanScheduleService();

        var days = service.GenerateDays(plan, plan.StartDate, plan.EndDate!.Value);

        Assert.Equal(16, days.Count);
        Assert.All(days, d => Assert.Equal(ProgramPlanDayStatus.Scheduled, d.Status));
        Assert.All(days, d => Assert.Equal(ProgramPlanDayType.Workout, d.DayType));
        // first week
        Assert.Contains(days, d => d.ScheduledDate == new DateOnly(2026, 8, 3) && d.WorkoutTemplateId == 10);
        Assert.Contains(days, d => d.ScheduledDate == new DateOnly(2026, 8, 4) && d.WorkoutTemplateId == 11);
        Assert.Contains(days, d => d.ScheduledDate == new DateOnly(2026, 8, 6) && d.WorkoutTemplateId == 12);
        Assert.Contains(days, d => d.ScheduledDate == new DateOnly(2026, 8, 8) && d.WorkoutTemplateId == 13);
    }

    [Fact]
    public void FixedWeekdays_PartialRange_OnlyGeneratesInsideRange()
    {
        var plan = FixedWeekdayPlan();
        var service = new ProgramPlanScheduleService();

        var days = service.GenerateDays(plan, new DateOnly(2026, 8, 10), new DateOnly(2026, 8, 16));

        Assert.Equal(4, days.Count);
        Assert.All(days, d => Assert.InRange(d.ScheduledDate, new DateOnly(2026, 8, 10), new DateOnly(2026, 8, 16)));
    }

    [Fact]
    public void FixedWeekdays_WeekInterval2_SkipsAlternateWeeks()
    {
        var plan = FixedWeekdayPlan();
        plan.ScheduleRules = [new ProgramPlanScheduleRule
        {
            DayOfWeek = DayOfWeek.Monday,
            DayType = ProgramPlanDayType.Deload,
            WeekInterval = 2,
            OrderIndex = 0,
        }];
        var service = new ProgramPlanScheduleService();

        var days = service.GenerateDays(plan, plan.StartDate, plan.EndDate!.Value);

        Assert.Equal(2, days.Count); // Aug 3 and Aug 17
        Assert.Contains(days, d => d.ScheduledDate == new DateOnly(2026, 8, 3));
        Assert.Contains(days, d => d.ScheduledDate == new DateOnly(2026, 8, 17));
    }

    [Fact]
    public void Rotation_PushPullLegsRest_CyclesAndSkipsRestDays()
    {
        var plan = new ProgramPlan
        {
            ScheduleType = ProgramScheduleType.Rotation,
            StartDate = new DateOnly(2026, 8, 3),
            EndDate = new DateOnly(2026, 8, 10),
            ScheduleRules =
            [
                new ProgramPlanScheduleRule { RotationDayIndex = 1, DayType = ProgramPlanDayType.Workout, WorkoutTemplateId = 21, OrderIndex = 0 },
                new ProgramPlanScheduleRule { RotationDayIndex = 2, DayType = ProgramPlanDayType.Workout, WorkoutTemplateId = 22, OrderIndex = 1 },
                new ProgramPlanScheduleRule { RotationDayIndex = 3, DayType = ProgramPlanDayType.Workout, WorkoutTemplateId = 23, OrderIndex = 2 },
                new ProgramPlanScheduleRule { RotationDayIndex = 4, DayType = ProgramPlanDayType.Rest, OrderIndex = 3 },
            ],
        };
        var service = new ProgramPlanScheduleService();

        var days = service.GenerateDays(plan, plan.StartDate, plan.EndDate.Value);

        // 8 dates, cycle of 4 → 2 full cycles → 6 workout days (rest emits nothing)
        Assert.Equal(6, days.Count);
        Assert.Equal(21, days.Single(d => d.ScheduledDate == new DateOnly(2026, 8, 3)).WorkoutTemplateId);
        Assert.Equal(22, days.Single(d => d.ScheduledDate == new DateOnly(2026, 8, 4)).WorkoutTemplateId);
        Assert.Equal(23, days.Single(d => d.ScheduledDate == new DateOnly(2026, 8, 5)).WorkoutTemplateId);
        Assert.DoesNotContain(days, d => d.ScheduledDate == new DateOnly(2026, 8, 6));   // rest
        Assert.Equal(21, days.Single(d => d.ScheduledDate == new DateOnly(2026, 8, 7)).WorkoutTemplateId);
    }

    [Fact]
    public void Rotation_ContinuationRange_KeepsCyclePhase()
    {
        var plan = new ProgramPlan
        {
            ScheduleType = ProgramScheduleType.Rotation,
            StartDate = new DateOnly(2026, 8, 3),
            EndDate = null, // open-ended
            ScheduleRules =
            [
                new ProgramPlanScheduleRule { RotationDayIndex = 1, DayType = ProgramPlanDayType.Workout, WorkoutTemplateId = 21, OrderIndex = 0 },
                new ProgramPlanScheduleRule { RotationDayIndex = 2, DayType = ProgramPlanDayType.Rest, OrderIndex = 1 },
            ],
        };
        var service = new ProgramPlanScheduleService();

        // generating a later window must stay in phase: Aug 3 = index 1, so Aug 13 = index 1 too
        var days = service.GenerateDays(plan, new DateOnly(2026, 8, 13), new DateOnly(2026, 8, 16));

        Assert.Equal(2, days.Count);
        Assert.Contains(days, d => d.ScheduledDate == new DateOnly(2026, 8, 13));
        Assert.Contains(days, d => d.ScheduledDate == new DateOnly(2026, 8, 15));
    }

    [Fact]
    public void OptionalWorkoutRule_EmitsOptionalWorkoutDayType()
    {
        var plan = FixedWeekdayPlan();
        plan.ScheduleRules = [new ProgramPlanScheduleRule
        {
            DayOfWeek = DayOfWeek.Sunday,
            DayType = ProgramPlanDayType.Workout,
            IsOptional = true,
            WorkoutTemplateId = 10,
            OrderIndex = 0,
        }];
        var service = new ProgramPlanScheduleService();

        var days = service.GenerateDays(plan, plan.StartDate, plan.EndDate!.Value);

        Assert.All(days, d => Assert.Equal(ProgramPlanDayType.OptionalWorkout, d.DayType));
    }

    [Fact]
    public void CustomCalendar_GeneratesNothing()
    {
        var plan = new ProgramPlan
        {
            ScheduleType = ProgramScheduleType.CustomCalendar,
            StartDate = new DateOnly(2026, 8, 3),
            EndDate = new DateOnly(2026, 8, 30),
        };
        var service = new ProgramPlanScheduleService();

        Assert.Empty(service.GenerateDays(plan, plan.StartDate, plan.EndDate.Value));
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter ProgramPlanScheduleServiceTests`
Expected: FAIL — `ProgramPlanScheduleService` does not exist.

- [ ] **Step 3: Implement**

```csharp
using FitMate.DB.Entities;
using FitMate.DB.Enums;

namespace FitMate.Services.ProgramPlans;

public class ProgramPlanScheduleService : IProgramPlanScheduleService
{
    public IReadOnlyList<ProgramPlanDay> GenerateDays(ProgramPlan plan, DateOnly from, DateOnly toInclusive)
    {
        if (plan.ScheduleType == ProgramScheduleType.CustomCalendar || toInclusive < from)
        {
            return [];
        }

        var result = new List<ProgramPlanDay>();
        var rotationCycleLength = plan.ScheduleType == ProgramScheduleType.Rotation
            ? plan.ScheduleRules.Max(r => r.RotationDayIndex ?? 0)
            : 0;

        for (var date = from; date <= toInclusive; date = date.AddDays(1))
        {
            if (date < plan.StartDate)
            {
                continue;
            }

            var daysSinceStart = date.DayNumber - plan.StartDate.DayNumber;

            IEnumerable<ProgramPlanScheduleRule> matching = plan.ScheduleType switch
            {
                ProgramScheduleType.FixedWeekdays => plan.ScheduleRules.Where(r =>
                    r.DayOfWeek == date.DayOfWeek
                    && (daysSinceStart / 7) % Math.Max(1, r.WeekInterval) == 0),
                ProgramScheduleType.Rotation when rotationCycleLength > 0 => plan.ScheduleRules.Where(r =>
                    r.RotationDayIndex == (daysSinceStart % rotationCycleLength) + 1),
                _ => [],
            };

            foreach (var rule in matching.Where(r => r.DayType != ProgramPlanDayType.Rest))
            {
                result.Add(new ProgramPlanDay
                {
                    ProgramPlanId = plan.Id,
                    ScheduledDate = date,
                    DayType = rule.IsOptional && rule.DayType == ProgramPlanDayType.Workout
                        ? ProgramPlanDayType.OptionalWorkout
                        : rule.DayType,
                    Status = ProgramPlanDayStatus.Scheduled,
                    WorkoutTemplateId = rule.WorkoutTemplateId,
                    OrderIndex = rule.OrderIndex,
                });
            }
        }

        return result;
    }
}
```

Interface file `IProgramPlanScheduleService.cs` as shown in the Interfaces block above.

- [ ] **Step 4: Run tests to verify they pass**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter ProgramPlanScheduleServiceTests`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add server/FitMate.Services server/FitMate.Tests
git commit -m "feat(program-plans): deterministic schedule generation service"
```

---

### Task 4: Draft CRUD + validation

**Files:**
- Create: `server/FitMate.Services/ProgramPlans/IProgramPlanService.cs`, `ProgramPlanService.cs`, `ProgramPlanValidator.cs`
- Test: `server/FitMate.Tests/Unit/Services/ProgramPlanServiceTests.cs`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces (full interface — later tasks add no signatures, only implementations):

```csharp
using FitMate.Core.JsonModels.ProgramPlans;

namespace FitMate.Services.ProgramPlans;

public interface IProgramPlanService
{
    Task<IReadOnlyList<ProgramPlanModel>> ListAsync(long userId);
    Task<ProgramPlanModel?> GetByIdAsync(long planId, long userId);
    Task<ProgramPlanModel> CreateDraftAsync(SaveProgramPlanRequest request, long userId);
    Task<ProgramPlanModel> UpdateDraftAsync(long planId, SaveProgramPlanRequest request, long userId);
    Task<ProgramPlanModel> ActivateAsync(long planId, long userId);
    Task PauseAsync(long planId, long userId);
    Task CompleteAsync(long planId, long userId);
    Task CancelAsync(long planId, long userId);
    Task<bool> DeleteDraftAsync(long planId, long userId);
    Task<ProgramPlanModel?> GetActiveAsync(long userId);
    Task<ProgramTodayModel> GetTodayAsync(long userId, DateOnly date);
    Task<IReadOnlyList<ProgramPlanDayModel>> GetCalendarAsync(long planId, long userId, int year, int month);
    Task<ProgramProgressModel> GetProgressAsync(long planId, long userId, DateOnly today);
}
```

Validation errors throw the repo's existing validation exception type — open `server/FitMate.Core/Exceptions/` and use the same exception the `WorkoutTemplateService` throws for bad input (reuse it; do not invent a new hierarchy). Where the text below says `ValidationException`, substitute that type.

`ProgramPlanValidator.Validate(SaveProgramPlanRequest request, IReadOnlyList<long> visibleTemplateIds)` throws on:
1. Empty `Name`.
2. `EndDate < StartDate`.
3. `TargetWorkoutsPerWeek` outside 1–7.
4. `ScheduleType == CustomCalendar && EndDate == null` (custom requires an end date).
5. `ScheduleType == FixedWeekdays` and any rule with `DayOfWeek == null` or `RotationDayIndex != null`, or duplicate `DayOfWeek` values.
6. `ScheduleType == Rotation` and any rule with `RotationDayIndex == null` or `DayOfWeek != null`, or rotation indexes not exactly `1..N` with no gaps/duplicates.
7. Any non-Rest rule with `WorkoutTemplateId == null` when `DayType` is `Workout`.
8. Any referenced `WorkoutTemplateId` (rules or custom days) not in `visibleTemplateIds`.
9. `ScheduleType != CustomCalendar` with zero non-Rest rules; `CustomCalendar` with zero `CustomDays`.
10. Any `CustomDays` date outside `[StartDate, EndDate]` or duplicate `(Date, DayType, WorkoutTemplateId)` entries.

- [ ] **Step 1: Write failing tests**

```csharp
using FitMate.Core.JsonModels.ProgramPlans;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.ProgramPlans;
using FitMate.Tests.TestInfrastructure;

namespace FitMate.Tests.Unit.Services;

public class ProgramPlanServiceTests
{
    private static async Task<long> SeedTemplateAsync(SqliteTestDatabase db, long userId, string name)
    {
        await using var context = db.CreateContext();
        var template = new WorkoutTemplate { UserId = userId, Name = name, IsPublic = false };
        context.WorkoutTemplates.Add(template);
        await context.SaveChangesAsync();
        return template.Id;
    }

    private static SaveProgramPlanRequest FixedWeekdayRequest(long templateId) => new()
    {
        Name = "August Upper Lower",
        Goal = TrainingGoal.Hypertrophy,
        ScheduleType = ProgramScheduleType.FixedWeekdays,
        StartDate = new DateOnly(2026, 8, 3),
        EndDate = new DateOnly(2026, 8, 30),
        TargetWorkoutsPerWeek = 4,
        ScheduleRules =
        [
            new ProgramScheduleRuleRequest { DayOfWeek = DayOfWeek.Monday, DayType = ProgramPlanDayType.Workout, WorkoutTemplateId = templateId, OrderIndex = 0 },
            new ProgramScheduleRuleRequest { DayOfWeek = DayOfWeek.Thursday, DayType = ProgramPlanDayType.Workout, WorkoutTemplateId = templateId, OrderIndex = 1 },
        ],
    };

    private static ProgramPlanService CreateService(SqliteTestDatabase db) =>
        new(db.CreateContext(), new ProgramPlanScheduleService());

    [Fact]
    public async Task CreateDraft_PersistsPlanWithRules()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var service = CreateService(db);

        var model = await service.CreateDraftAsync(FixedWeekdayRequest(templateId), SqliteTestDatabase.UserId);

        Assert.Equal(ProgramPlanStatus.Draft, model.Status);
        Assert.Equal(2, model.ScheduleRules.Count);
        await using var context = db.CreateContext();
        Assert.Equal(1, context.ProgramPlans.Count());
        Assert.Empty(context.ProgramPlanDays); // drafts generate no calendar
    }

    [Fact]
    public async Task CreateDraft_OtherUsersPrivateTemplate_Throws()
    {
        using var db = new SqliteTestDatabase();
        var foreignTemplate = await SeedTemplateAsync(db, SqliteTestDatabase.OtherUserId, "Not yours");
        var service = CreateService(db);

        await Assert.ThrowsAnyAsync<Exception>(() =>
            service.CreateDraftAsync(FixedWeekdayRequest(foreignTemplate), SqliteTestDatabase.UserId));
    }

    [Fact]
    public async Task CreateDraft_EndBeforeStart_Throws()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var request = FixedWeekdayRequest(templateId);
        request.EndDate = request.StartDate.AddDays(-1);
        var service = CreateService(db);

        await Assert.ThrowsAnyAsync<Exception>(() =>
            service.CreateDraftAsync(request, SqliteTestDatabase.UserId));
    }

    [Fact]
    public async Task CreateDraft_RotationWithGappedIndexes_Throws()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Push");
        var request = FixedWeekdayRequest(templateId);
        request.ScheduleType = ProgramScheduleType.Rotation;
        request.ScheduleRules =
        [
            new ProgramScheduleRuleRequest { RotationDayIndex = 1, DayType = ProgramPlanDayType.Workout, WorkoutTemplateId = templateId, OrderIndex = 0 },
            new ProgramScheduleRuleRequest { RotationDayIndex = 3, DayType = ProgramPlanDayType.Workout, WorkoutTemplateId = templateId, OrderIndex = 1 },
        ];
        var service = CreateService(db);

        await Assert.ThrowsAnyAsync<Exception>(() =>
            service.CreateDraftAsync(request, SqliteTestDatabase.UserId));
    }

    [Fact]
    public async Task UpdateDraft_ReplacesRules()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var service = CreateService(db);
        var created = await service.CreateDraftAsync(FixedWeekdayRequest(templateId), SqliteTestDatabase.UserId);

        var update = FixedWeekdayRequest(templateId);
        update.ScheduleRules.RemoveAt(1);
        var updated = await service.UpdateDraftAsync(created.Id, update, SqliteTestDatabase.UserId);

        Assert.Single(updated.ScheduleRules);
    }

    [Fact]
    public async Task UpdateDraft_NonDraft_Throws()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var service = CreateService(db);
        var created = await service.CreateDraftAsync(FixedWeekdayRequest(templateId), SqliteTestDatabase.UserId);
        await service.ActivateAsync(created.Id, SqliteTestDatabase.UserId);

        await Assert.ThrowsAnyAsync<Exception>(() =>
            service.UpdateDraftAsync(created.Id, FixedWeekdayRequest(templateId), SqliteTestDatabase.UserId));
    }

    [Fact]
    public async Task GetById_OtherUsersPlan_ReturnsNull()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var service = CreateService(db);
        var created = await service.CreateDraftAsync(FixedWeekdayRequest(templateId), SqliteTestDatabase.UserId);

        Assert.Null(await service.GetByIdAsync(created.Id, SqliteTestDatabase.OtherUserId));
    }
}
```

- [ ] **Step 2: Run tests — expect FAIL** (`ProgramPlanService` missing)

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter ProgramPlanServiceTests`

- [ ] **Step 3: Implement `ProgramPlanValidator` + `ProgramPlanService` (draft part)**

`ProgramPlanService` constructor: `(AppDbContext dbContext, IProgramPlanScheduleService scheduleService)`.

```csharp
using FitMate.Core.JsonModels.ProgramPlans;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.ProgramPlans;

public class ProgramPlanService : IProgramPlanService
{
    private readonly AppDbContext dbContext;
    private readonly IProgramPlanScheduleService scheduleService;

    public ProgramPlanService(AppDbContext dbContext, IProgramPlanScheduleService scheduleService)
    {
        this.dbContext = dbContext;
        this.scheduleService = scheduleService;
    }

    public async Task<IReadOnlyList<ProgramPlanModel>> ListAsync(long userId)
    {
        var plans = await dbContext.ProgramPlans
            .AsNoTracking()
            .Include(p => p.ScheduleRules).ThenInclude(r => r.WorkoutTemplate)
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.DateCreated)
            .ToListAsync();
        return plans.Select(ProgramPlanMapper.ToModel).ToList();
    }

    public async Task<ProgramPlanModel?> GetByIdAsync(long planId, long userId)
    {
        var plan = await LoadOwnedAsync(planId, userId, track: false);
        return plan == null ? null : ProgramPlanMapper.ToModel(plan);
    }

    public async Task<ProgramPlanModel> CreateDraftAsync(SaveProgramPlanRequest request, long userId)
    {
        await ValidateAsync(request, userId);

        var plan = new ProgramPlan
        {
            UserId = userId,
            Status = ProgramPlanStatus.Draft,
        };
        ApplyRequest(plan, request);
        dbContext.ProgramPlans.Add(plan);
        await dbContext.SaveChangesAsync();
        return (await GetByIdAsync(plan.Id, userId))!;
    }

    public async Task<ProgramPlanModel> UpdateDraftAsync(long planId, SaveProgramPlanRequest request, long userId)
    {
        var plan = await LoadOwnedAsync(planId, userId, track: true)
            ?? throw new KeyNotFoundException("Program plan not found.");
        if (plan.Status != ProgramPlanStatus.Draft)
        {
            throw new InvalidOperationException("Only draft plans can be edited.");
        }

        await ValidateAsync(request, userId);
        dbContext.ProgramPlanScheduleRules.RemoveRange(plan.ScheduleRules);
        plan.ScheduleRules.Clear();
        ApplyRequest(plan, request);
        await dbContext.SaveChangesAsync();
        return (await GetByIdAsync(plan.Id, userId))!;
    }

    private void ApplyRequest(ProgramPlan plan, SaveProgramPlanRequest request)
    {
        plan.Name = request.Name.Trim();
        plan.Description = request.Description;
        plan.Goal = request.Goal;
        plan.ScheduleType = request.ScheduleType;
        plan.StartDate = request.StartDate;
        plan.EndDate = request.EndDate;
        plan.TargetWorkoutsPerWeek = request.TargetWorkoutsPerWeek;
        foreach (var rule in request.ScheduleRules)
        {
            plan.ScheduleRules.Add(new ProgramPlanScheduleRule
            {
                DayOfWeek = rule.DayOfWeek,
                RotationDayIndex = rule.RotationDayIndex,
                DayType = rule.DayType,
                WorkoutTemplateId = rule.WorkoutTemplateId,
                WeekInterval = rule.WeekInterval,
                OrderIndex = rule.OrderIndex,
                IsOptional = rule.IsOptional,
            });
        }
        // Custom days are persisted at activation (Task 5); store the request days on the plan via
        // a transient field is NOT possible — so custom-calendar drafts persist their days
        // immediately as Scheduled ProgramPlanDay rows (they are the source of truth for custom plans):
        if (request.ScheduleType == ProgramScheduleType.CustomCalendar)
        {
            var existingDays = dbContext.ProgramPlanDays.Where(d => d.ProgramPlanId == plan.Id);
            dbContext.ProgramPlanDays.RemoveRange(existingDays);
            var orderPerDate = new Dictionary<DateOnly, int>();
            foreach (var day in request.CustomDays)
            {
                orderPerDate.TryGetValue(day.Date, out var order);
                orderPerDate[day.Date] = order + 1;
                plan.Days.Add(new ProgramPlanDay
                {
                    ScheduledDate = day.Date,
                    DayType = day.DayType,
                    Status = ProgramPlanDayStatus.Scheduled,
                    WorkoutTemplateId = day.WorkoutTemplateId,
                    Notes = day.Notes,
                    OrderIndex = order,
                });
            }
        }
    }

    private async Task ValidateAsync(SaveProgramPlanRequest request, long userId)
    {
        var referencedIds = request.ScheduleRules.Where(r => r.WorkoutTemplateId.HasValue).Select(r => r.WorkoutTemplateId!.Value)
            .Concat(request.CustomDays.Where(d => d.WorkoutTemplateId.HasValue).Select(d => d.WorkoutTemplateId!.Value))
            .Distinct()
            .ToList();
        var visibleIds = await dbContext.WorkoutTemplates
            .Where(t => referencedIds.Contains(t.Id) && (t.UserId == userId || t.IsPublic))
            .Select(t => t.Id)
            .ToListAsync();
        ProgramPlanValidator.Validate(request, visibleIds);
    }

    private Task<ProgramPlan?> LoadOwnedAsync(long planId, long userId, bool track)
    {
        var query = dbContext.ProgramPlans
            .Include(p => p.ScheduleRules).ThenInclude(r => r.WorkoutTemplate)
            .Where(p => p.Id == planId && p.UserId == userId);
        return (track ? query : query.AsNoTracking()).FirstOrDefaultAsync();
    }

    // ActivateAsync, PauseAsync, CompleteAsync, CancelAsync, DeleteDraftAsync,
    // GetActiveAsync, GetTodayAsync, GetCalendarAsync, GetProgressAsync: added in Tasks 5, 8, 9.
    public Task<ProgramPlanModel> ActivateAsync(long planId, long userId) => throw new NotImplementedException();
    public Task PauseAsync(long planId, long userId) => throw new NotImplementedException();
    public Task CompleteAsync(long planId, long userId) => throw new NotImplementedException();
    public Task CancelAsync(long planId, long userId) => throw new NotImplementedException();
    public Task<bool> DeleteDraftAsync(long planId, long userId) => throw new NotImplementedException();
    public Task<ProgramPlanModel?> GetActiveAsync(long userId) => throw new NotImplementedException();
    public Task<ProgramTodayModel> GetTodayAsync(long userId, DateOnly date) => throw new NotImplementedException();
    public Task<IReadOnlyList<ProgramPlanDayModel>> GetCalendarAsync(long planId, long userId, int year, int month) => throw new NotImplementedException();
    public Task<ProgramProgressModel> GetProgressAsync(long planId, long userId, DateOnly today) => throw new NotImplementedException();
}
```

`ProgramPlanValidator.cs` — implement the 10 rules listed in the Interfaces block; each violation throws the repo's validation exception with a human-readable message, e.g. `"Rotation day indexes must be sequential starting at 1."`. Substitute the repo's real exception type after inspecting `FitMate.Core/Exceptions/` (there is one — `ExerciseService`/`WorkoutTemplateService` throw it; `ThrowsAnyAsync<Exception>` in the tests keeps them agnostic).

- [ ] **Step 4: Run tests** — the `ActivateAsync` test (`UpdateDraft_NonDraft_Throws`) will still fail. Temporarily implement `ActivateAsync` minimally (set `Status = Active`, save) — Task 5 replaces it with the real transaction + generation version.

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter ProgramPlanServiceTests`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/FitMate.Services server/FitMate.Tests
git commit -m "feat(program-plans): draft CRUD with validation"
```

---

### Task 5: Activation, lifecycle, calendar persistence

**Files:**
- Modify: `server/FitMate.Services/ProgramPlans/ProgramPlanService.cs`
- Test: append to `ProgramPlanServiceTests.cs`

**Interfaces:**
- Consumes: `IProgramPlanScheduleService.GenerateDays`.
- Produces: working `ActivateAsync`, `PauseAsync`, `CompleteAsync`, `CancelAsync`, `DeleteDraftAsync`, `GetActiveAsync`, `GetCalendarAsync`. Constant `public const int OpenEndedHorizonDays = 28;` on `ProgramPlanService`.

Rules (spec §23–24 + roadmap D1/D3):
- Only Draft or Paused plans activate. Activating a Paused plan does NOT regenerate days.
- Activating a Draft: fixed-length → generate days for `[StartDate, EndDate]`; open-ended → generate `[StartDate, max(StartDate, today) + 28 days]`. Custom plans already have their days (Task 4) — validate none fall outside range, then just flip status.
- Reject activation when the user already has a different plan with `Status == Active` (one-active rule, D3).
- All inside `dbContext.Database.BeginTransactionAsync()`.
- `PauseAsync`: Active → Paused. `CompleteAsync`: Active/Paused → Completed + `CompletedAt`. `CancelAsync`: any non-terminal → Cancelled. `DeleteDraftAsync`: hard-deletes Draft plans only; returns false otherwise.
- Activation is idempotent-safe: activating an already-Active plan throws `InvalidOperationException` (client treats as no-op error).

- [ ] **Step 1: Write failing tests** (append to `ProgramPlanServiceTests`)

```csharp
    [Fact]
    public async Task Activate_FixedLength_GeneratesAllDaysAndSetsActive()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var service = CreateService(db);
        var created = await service.CreateDraftAsync(FixedWeekdayRequest(templateId), SqliteTestDatabase.UserId);

        var activated = await service.ActivateAsync(created.Id, SqliteTestDatabase.UserId);

        Assert.Equal(ProgramPlanStatus.Active, activated.Status);
        Assert.NotNull(activated.ActivatedAt);
        await using var context = db.CreateContext();
        Assert.Equal(8, context.ProgramPlanDays.Count(d => d.ProgramPlanId == created.Id)); // Mon+Thu × 4 weeks
    }

    [Fact]
    public async Task Activate_OpenEnded_GeneratesRollingHorizonOnly()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var service = CreateService(db);
        var request = FixedWeekdayRequest(templateId);
        request.StartDate = DateOnly.FromDateTime(DateTime.UtcNow);
        request.EndDate = null;
        var created = await service.CreateDraftAsync(request, SqliteTestDatabase.UserId);

        await service.ActivateAsync(created.Id, SqliteTestDatabase.UserId);

        await using var context = db.CreateContext();
        var maxDate = context.ProgramPlanDays
            .Where(d => d.ProgramPlanId == created.Id)
            .Max(d => d.ScheduledDate);
        Assert.True(maxDate <= request.StartDate.AddDays(ProgramPlanService.OpenEndedHorizonDays));
        Assert.True(context.ProgramPlanDays.Any(d => d.ProgramPlanId == created.Id));
    }

    [Fact]
    public async Task Activate_SecondActivePlan_Throws()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var service = CreateService(db);
        var first = await service.CreateDraftAsync(FixedWeekdayRequest(templateId), SqliteTestDatabase.UserId);
        await service.ActivateAsync(first.Id, SqliteTestDatabase.UserId);
        var second = await service.CreateDraftAsync(FixedWeekdayRequest(templateId), SqliteTestDatabase.UserId);

        await Assert.ThrowsAnyAsync<Exception>(() => service.ActivateAsync(second.Id, SqliteTestDatabase.UserId));
    }

    [Fact]
    public async Task Activate_PausedPlan_DoesNotDuplicateDays()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var service = CreateService(db);
        var created = await service.CreateDraftAsync(FixedWeekdayRequest(templateId), SqliteTestDatabase.UserId);
        await service.ActivateAsync(created.Id, SqliteTestDatabase.UserId);
        await service.PauseAsync(created.Id, SqliteTestDatabase.UserId);

        await service.ActivateAsync(created.Id, SqliteTestDatabase.UserId);

        await using var context = db.CreateContext();
        Assert.Equal(8, context.ProgramPlanDays.Count(d => d.ProgramPlanId == created.Id));
    }

    [Fact]
    public async Task DeleteDraft_ActivePlan_ReturnsFalse()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var service = CreateService(db);
        var created = await service.CreateDraftAsync(FixedWeekdayRequest(templateId), SqliteTestDatabase.UserId);
        await service.ActivateAsync(created.Id, SqliteTestDatabase.UserId);

        Assert.False(await service.DeleteDraftAsync(created.Id, SqliteTestDatabase.UserId));
        await using var context = db.CreateContext();
        Assert.Equal(1, context.ProgramPlans.Count());
    }

    [Fact]
    public async Task GetActive_ReturnsOnlyOwnActivePlan()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var service = CreateService(db);
        var created = await service.CreateDraftAsync(FixedWeekdayRequest(templateId), SqliteTestDatabase.UserId);
        await service.ActivateAsync(created.Id, SqliteTestDatabase.UserId);

        Assert.NotNull(await service.GetActiveAsync(SqliteTestDatabase.UserId));
        Assert.Null(await service.GetActiveAsync(SqliteTestDatabase.OtherUserId));
    }
```

- [ ] **Step 2: Run — expect FAIL** (NotImplementedException / minimal ActivateAsync from Task 4)

- [ ] **Step 3: Implement**

```csharp
    public const int OpenEndedHorizonDays = 28;

    public async Task<ProgramPlanModel> ActivateAsync(long planId, long userId)
    {
        await using var transaction = await dbContext.Database.BeginTransactionAsync();

        var plan = await LoadOwnedAsync(planId, userId, track: true)
            ?? throw new KeyNotFoundException("Program plan not found.");

        if (plan.Status != ProgramPlanStatus.Draft && plan.Status != ProgramPlanStatus.Paused)
        {
            throw new InvalidOperationException("Only draft or paused plans can be activated.");
        }

        var hasOtherActive = await dbContext.ProgramPlans
            .AnyAsync(p => p.UserId == userId && p.Status == ProgramPlanStatus.Active && p.Id != planId);
        if (hasOtherActive)
        {
            // Plan 04 replaces this hard "1" with IEntitlementService (ActiveProgramPlans).
            throw new InvalidOperationException("You already have an active program plan.");
        }

        if (plan.Status == ProgramPlanStatus.Draft)
        {
            if (plan.ScheduleType == ProgramScheduleType.CustomCalendar)
            {
                var outside = await dbContext.ProgramPlanDays.AnyAsync(d =>
                    d.ProgramPlanId == plan.Id
                    && (d.ScheduledDate < plan.StartDate || d.ScheduledDate > plan.EndDate));
                if (outside)
                {
                    throw new InvalidOperationException("Custom days fall outside the plan date range.");
                }
            }
            else
            {
                var today = DateOnly.FromDateTime(DateTime.UtcNow);
                var to = plan.EndDate
                    ?? (plan.StartDate > today ? plan.StartDate : today).AddDays(OpenEndedHorizonDays);
                var days = scheduleService.GenerateDays(plan, plan.StartDate, to);
                dbContext.ProgramPlanDays.AddRange(days);
            }
            plan.ActivatedAt = DateTime.UtcNow;
        }

        plan.Status = ProgramPlanStatus.Active;
        await dbContext.SaveChangesAsync();
        await transaction.CommitAsync();
        return (await GetByIdAsync(plan.Id, userId))!;
    }

    public async Task PauseAsync(long planId, long userId)
    {
        var plan = await RequireOwnedAsync(planId, userId);
        if (plan.Status != ProgramPlanStatus.Active)
        {
            throw new InvalidOperationException("Only active plans can be paused.");
        }
        plan.Status = ProgramPlanStatus.Paused;
        await dbContext.SaveChangesAsync();
    }

    public async Task CompleteAsync(long planId, long userId)
    {
        var plan = await RequireOwnedAsync(planId, userId);
        if (plan.Status != ProgramPlanStatus.Active && plan.Status != ProgramPlanStatus.Paused)
        {
            throw new InvalidOperationException("Only active or paused plans can be completed.");
        }
        plan.Status = ProgramPlanStatus.Completed;
        plan.CompletedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync();
    }

    public async Task CancelAsync(long planId, long userId)
    {
        var plan = await RequireOwnedAsync(planId, userId);
        if (plan.Status is ProgramPlanStatus.Completed or ProgramPlanStatus.Cancelled)
        {
            throw new InvalidOperationException("Plan is already finished.");
        }
        plan.Status = ProgramPlanStatus.Cancelled;
        await dbContext.SaveChangesAsync();
    }

    public async Task<bool> DeleteDraftAsync(long planId, long userId)
    {
        var plan = await dbContext.ProgramPlans
            .FirstOrDefaultAsync(p => p.Id == planId && p.UserId == userId);
        if (plan == null || plan.Status != ProgramPlanStatus.Draft)
        {
            return false;
        }
        dbContext.ProgramPlans.Remove(plan); // cascades to rules and days
        await dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<ProgramPlanModel?> GetActiveAsync(long userId)
    {
        var plan = await dbContext.ProgramPlans
            .AsNoTracking()
            .Include(p => p.ScheduleRules).ThenInclude(r => r.WorkoutTemplate)
            .FirstOrDefaultAsync(p => p.UserId == userId && p.Status == ProgramPlanStatus.Active);
        return plan == null ? null : ProgramPlanMapper.ToModel(plan);
    }

    private async Task<ProgramPlan> RequireOwnedAsync(long planId, long userId) =>
        await dbContext.ProgramPlans.FirstOrDefaultAsync(p => p.Id == planId && p.UserId == userId)
        ?? throw new KeyNotFoundException("Program plan not found.");
```

- [ ] **Step 4: Run all ProgramPlan tests — expect PASS**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter "ProgramPlanServiceTests|ProgramPlanScheduleServiceTests"`

- [ ] **Step 5: Commit**

```bash
git add server/FitMate.Services server/FitMate.Tests
git commit -m "feat(program-plans): activation lifecycle with persisted calendar"
```

---

### Task 6: Idempotent day start + workout linkage

**Files:**
- Create: `server/FitMate.Services/ProgramPlans/IProgramPlanDayService.cs`, `ProgramPlanDayService.cs`
- Modify: `server/FitMate.Services/Workouts/IWorkoutService.cs`, `WorkoutService.cs` (`StartFromTemplateAsync` gains optional `programPlanDayId`)
- Test: `server/FitMate.Tests/Unit/Services/ProgramPlanDayServiceTests.cs`

**Interfaces:**
- Produces:

```csharp
using FitMate.Core.JsonModels.ProgramPlans;

namespace FitMate.Services.ProgramPlans;

public interface IProgramPlanDayService
{
    /// Returns the id of the (new or already-started) Workout. Idempotent.
    Task<long> StartWorkoutAsync(long programPlanDayId, long userId);
    Task<ProgramPlanDayModel> MoveAsync(long programPlanDayId, MoveProgramDayRequest request, long userId);
    Task<ProgramPlanDayModel> SkipAsync(long programPlanDayId, long userId);
    Task<ProgramPlanDayModel> RestoreAsync(long programPlanDayId, long userId);
    Task MarkMissedDaysAsync(long userId, DateOnly referenceDate);
}
```

- Modify `IWorkoutService`: `Task<long> StartFromTemplateAsync(long templateId, long userId)` becomes `Task<long> StartFromTemplateAsync(long templateId, long userId, long? programPlanDayId = null);` — inside `WorkoutService.StartFromTemplateAsync`, set `workout.ProgramPlanDayId = programPlanDayId` on the created `Workout` before saving. (Optional parameter keeps the existing controller call sites compiling untouched.)

`StartWorkoutAsync` rules (spec §25): verify ownership via parent plan; plan must be Active; day must be `Workout`/`OptionalWorkout`/`Recovery`/`Deload` with a `WorkoutTemplateId`; if `StartedWorkoutId != null` return it unchanged (idempotent); else inside a transaction call `workoutService.StartFromTemplateAsync(day.WorkoutTemplateId.Value, userId, day.Id)`, set `StartedWorkoutId`, `Status = Started`, `StartedAt = DateTime.UtcNow`, commit.

`ProgramPlanDayService` constructor: `(AppDbContext dbContext, IWorkoutService workoutService)`.

- [ ] **Step 1: Write failing tests**

```csharp
using FitMate.Core.JsonModels.ProgramPlans;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.ProgramPlans;
using FitMate.Services.Workouts;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Tests.Unit.Services;

public class ProgramPlanDayServiceTests
{
    // Seeds an Active plan with one Workout day on `date` and returns (planId, dayId, templateId).
    private static async Task<(long PlanId, long DayId, long TemplateId)> SeedActivePlanWithDayAsync(
        SqliteTestDatabase db,
        long userId,
        DateOnly date,
        ProgramPlanDayStatus status = ProgramPlanDayStatus.Scheduled)
    {
        await using var context = db.CreateContext();
        var template = new WorkoutTemplate { UserId = userId, Name = "Upper A", IsPublic = false };
        context.WorkoutTemplates.Add(template);
        await context.SaveChangesAsync();

        var plan = new ProgramPlan
        {
            UserId = userId,
            Name = "Test plan",
            Status = ProgramPlanStatus.Active,
            ScheduleType = ProgramScheduleType.FixedWeekdays,
            StartDate = date.AddDays(-7),
            EndDate = date.AddDays(21),
            TargetWorkoutsPerWeek = 3,
        };
        context.ProgramPlans.Add(plan);
        await context.SaveChangesAsync();

        var day = new ProgramPlanDay
        {
            ProgramPlanId = plan.Id,
            ScheduledDate = date,
            DayType = ProgramPlanDayType.Workout,
            Status = status,
            WorkoutTemplateId = template.Id,
        };
        context.ProgramPlanDays.Add(day);
        await context.SaveChangesAsync();
        return (plan.Id, day.Id, template.Id);
    }

    private static (ProgramPlanDayService DayService, FitMate.DB.AppDbContext Context) CreateService(SqliteTestDatabase db)
    {
        var context = db.CreateContext();
        // WorkoutService ctor: match the real signature — inspect WorkoutService.cs and pass the
        // same fakes the existing WorkoutServiceTests use.
        var workoutService = TestWorkoutServiceFactory.Create(context);
        return (new ProgramPlanDayService(context, workoutService), context);
    }

    [Fact]
    public async Task StartWorkout_CreatesWorkoutAndLinksDay()
    {
        using var db = new SqliteTestDatabase();
        var (_, dayId, _) = await SeedActivePlanWithDayAsync(db, SqliteTestDatabase.UserId, new DateOnly(2026, 8, 5));
        var (service, context) = CreateService(db);

        var workoutId = await service.StartWorkoutAsync(dayId, SqliteTestDatabase.UserId);

        var day = await context.ProgramPlanDays.AsNoTracking().SingleAsync(d => d.Id == dayId);
        Assert.Equal(ProgramPlanDayStatus.Started, day.Status);
        Assert.Equal(workoutId, day.StartedWorkoutId);
        Assert.NotNull(day.StartedAt);
        var workout = await context.Workouts.AsNoTracking().SingleAsync(w => w.Id == workoutId);
        Assert.Equal(dayId, workout.ProgramPlanDayId);
    }

    [Fact]
    public async Task StartWorkout_SecondCall_ReturnsSameWorkout()
    {
        using var db = new SqliteTestDatabase();
        var (_, dayId, _) = await SeedActivePlanWithDayAsync(db, SqliteTestDatabase.UserId, new DateOnly(2026, 8, 5));
        var (service, context) = CreateService(db);

        var first = await service.StartWorkoutAsync(dayId, SqliteTestDatabase.UserId);
        var second = await service.StartWorkoutAsync(dayId, SqliteTestDatabase.UserId);

        Assert.Equal(first, second);
        Assert.Equal(1, await context.Workouts.CountAsync());
    }

    [Fact]
    public async Task StartWorkout_OtherUsersDay_Throws()
    {
        using var db = new SqliteTestDatabase();
        var (_, dayId, _) = await SeedActivePlanWithDayAsync(db, SqliteTestDatabase.OtherUserId, new DateOnly(2026, 8, 5));
        var (service, _) = CreateService(db);

        await Assert.ThrowsAnyAsync<Exception>(() => service.StartWorkoutAsync(dayId, SqliteTestDatabase.UserId));
    }

    [Fact]
    public async Task StartWorkout_PausedPlan_Throws()
    {
        using var db = new SqliteTestDatabase();
        var (planId, dayId, _) = await SeedActivePlanWithDayAsync(db, SqliteTestDatabase.UserId, new DateOnly(2026, 8, 5));
        await using (var arrange = db.CreateContext())
        {
            var plan = await arrange.ProgramPlans.SingleAsync(p => p.Id == planId);
            plan.Status = ProgramPlanStatus.Paused;
            await arrange.SaveChangesAsync();
        }
        var (service, _) = CreateService(db);

        await Assert.ThrowsAnyAsync<Exception>(() => service.StartWorkoutAsync(dayId, SqliteTestDatabase.UserId));
    }
}
```

> `TestWorkoutServiceFactory` is a tiny helper to add to `TestInfrastructure` that constructs the real
> `WorkoutService` with the same fake dependencies `WorkoutServiceTests` already uses — copy the
> construction line from `WorkoutServiceTests.cs` verbatim into the factory so there is exactly one
> place to maintain.

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `ProgramPlanDayService.StartWorkoutAsync`**

```csharp
using FitMate.Core.JsonModels.ProgramPlans;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.Workouts;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.ProgramPlans;

public class ProgramPlanDayService : IProgramPlanDayService
{
    private readonly AppDbContext dbContext;
    private readonly IWorkoutService workoutService;

    public ProgramPlanDayService(AppDbContext dbContext, IWorkoutService workoutService)
    {
        this.dbContext = dbContext;
        this.workoutService = workoutService;
    }

    public async Task<long> StartWorkoutAsync(long programPlanDayId, long userId)
    {
        await using var transaction = await dbContext.Database.BeginTransactionAsync();

        var day = await LoadOwnedDayAsync(programPlanDayId, userId);

        if (day.ProgramPlan.Status != ProgramPlanStatus.Active)
        {
            throw new InvalidOperationException("The program plan is not active.");
        }
        if (day.DayType == ProgramPlanDayType.Rest)
        {
            throw new InvalidOperationException("Rest days cannot be started.");
        }
        if (day.WorkoutTemplateId == null)
        {
            throw new InvalidOperationException("This day has no workout template.");
        }
        if (day.StartedWorkoutId != null)
        {
            await transaction.CommitAsync();
            return day.StartedWorkoutId.Value;   // idempotent
        }

        var workoutId = await workoutService.StartFromTemplateAsync(day.WorkoutTemplateId.Value, userId, day.Id);
        day.StartedWorkoutId = workoutId;
        day.Status = ProgramPlanDayStatus.Started;
        day.StartedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync();
        await transaction.CommitAsync();
        return workoutId;
    }

    private async Task<ProgramPlanDay> LoadOwnedDayAsync(long dayId, long userId) =>
        await dbContext.ProgramPlanDays
            .Include(d => d.ProgramPlan)
            .FirstOrDefaultAsync(d => d.Id == dayId && d.ProgramPlan.UserId == userId)
        ?? throw new KeyNotFoundException("Program day not found.");

    // MoveAsync, SkipAsync, RestoreAsync, MarkMissedDaysAsync: Task 8.
    public Task<ProgramPlanDayModel> MoveAsync(long programPlanDayId, MoveProgramDayRequest request, long userId) => throw new NotImplementedException();
    public Task<ProgramPlanDayModel> SkipAsync(long programPlanDayId, long userId) => throw new NotImplementedException();
    public Task<ProgramPlanDayModel> RestoreAsync(long programPlanDayId, long userId) => throw new NotImplementedException();
    public Task MarkMissedDaysAsync(long userId, DateOnly referenceDate) => throw new NotImplementedException();
}
```

And in `WorkoutService.StartFromTemplateAsync`, add the parameter and one assignment (find where the `Workout` entity is instantiated and add `ProgramPlanDayId = programPlanDayId`).

- [ ] **Step 4: Run — expect PASS.** Also run the full suite (`dotnet test server/FitMate.sln`) — the `IWorkoutService` change must not break `WorkoutServiceTests` or controllers.

- [ ] **Step 5: Commit**

```bash
git add server/FitMate.Services server/FitMate.Tests
git commit -m "feat(program-plans): idempotent day start linked to workouts"
```

---

### Task 7: Completing a workout completes its program day

**Files:**
- Modify: `server/FitMate.Services/Workouts/WorkoutService.cs` (`FinishAsync`)
- Test: append to `ProgramPlanDayServiceTests.cs`

**Interfaces:**
- Consumes: `Workout.ProgramPlanDayId` (Task 1), day statuses.
- Produces: no new signatures — behavioral guarantee: after `FinishAsync`, the linked day has `Status = Completed`, `CompletedWorkoutId`, `CompletedAt`.

- [ ] **Step 1: Write failing test**

```csharp
    [Fact]
    public async Task FinishWorkout_CompletesLinkedProgramDay()
    {
        using var db = new SqliteTestDatabase();
        var (_, dayId, _) = await SeedActivePlanWithDayAsync(db, SqliteTestDatabase.UserId, new DateOnly(2026, 8, 5));
        var (service, context) = CreateService(db);
        var workoutId = await service.StartWorkoutAsync(dayId, SqliteTestDatabase.UserId);

        var workoutService = TestWorkoutServiceFactory.Create(context);
        await workoutService.FinishAsync(workoutId, MinimalSaveRequest(), SqliteTestDatabase.UserId);

        var day = await context.ProgramPlanDays.AsNoTracking().SingleAsync(d => d.Id == dayId);
        Assert.Equal(ProgramPlanDayStatus.Completed, day.Status);
        Assert.Equal(workoutId, day.CompletedWorkoutId);
        Assert.NotNull(day.CompletedAt);
    }
```

`MinimalSaveRequest()` — build the smallest valid `SaveWorkoutRequest`; copy the shape used by the existing `WorkoutServiceTests` finish test (inspect that file and reuse its helper if one exists).

- [ ] **Step 2: Run — expect FAIL** (day stays Started)

- [ ] **Step 3: Implement** — in `WorkoutService.FinishAsync`, after the workout is marked finished but inside the same save/transaction scope, add:

```csharp
        if (workout.ProgramPlanDayId.HasValue)
        {
            var programDay = await dbContext.ProgramPlanDays
                .FirstOrDefaultAsync(d => d.Id == workout.ProgramPlanDayId.Value);
            if (programDay != null && programDay.Status != ProgramPlanDayStatus.Completed)
            {
                programDay.Status = ProgramPlanDayStatus.Completed;
                programDay.CompletedWorkoutId = workout.Id;
                programDay.CompletedAt = DateTime.UtcNow;
            }
        }
```

(Adjust `dbContext` to the field name `WorkoutService` actually uses. Add `using FitMate.DB.Enums;` if missing. A workout finished on a later date still completes the original day — no date checks, per spec §26.)

- [ ] **Step 4: Run — expect PASS**, plus the full suite.

- [ ] **Step 5: Commit**

```bash
git add server/FitMate.Services server/FitMate.Tests
git commit -m "feat(program-plans): finishing a workout completes its program day"
```

---

### Task 8: Missed / move / skip / restore

**Files:**
- Modify: `server/FitMate.Services/ProgramPlans/ProgramPlanDayService.cs`
- Test: append to `ProgramPlanDayServiceTests.cs`

**Interfaces:** implements the four remaining `IProgramPlanDayService` members (signatures fixed in Task 6).

Rules (spec §27 + decisions):
- `MarkMissedDaysAsync(userId, referenceDate)`: for the user's Active plans, days with `ScheduledDate < referenceDate`: `Status == Scheduled && DayType == Workout` → `Missed`; `Status == Scheduled && DayType == OptionalWorkout` → `Skipped` (optional days carry no penalty). `Rescheduled` days that are again in the past are also marked `Missed`. Started/Completed/Skipped/Cancelled untouched.
- `MoveAsync`: not allowed for `Completed`/`Started`/`Cancelled`. New date must be `>= plan.StartDate` and `<= plan.EndDate` when `EndDate != null`. If another non-cancelled workout-type day of the same plan already sits on the target date → throw ("Another workout is already planned on that date."). On first move set `OriginalScheduledDate = old ScheduledDate` (only if currently null). Set `ScheduledDate = NewDate`, `Status = Rescheduled`.
- `SkipAsync`: allowed from `Scheduled`/`Missed`/`Rescheduled` → `Skipped`.
- `RestoreAsync`: allowed from `Skipped`/`Missed` → `Scheduled` if `ScheduledDate >= today(UTC)` else `Missed` (restoring a past skip surfaces it as missed, not silently scheduled).
- All four return the updated `ProgramPlanDayModel` (except `MarkMissedDaysAsync`, which returns `Task`).

- [ ] **Step 1: Write failing tests**

```csharp
    [Fact]
    public async Task MarkMissedDays_MarksPastScheduledWorkoutsOnly()
    {
        using var db = new SqliteTestDatabase();
        var (planId, pastDayId, templateId) = await SeedActivePlanWithDayAsync(db, SqliteTestDatabase.UserId, new DateOnly(2026, 8, 3));
        await using (var arrange = db.CreateContext())
        {
            arrange.ProgramPlanDays.AddRange(
                new ProgramPlanDay { ProgramPlanId = planId, ScheduledDate = new DateOnly(2026, 8, 4), DayType = ProgramPlanDayType.OptionalWorkout, Status = ProgramPlanDayStatus.Scheduled, WorkoutTemplateId = templateId, OrderIndex = 1 },
                new ProgramPlanDay { ProgramPlanId = planId, ScheduledDate = new DateOnly(2026, 8, 10), DayType = ProgramPlanDayType.Workout, Status = ProgramPlanDayStatus.Scheduled, WorkoutTemplateId = templateId, OrderIndex = 2 });
            await arrange.SaveChangesAsync();
        }
        var (service, context) = CreateService(db);

        await service.MarkMissedDaysAsync(SqliteTestDatabase.UserId, new DateOnly(2026, 8, 6));

        var days = await context.ProgramPlanDays.AsNoTracking().OrderBy(d => d.ScheduledDate).ToListAsync();
        Assert.Equal(ProgramPlanDayStatus.Missed, days[0].Status);    // past mandatory
        Assert.Equal(ProgramPlanDayStatus.Skipped, days[1].Status);   // past optional
        Assert.Equal(ProgramPlanDayStatus.Scheduled, days[2].Status); // future untouched
    }

    [Fact]
    public async Task Move_SetsOriginalDateAndRescheduledStatus()
    {
        using var db = new SqliteTestDatabase();
        var (_, dayId, _) = await SeedActivePlanWithDayAsync(db, SqliteTestDatabase.UserId, new DateOnly(2026, 8, 5));
        var (service, _) = CreateService(db);

        var moved = await service.MoveAsync(dayId, new MoveProgramDayRequest { NewDate = new DateOnly(2026, 8, 6) }, SqliteTestDatabase.UserId);

        Assert.Equal(new DateOnly(2026, 8, 6), moved.ScheduledDate);
        Assert.Equal(new DateOnly(2026, 8, 5), moved.OriginalScheduledDate);
        Assert.Equal(ProgramPlanDayStatus.Rescheduled, moved.Status);
    }

    [Fact]
    public async Task Move_OntoAnotherWorkoutDay_Throws()
    {
        using var db = new SqliteTestDatabase();
        var (planId, dayId, templateId) = await SeedActivePlanWithDayAsync(db, SqliteTestDatabase.UserId, new DateOnly(2026, 8, 5));
        await using (var arrange = db.CreateContext())
        {
            arrange.ProgramPlanDays.Add(new ProgramPlanDay
            {
                ProgramPlanId = planId,
                ScheduledDate = new DateOnly(2026, 8, 6),
                DayType = ProgramPlanDayType.Workout,
                Status = ProgramPlanDayStatus.Scheduled,
                WorkoutTemplateId = templateId,
                OrderIndex = 1,
            });
            await arrange.SaveChangesAsync();
        }
        var (service, _) = CreateService(db);

        await Assert.ThrowsAnyAsync<Exception>(() =>
            service.MoveAsync(dayId, new MoveProgramDayRequest { NewDate = new DateOnly(2026, 8, 6) }, SqliteTestDatabase.UserId));
    }

    [Fact]
    public async Task Move_OutsideFixedPlanRange_Throws()
    {
        using var db = new SqliteTestDatabase();
        var (_, dayId, _) = await SeedActivePlanWithDayAsync(db, SqliteTestDatabase.UserId, new DateOnly(2026, 8, 5));
        var (service, _) = CreateService(db);

        await Assert.ThrowsAnyAsync<Exception>(() =>
            service.MoveAsync(dayId, new MoveProgramDayRequest { NewDate = new DateOnly(2026, 9, 30) }, SqliteTestDatabase.UserId));
    }

    [Fact]
    public async Task Move_CompletedDay_Throws()
    {
        using var db = new SqliteTestDatabase();
        var (_, dayId, _) = await SeedActivePlanWithDayAsync(db, SqliteTestDatabase.UserId, new DateOnly(2026, 8, 5), ProgramPlanDayStatus.Completed);
        var (service, _) = CreateService(db);

        await Assert.ThrowsAnyAsync<Exception>(() =>
            service.MoveAsync(dayId, new MoveProgramDayRequest { NewDate = new DateOnly(2026, 8, 7) }, SqliteTestDatabase.UserId));
    }

    [Fact]
    public async Task SkipAndRestore_FutureDay_RoundTripsToScheduled()
    {
        using var db = new SqliteTestDatabase();
        var futureDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(7);
        var (_, dayId, _) = await SeedActivePlanWithDayAsync(db, SqliteTestDatabase.UserId, futureDate);
        var (service, _) = CreateService(db);

        var skipped = await service.SkipAsync(dayId, SqliteTestDatabase.UserId);
        Assert.Equal(ProgramPlanDayStatus.Skipped, skipped.Status);

        var restored = await service.RestoreAsync(dayId, SqliteTestDatabase.UserId);
        Assert.Equal(ProgramPlanDayStatus.Scheduled, restored.Status);
    }
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement** (replace the four `NotImplementedException` members)

```csharp
    public async Task<ProgramPlanDayModel> MoveAsync(long programPlanDayId, MoveProgramDayRequest request, long userId)
    {
        var day = await LoadOwnedDayAsync(programPlanDayId, userId);

        if (day.Status is ProgramPlanDayStatus.Completed or ProgramPlanDayStatus.Started or ProgramPlanDayStatus.Cancelled)
        {
            throw new InvalidOperationException("This day can no longer be moved.");
        }
        var plan = day.ProgramPlan;
        if (request.NewDate < plan.StartDate || (plan.EndDate.HasValue && request.NewDate > plan.EndDate.Value))
        {
            throw new InvalidOperationException("The new date is outside the program plan range.");
        }
        var conflict = await dbContext.ProgramPlanDays.AnyAsync(d =>
            d.ProgramPlanId == day.ProgramPlanId
            && d.Id != day.Id
            && d.ScheduledDate == request.NewDate
            && d.Status != ProgramPlanDayStatus.Cancelled
            && d.Status != ProgramPlanDayStatus.Skipped
            && (d.DayType == ProgramPlanDayType.Workout || d.DayType == ProgramPlanDayType.OptionalWorkout));
        if (conflict)
        {
            throw new InvalidOperationException("Another workout is already planned on that date.");
        }

        day.OriginalScheduledDate ??= day.ScheduledDate;
        day.ScheduledDate = request.NewDate;
        day.Status = ProgramPlanDayStatus.Rescheduled;
        await dbContext.SaveChangesAsync();
        return ProgramPlanMapper.ToModel(day);
    }

    public async Task<ProgramPlanDayModel> SkipAsync(long programPlanDayId, long userId)
    {
        var day = await LoadOwnedDayAsync(programPlanDayId, userId);
        if (day.Status is not (ProgramPlanDayStatus.Scheduled or ProgramPlanDayStatus.Missed or ProgramPlanDayStatus.Rescheduled))
        {
            throw new InvalidOperationException("This day cannot be skipped.");
        }
        day.Status = ProgramPlanDayStatus.Skipped;
        await dbContext.SaveChangesAsync();
        return ProgramPlanMapper.ToModel(day);
    }

    public async Task<ProgramPlanDayModel> RestoreAsync(long programPlanDayId, long userId)
    {
        var day = await LoadOwnedDayAsync(programPlanDayId, userId);
        if (day.Status is not (ProgramPlanDayStatus.Skipped or ProgramPlanDayStatus.Missed))
        {
            throw new InvalidOperationException("Only skipped or missed days can be restored.");
        }
        day.Status = day.ScheduledDate >= DateOnly.FromDateTime(DateTime.UtcNow)
            ? ProgramPlanDayStatus.Scheduled
            : ProgramPlanDayStatus.Missed;
        await dbContext.SaveChangesAsync();
        return ProgramPlanMapper.ToModel(day);
    }

    public async Task MarkMissedDaysAsync(long userId, DateOnly referenceDate)
    {
        var overdue = await dbContext.ProgramPlanDays
            .Where(d => d.ProgramPlan.UserId == userId
                && d.ProgramPlan.Status == ProgramPlanStatus.Active
                && d.ScheduledDate < referenceDate
                && (d.Status == ProgramPlanDayStatus.Scheduled || d.Status == ProgramPlanDayStatus.Rescheduled))
            .ToListAsync();

        foreach (var day in overdue)
        {
            day.Status = day.DayType == ProgramPlanDayType.OptionalWorkout
                ? ProgramPlanDayStatus.Skipped
                : ProgramPlanDayStatus.Missed;
        }
        if (overdue.Count > 0)
        {
            await dbContext.SaveChangesAsync();
        }
    }
```

- [ ] **Step 4: Run — expect PASS** (all ProgramPlanDayServiceTests).

- [ ] **Step 5: Commit**

```bash
git add server/FitMate.Services server/FitMate.Tests
git commit -m "feat(program-plans): missed/move/skip/restore day actions"
```

---

### Task 9: Today endpoint logic, open-ended top-up, calendar month, progress

**Files:**
- Modify: `server/FitMate.Services/ProgramPlans/ProgramPlanService.cs`
- Test: `server/FitMate.Tests/Unit/Services/ProgramPlanProgressTests.cs` + append today-tests to `ProgramPlanServiceTests.cs`

**Interfaces:** implements `GetTodayAsync`, `GetCalendarAsync`, `GetProgressAsync`. `ProgramPlanService` constructor grows to `(AppDbContext, IProgramPlanScheduleService, IProgramPlanDayService)` — the day service is used to mark missed days before reads.

Behavior:
- `GetTodayAsync(userId, date)`:
  1. Load active plan (with rules); if none → `{ Date = date, HasActiveProgram = false }`.
  2. Open-ended plan → **top-up**: if `maxGeneratedDate < date.AddDays(OpenEndedHorizonDays)`, generate `[maxGeneratedDate+1, date+28]` via `scheduleService.GenerateDays` and insert (idempotent because generation starts after the max persisted date).
  3. `await dayService.MarkMissedDaysAsync(userId, date)`.
  4. `Today` = day with `ScheduledDate == date` (prefer non-terminal statuses, lowest `OrderIndex`); include template name/duration/exercise count via `Include(d => d.WorkoutTemplate).ThenInclude(t => t.ExerciseGroups)`.
  5. `MissedWorkout` = earliest day with `Status == Missed`.
  6. `NextWorkout` = earliest workout-type day with `ScheduledDate > date` and `Status` in (Scheduled, Rescheduled).
- `GetCalendarAsync(planId, userId, year, month)`: ownership check; open-ended top-up so the requested month is populated up to the horizon; return all days in that month ordered by date + OrderIndex.
- `GetProgressAsync(planId, userId, today)` (spec §28): over workout-type days (`Workout` + `OptionalWorkout`, excluding `Cancelled` status):
  - `ScheduledWorkouts` = count; `CompletedWorkouts`, `StartedWorkouts`, `MissedWorkouts`, `SkippedWorkouts` = per-status counts; `RemainingWorkouts` = Scheduled + Rescheduled with date ≥ today.
  - `CompletionPercentage` = fixed-length only: `completed / all workout days * 100`, 2 decimals; null when `EndDate == null`.
  - `AdherencePercentage` = `completed / due` where due = workout days with `ScheduledDate <= today` (0 due → 100).
  - `CurrentStreak` = walk due mandatory (`Workout`) days ordered by date descending, skipping days that are `Skipped`; count consecutive `Completed`; stop at first `Missed` (a `Started` day today does not break the streak — skip it).

- [ ] **Step 1: Write failing tests**

`ProgramPlanProgressTests.cs`:

```csharp
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.ProgramPlans;
using FitMate.Tests.TestInfrastructure;

namespace FitMate.Tests.Unit.Services;

public class ProgramPlanProgressTests
{
    private static async Task<long> SeedPlanWithDaysAsync(
        SqliteTestDatabase db,
        DateOnly? endDate,
        params (DateOnly Date, ProgramPlanDayType Type, ProgramPlanDayStatus Status)[] days)
    {
        await using var context = db.CreateContext();
        var plan = new ProgramPlan
        {
            UserId = SqliteTestDatabase.UserId,
            Name = "P",
            Status = ProgramPlanStatus.Active,
            ScheduleType = ProgramScheduleType.FixedWeekdays,
            StartDate = new DateOnly(2026, 8, 3),
            EndDate = endDate,
            TargetWorkoutsPerWeek = 4,
        };
        context.ProgramPlans.Add(plan);
        await context.SaveChangesAsync();
        var order = 0;
        foreach (var (date, type, status) in days)
        {
            context.ProgramPlanDays.Add(new ProgramPlanDay
            {
                ProgramPlanId = plan.Id,
                ScheduledDate = date,
                DayType = type,
                Status = status,
                OrderIndex = order++,
            });
        }
        await context.SaveChangesAsync();
        return plan.Id;
    }

    private static ProgramPlanService CreateService(SqliteTestDatabase db)
    {
        var context = db.CreateContext();
        var workoutService = TestWorkoutServiceFactory.Create(context);
        return new ProgramPlanService(context, new ProgramPlanScheduleService(),
            new ProgramPlanDayService(context, workoutService));
    }

    [Fact]
    public async Task Progress_MatchesSpecExample()
    {
        using var db = new SqliteTestDatabase();
        var today = new DateOnly(2026, 8, 20);
        // 16 workouts: 11 completed, 1 started, 2 missed, 1 skipped, 1 remaining (future)
        var days = new List<(DateOnly, ProgramPlanDayType, ProgramPlanDayStatus)>();
        var d = new DateOnly(2026, 8, 3);
        for (var i = 0; i < 11; i++) { days.Add((d, ProgramPlanDayType.Workout, ProgramPlanDayStatus.Completed)); d = d.AddDays(1); }
        days.Add((d, ProgramPlanDayType.Workout, ProgramPlanDayStatus.Missed)); d = d.AddDays(1);
        days.Add((d, ProgramPlanDayType.Workout, ProgramPlanDayStatus.Missed)); d = d.AddDays(1);
        days.Add((d, ProgramPlanDayType.Workout, ProgramPlanDayStatus.Skipped)); d = d.AddDays(1);
        days.Add((new DateOnly(2026, 8, 20), ProgramPlanDayType.Workout, ProgramPlanDayStatus.Started));
        days.Add((new DateOnly(2026, 8, 22), ProgramPlanDayType.Workout, ProgramPlanDayStatus.Scheduled));
        var planId = await SeedPlanWithDaysAsync(db, new DateOnly(2026, 8, 30), days.ToArray());
        var service = CreateService(db);

        var progress = await service.GetProgressAsync(planId, SqliteTestDatabase.UserId, today);

        Assert.Equal(16, progress.ScheduledWorkouts);
        Assert.Equal(11, progress.CompletedWorkouts);
        Assert.Equal(1, progress.StartedWorkouts);
        Assert.Equal(2, progress.MissedWorkouts);
        Assert.Equal(1, progress.SkippedWorkouts);
        Assert.Equal(1, progress.RemainingWorkouts);
        Assert.Equal(68.75m, progress.CompletionPercentage);
    }

    [Fact]
    public async Task Progress_OpenEnded_HasNullCompletion()
    {
        using var db = new SqliteTestDatabase();
        var planId = await SeedPlanWithDaysAsync(db, endDate: null,
            (new DateOnly(2026, 8, 3), ProgramPlanDayType.Workout, ProgramPlanDayStatus.Completed));
        var service = CreateService(db);

        var progress = await service.GetProgressAsync(planId, SqliteTestDatabase.UserId, new DateOnly(2026, 8, 4));

        Assert.Null(progress.CompletionPercentage);
        Assert.Equal(100m, progress.AdherencePercentage);
    }

    [Fact]
    public async Task Streak_CountsConsecutiveCompletedDueDays_SkipDoesNotBreakButMissedDoes()
    {
        using var db = new SqliteTestDatabase();
        var planId = await SeedPlanWithDaysAsync(db, new DateOnly(2026, 8, 30),
            (new DateOnly(2026, 8, 3), ProgramPlanDayType.Workout, ProgramPlanDayStatus.Missed),
            (new DateOnly(2026, 8, 5), ProgramPlanDayType.Workout, ProgramPlanDayStatus.Completed),
            (new DateOnly(2026, 8, 7), ProgramPlanDayType.Workout, ProgramPlanDayStatus.Skipped),
            (new DateOnly(2026, 8, 9), ProgramPlanDayType.Workout, ProgramPlanDayStatus.Completed),
            (new DateOnly(2026, 8, 11), ProgramPlanDayType.Workout, ProgramPlanDayStatus.Completed));
        var service = CreateService(db);

        var progress = await service.GetProgressAsync(planId, SqliteTestDatabase.UserId, new DateOnly(2026, 8, 12));

        Assert.Equal(3, progress.CurrentStreak); // 11th, 9th, (skip ignored), 5th; missed on 3rd stops it
    }
```

Append to `ProgramPlanServiceTests.cs` (update `CreateService` there to the 3-arg constructor):

```csharp
    [Fact]
    public async Task GetToday_ReturnsTodayMissedAndNext()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var service = CreateService(db);
        var request = FixedWeekdayRequest(templateId); // Mon + Thu, Aug 3–30
        var created = await service.CreateDraftAsync(request, SqliteTestDatabase.UserId);
        await service.ActivateAsync(created.Id, SqliteTestDatabase.UserId);

        var today = await service.GetTodayAsync(SqliteTestDatabase.UserId, new DateOnly(2026, 8, 6)); // a Thursday

        Assert.True(today.HasActiveProgram);
        Assert.Equal(created.Id, today.ProgramId);
        Assert.NotNull(today.Today);
        Assert.Equal(new DateOnly(2026, 8, 6), today.Today!.ScheduledDate);
        Assert.NotNull(today.MissedWorkout);                       // Monday Aug 3 became Missed
        Assert.Equal(new DateOnly(2026, 8, 3), today.MissedWorkout!.ScheduledDate);
        Assert.NotNull(today.NextWorkout);
        Assert.Equal(new DateOnly(2026, 8, 10), today.NextWorkout!.ScheduledDate);
    }

    [Fact]
    public async Task GetToday_NoActivePlan_ReturnsHasActiveProgramFalse()
    {
        using var db = new SqliteTestDatabase();
        var service = CreateService(db);

        var today = await service.GetTodayAsync(SqliteTestDatabase.UserId, new DateOnly(2026, 8, 6));

        Assert.False(today.HasActiveProgram);
        Assert.Null(today.Today);
    }

    [Fact]
    public async Task GetToday_OpenEnded_TopsUpHorizon()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var service = CreateService(db);
        var request = FixedWeekdayRequest(templateId);
        request.StartDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-60);
        request.EndDate = null;
        var created = await service.CreateDraftAsync(request, SqliteTestDatabase.UserId);
        await service.ActivateAsync(created.Id, SqliteTestDatabase.UserId);
        var queryDate = DateOnly.FromDateTime(DateTime.UtcNow);

        await service.GetTodayAsync(SqliteTestDatabase.UserId, queryDate);

        await using var context = db.CreateContext();
        var maxDate = context.ProgramPlanDays
            .Where(d => d.ProgramPlanId == created.Id)
            .Max(d => d.ScheduledDate);
        Assert.True(maxDate > queryDate.AddDays(14)); // horizon extended well past today
    }
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement** the three methods plus a private `EnsureUpcomingDaysAsync`:

```csharp
    private async Task EnsureUpcomingDaysAsync(ProgramPlan plan, DateOnly referenceDate)
    {
        if (plan.EndDate != null || plan.Status != ProgramPlanStatus.Active
            || plan.ScheduleType == ProgramScheduleType.CustomCalendar)
        {
            return;
        }

        var maxGenerated = await dbContext.ProgramPlanDays
            .Where(d => d.ProgramPlanId == plan.Id)
            .MaxAsync(d => (DateOnly?)d.ScheduledDate) ?? plan.StartDate.AddDays(-1);

        var horizonEnd = referenceDate.AddDays(OpenEndedHorizonDays);
        if (maxGenerated >= horizonEnd)
        {
            return;
        }

        var newDays = scheduleService.GenerateDays(plan, maxGenerated.AddDays(1), horizonEnd);
        if (newDays.Count > 0)
        {
            dbContext.ProgramPlanDays.AddRange(newDays);
            await dbContext.SaveChangesAsync();
        }
    }

    public async Task<ProgramTodayModel> GetTodayAsync(long userId, DateOnly date)
    {
        var plan = await dbContext.ProgramPlans
            .Include(p => p.ScheduleRules)
            .FirstOrDefaultAsync(p => p.UserId == userId && p.Status == ProgramPlanStatus.Active);
        if (plan == null)
        {
            return new ProgramTodayModel { Date = date, HasActiveProgram = false };
        }

        await EnsureUpcomingDaysAsync(plan, date);
        await dayService.MarkMissedDaysAsync(userId, date);

        var days = await dbContext.ProgramPlanDays
            .AsNoTracking()
            .Include(d => d.WorkoutTemplate)!.ThenInclude(t => t!.ExerciseGroups)
            .Where(d => d.ProgramPlanId == plan.Id && d.Status != ProgramPlanDayStatus.Cancelled)
            .OrderBy(d => d.ScheduledDate).ThenBy(d => d.OrderIndex)
            .ToListAsync();

        var today = days.FirstOrDefault(d => d.ScheduledDate == date
            && d.Status is ProgramPlanDayStatus.Scheduled or ProgramPlanDayStatus.Started
                or ProgramPlanDayStatus.Rescheduled or ProgramPlanDayStatus.Completed);
        var missed = days.FirstOrDefault(d => d.Status == ProgramPlanDayStatus.Missed);
        var next = days.FirstOrDefault(d => d.ScheduledDate > date
            && (d.DayType == ProgramPlanDayType.Workout || d.DayType == ProgramPlanDayType.OptionalWorkout)
            && d.Status is ProgramPlanDayStatus.Scheduled or ProgramPlanDayStatus.Rescheduled);

        return new ProgramTodayModel
        {
            Date = date,
            HasActiveProgram = true,
            ProgramId = plan.Id,
            ProgramName = plan.Name,
            Today = today == null ? null : ProgramPlanMapper.ToModel(today),
            MissedWorkout = missed == null ? null : ProgramPlanMapper.ToModel(missed),
            NextWorkout = next == null ? null : ProgramPlanMapper.ToModel(next),
        };
    }

    public async Task<IReadOnlyList<ProgramPlanDayModel>> GetCalendarAsync(long planId, long userId, int year, int month)
    {
        var plan = await dbContext.ProgramPlans
            .Include(p => p.ScheduleRules)
            .FirstOrDefaultAsync(p => p.Id == planId && p.UserId == userId)
            ?? throw new KeyNotFoundException("Program plan not found.");

        var monthStart = new DateOnly(year, month, 1);
        var monthEnd = monthStart.AddMonths(1).AddDays(-1);
        await EnsureUpcomingDaysAsync(plan, DateOnly.FromDateTime(DateTime.UtcNow));
        await dayService.MarkMissedDaysAsync(userId, DateOnly.FromDateTime(DateTime.UtcNow));

        var days = await dbContext.ProgramPlanDays
            .AsNoTracking()
            .Include(d => d.WorkoutTemplate)!.ThenInclude(t => t!.ExerciseGroups)
            .Where(d => d.ProgramPlanId == plan.Id
                && d.ScheduledDate >= monthStart && d.ScheduledDate <= monthEnd)
            .OrderBy(d => d.ScheduledDate).ThenBy(d => d.OrderIndex)
            .ToListAsync();
        return days.Select(ProgramPlanMapper.ToModel).ToList();
    }

    public async Task<ProgramProgressModel> GetProgressAsync(long planId, long userId, DateOnly today)
    {
        var plan = await dbContext.ProgramPlans
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == planId && p.UserId == userId)
            ?? throw new KeyNotFoundException("Program plan not found.");

        var workoutDays = await dbContext.ProgramPlanDays
            .AsNoTracking()
            .Where(d => d.ProgramPlanId == planId
                && d.Status != ProgramPlanDayStatus.Cancelled
                && (d.DayType == ProgramPlanDayType.Workout || d.DayType == ProgramPlanDayType.OptionalWorkout))
            .OrderBy(d => d.ScheduledDate)
            .ToListAsync();

        var completed = workoutDays.Count(d => d.Status == ProgramPlanDayStatus.Completed);
        var due = workoutDays.Count(d => d.ScheduledDate <= today);

        var streak = 0;
        foreach (var day in workoutDays
                     .Where(d => d.DayType == ProgramPlanDayType.Workout && d.ScheduledDate <= today)
                     .OrderByDescending(d => d.ScheduledDate))
        {
            if (day.Status is ProgramPlanDayStatus.Skipped or ProgramPlanDayStatus.Started)
            {
                continue;
            }
            if (day.Status == ProgramPlanDayStatus.Completed)
            {
                streak++;
                continue;
            }
            break;
        }

        return new ProgramProgressModel
        {
            ScheduledWorkouts = workoutDays.Count,
            CompletedWorkouts = completed,
            StartedWorkouts = workoutDays.Count(d => d.Status == ProgramPlanDayStatus.Started),
            MissedWorkouts = workoutDays.Count(d => d.Status == ProgramPlanDayStatus.Missed),
            SkippedWorkouts = workoutDays.Count(d => d.Status == ProgramPlanDayStatus.Skipped),
            RemainingWorkouts = workoutDays.Count(d => d.ScheduledDate >= today
                && d.Status is ProgramPlanDayStatus.Scheduled or ProgramPlanDayStatus.Rescheduled),
            CompletionPercentage = plan.EndDate == null || workoutDays.Count == 0
                ? null
                : Math.Round(completed * 100m / workoutDays.Count, 2),
            AdherencePercentage = due == 0 ? 100m : Math.Round(completed * 100m / due, 2),
            CurrentStreak = streak,
        };
    }
```

Constructor change: add `private readonly IProgramPlanDayService dayService;` and the third ctor parameter; update `CreateService` in ALL test files to `new ProgramPlanService(context, new ProgramPlanScheduleService(), new ProgramPlanDayService(context, TestWorkoutServiceFactory.Create(context)))`.

- [ ] **Step 4: Run — expect PASS** (`--filter "ProgramPlan"`), then full suite.

- [ ] **Step 5: Commit**

```bash
git add server/FitMate.Services server/FitMate.Tests
git commit -m "feat(program-plans): today endpoint, open-ended top-up, calendar, progress"
```

---

### Task 10: Controllers, DI, type export

**Files:**
- Create: `server/FitMate.Web/Controllers/ProgramPlanController.cs`, `ProgramPlanDayController.cs`
- Modify: `server/FitMate.Web/Program.cs` (3 DI lines)

**Interfaces:**
- Consumes: `IProgramPlanService`, `IProgramPlanDayService`.
- Produces the HTTP surface Plan 02's frontend consumes:

```
GET    /api/program-plans                     → ProgramPlanModel[]
GET    /api/program-plans/active              → ProgramPlanModel | error "No active program plan."
GET    /api/program-plans/active/today?date=  → ProgramTodayModel
GET    /api/program-plans/{id}                → ProgramPlanModel
GET    /api/program-plans/{id}/calendar?year=&month= → ProgramPlanDayModel[]
GET    /api/program-plans/{id}/progress?date= → ProgramProgressModel
POST   /api/program-plans                     → ProgramPlanModel        (create draft)
PUT    /api/program-plans/{id}                → ProgramPlanModel        (update draft)
POST   /api/program-plans/{id}/activate       → ProgramPlanModel
POST   /api/program-plans/{id}/pause          → true
POST   /api/program-plans/{id}/complete       → true
POST   /api/program-plans/{id}/cancel         → true
DELETE /api/program-plans/{id}                → bool                    (drafts only)
POST   /api/program-plan-days/{id}/start      → long (workoutId)
POST   /api/program-plan-days/{id}/move       → ProgramPlanDayModel    (body: MoveProgramDayRequest)
POST   /api/program-plan-days/{id}/skip       → ProgramPlanDayModel
POST   /api/program-plan-days/{id}/restore    → ProgramPlanDayModel
```

- [ ] **Step 1: Write `ProgramPlanController`** — copy `WorkoutTemplateController`'s exact shape (ctor, unauthorized guard, `ReturnJson`). One representative action; the rest follow identically:

```csharp
using FitMate.Core.JsonModels.ProgramPlans;
using FitMate.DB;
using FitMate.Services.ProgramPlans;
using FitMate.Services.Users;
using FitMate.Web.Controllers.Base;
using FitMate.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FitMate.Web.Controllers;

[Authorize]
[Route("api/program-plans")]
public class ProgramPlanController : BaseApiController
{
    private readonly IProgramPlanService programPlanService;

    public ProgramPlanController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService,
        IProgramPlanService programPlanService)
        : base(logger, dbContext, userService)
    {
        this.programPlanService = programPlanService;
    }

    [HttpGet("active/today")]
    public async Task<ActionResult> GetToday([FromQuery] DateOnly? date)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var referenceDate = date ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var model = await programPlanService.GetTodayAsync(userId.Value, referenceDate);
        return this.ReturnJson(model);
    }

    // List, GetById, GetActive, GetCalendar(year, month), GetProgress(date),
    // Create, Update, Activate, Pause, Complete, Cancel, Delete — same guard + ReturnJson pattern,
    // routes exactly as in the Interfaces table. InvalidOperationException/KeyNotFoundException
    // surface via the repo's existing error handling (check how other controllers translate
    // service exceptions — LogApiErrorAttribute — and do the same).
}
```

`ProgramPlanDayController` (`[Route("api/program-plan-days")]`): `Start`, `Move`, `Skip`, `Restore` — same pattern, calling `IProgramPlanDayService`.

- [ ] **Step 2: Register DI** — in `Program.cs`, after `IWorkoutTemplateService`:

```csharp
builder.Services.AddScoped<IProgramPlanScheduleService, ProgramPlanScheduleService>();
builder.Services.AddScoped<IProgramPlanService, ProgramPlanService>();
builder.Services.AddScoped<IProgramPlanDayService, ProgramPlanDayService>();
```

- [ ] **Step 3: Build + regenerate types**

Run: `dotnet build server/FitMate.Web/FitMate.Web.csproj`
Then: `cd client && npm run process-types && npx tsc -b --noEmit`
Expected: `client/src/types/backend.ts` now contains `ProgramPlanModel`, `ProgramTodayModel`, `SaveProgramPlanRequest`, the enums, etc.; tsc clean.

- [ ] **Step 4: Run full test suite**

Run: `dotnet test server/FitMate.sln`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/FitMate.Web client/src/types
git commit -m "feat(program-plans): API controllers, DI registration and generated types"
```

---

### Task 11: Integration smoke test (auth + ownership through HTTP)

**Files:**
- Create: `server/FitMate.Tests/Integration/ProgramPlanApiTests.cs`

**Interfaces:** consumes `TestWebApplicationFactory`, `IntegrationTestExtensions` (`CreateApiClient`, `CreateUserClientAsync(email)`), and `ApiResponse<T>` (`Success`/`Data`/`Error` envelope) — all already in `TestInfrastructure`.

- [ ] **Step 1: Write tests**

```csharp
using System.Net;
using System.Net.Http.Json;
using FitMate.Core.JsonModels.ProgramPlans;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitMate.Tests.Integration;

public class ProgramPlanApiTests
{
    private static async Task<long> SeedTemplateForUserAsync(TestWebApplicationFactory factory, string email)
    {
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var userId = await context.Users
            .Where(u => u.Email == email)
            .Select(u => u.Id)
            .SingleAsync();
        var template = new WorkoutTemplate { UserId = userId, Name = "Upper A", IsPublic = false };
        context.WorkoutTemplates.Add(template);
        await context.SaveChangesAsync();
        return template.Id;
    }

    private static SaveProgramPlanRequest ValidRequest(long templateId) => new()
    {
        Name = "Integration plan",
        Goal = TrainingGoal.Hypertrophy,
        ScheduleType = ProgramScheduleType.FixedWeekdays,
        StartDate = DateOnly.FromDateTime(DateTime.UtcNow),
        EndDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(28),
        TargetWorkoutsPerWeek = 1,
        ScheduleRules =
        [
            new ProgramScheduleRuleRequest
            {
                DayOfWeek = DateTime.UtcNow.DayOfWeek,
                DayType = ProgramPlanDayType.Workout,
                WorkoutTemplateId = templateId,
                OrderIndex = 0,
            },
        ],
    };

    [Fact]
    public async Task ProgramPlanEndpoints_WithoutAuth_Return401()
    {
        using var factory = new TestWebApplicationFactory();
        var client = factory.CreateApiClient();

        var response = await client.GetAsync("/api/program-plans");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task CreateActivateAndGetToday_ReturnsActiveProgram()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateUserClientAsync("plan-owner@test.local");
        var templateId = await SeedTemplateForUserAsync(factory, "plan-owner@test.local");

        var createResponse = await client.PostAsJsonAsync("/api/program-plans", ValidRequest(templateId));
        createResponse.EnsureSuccessStatusCode();
        var created = await createResponse.Content.ReadFromJsonAsync<ApiResponse<ProgramPlanModel>>();
        Assert.True(created!.Success);

        var activateResponse = await client.PostAsync($"/api/program-plans/{created.Data!.Id}/activate", null);
        activateResponse.EnsureSuccessStatusCode();

        var todayResponse = await client.GetAsync("/api/program-plans/active/today");
        var today = await todayResponse.Content.ReadFromJsonAsync<ApiResponse<ProgramTodayModel>>();
        Assert.True(today!.Success);
        Assert.True(today.Data!.HasActiveProgram);
        Assert.Equal(created.Data.Id, today.Data.ProgramId);
    }

    [Fact]
    public async Task GetById_OtherUsersPlan_ReturnsErrorEnvelope()
    {
        using var factory = new TestWebApplicationFactory();
        var ownerClient = await factory.CreateUserClientAsync("plan-owner-b@test.local");
        var templateId = await SeedTemplateForUserAsync(factory, "plan-owner-b@test.local");
        var createResponse = await ownerClient.PostAsJsonAsync("/api/program-plans", ValidRequest(templateId));
        var created = await createResponse.Content.ReadFromJsonAsync<ApiResponse<ProgramPlanModel>>();

        var strangerClient = await factory.CreateUserClientAsync("stranger@test.local");
        var response = await strangerClient.GetAsync($"/api/program-plans/{created!.Data!.Id}");
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<ProgramPlanModel>>();

        Assert.False(body!.Success);
    }
}
```

> Note: `DateOnly` in query/body serialization — the API's JSON options must serialize `DateOnly` as
> `yyyy-MM-dd`. .NET 9's `System.Text.Json` does this by default; if the first run fails on date
> parsing, check the JSON options configured in `Program.cs`.

- [ ] **Step 2: Run** `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter ProgramPlanApiTests` — expect PASS.

- [ ] **Step 3: Commit**

```bash
git add server/FitMate.Tests
git commit -m "test(program-plans): integration smoke tests for API"
```

---

## Acceptance criteria (Plan 01 done)

- User can create a draft plan from workout templates (fixed weekdays, rotation, or custom days), fixed-length or open-ended.
- Activation generates persisted calendar days in a transaction; one active plan max.
- `GET /api/program-plans/active/today` answers "what should I train today" from the database, marks overdue days missed, and tops up open-ended horizons.
- Start is idempotent and creates a real Workout from the template; finishing that workout completes the program day.
- Move/skip/restore follow spec §27; progress matches spec §28 formulas (68.75% test).
- `dotnet build` + `dotnet test server/FitMate.sln` green; generated TS types contain the new models.
