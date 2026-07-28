# AI Program Plan Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The AI coach can propose a complete training program (`propose_program_plan`), the proposal is validated deterministically, the user confirms it on a preview card, and confirmation creates a **DRAFT** `ProgramPlan` (never auto-activated) — plus a `propose_program_update` flow that reshapes only the future days of an active plan.

**Architecture:** Two new `IAiToolHandler`s (`propose_program_plan`, `propose_program_update`) validate spec-§31 argument payloads with a pure `ProgramPlanProposalValidator` (errors → tool failure so the model retries; warnings → stored on the `AiAction`), reserve/commit `SubscriptionFeature.AiProgramGeneration` usage, and create pending `AiAction`s. Two new `IAiActionExecutor`s run on confirmation: `CreateProgramPlanActionExecutor` first creates any `NewTemplates` via `IWorkoutTemplateService.CreateAsync` (ClientKey → id map), then calls `IProgramPlanService.CreateDraftAsync`; `UpdateProgramPlanActionExecutor` funnels into a new `IProgramPlanService.UpdateActiveScheduleAsync` that deletes only future `Scheduled` days and regenerates from tomorrow. The frontend renders a `ProgramPlanProposalCard` in the AI chat; activation stays an explicit user step (`POST api/program-plans/{id}/activate`).

**Tech Stack:** .NET 9, EF Core (Sqlite in tests), System.Text.Json, xUnit; React 19 + TypeScript + generated `backend.ts` types on the client. Builds on Plan 01 (`IProgramPlanService`, `IProgramPlanScheduleService`), Plan 04 (`IEntitlementService`, `IUsageService`), Plan 05 (orchestrator, `IAiToolHandler`, fake provider), Plan 06 (`AiAction`, `IAiActionExecutor`, action cards).

## Global Constraints

- **Contract note (applied 2026-07-27 during cross-plan review):** the authoritative signatures are `IAiToolHandler.ExecuteAsync(...) : Task<AiToolExecutionResult>` (spec §12), `IAiActionExecutor.ExecuteAsync(...) : Task<AiActionExecutionResult>` (spec §84, Plan 06) and `IUsageService.ReserveAsync(...) : Task<UsageReservationModel>` (Plan 04). Signature lines below were corrected to match; where a method body still ends in `return JsonSerializer.Serialize(...)` or `return AiActionJson.Serialize(...)`, wrap that value instead of returning it raw — `new AiToolExecutionResult { Success = true, RequiresConfirmation = true, AiActionId = action.Id, Data = <the anonymous object> }` for tools, and the `AiActionExecutionResult { CreatedEntityId, CreatedEntityName }` shape for executors. Use `reservation.Id` (not the reservation itself) when calling `CommitAsync`/`ReleaseAsync`, and `context.AiRunId` (not `context.RunId`).

- Follow repo conventions (roadmap D4): services take `(request, long userId)`, **no CancellationToken** — EXCEPT `IAiToolHandler.ExecuteAsync` / `IAiActionExecutor.ExecuteAsync` and `FitMate.Integrations` provider interfaces, which DO take `CancellationToken` (roadmap shared contracts).
- Nothing outside `server/FitMate.Integrations` references OpenAI types (roadmap D6). Everything in this plan lives in `FitMate.Services`/`FitMate.Core` against Plan 05's neutral abstractions.
- Spec §33 non-negotiable: the executor **NEVER** activates the plan. Result is a DRAFT; activation is the user's explicit `POST api/program-plans/{id}/activate`.
- Spec §32: validation **errors** → tool returns `Success=false` with messages (model retries); **warnings** are confirmable and stored in the action's `ValidationSummaryJson`.
- Usage (spec §47-48 semantics): reserve `SubscriptionFeature.AiProgramGeneration` before creating the action, commit on action creation, release on failure. Validation errors happen **before** the reservation, so a rejected proposal costs no quota.
- Exercises referenced in proposals must already exist (roadmap D5 three-step flow); the validator rejects unknown exercise ids with a message telling the model to use `propose_exercise` first.
- `EndDate == null` = open-ended plan (roadmap D1) — valid in proposals for FixedWeekdays/Rotation.
- Every AiAction payload is serialized with Plan 05's shared AI JSON options (camelCase + string enums). DTOs live in `FitMate.Core/JsonModels/AI/` so Reinforced.Typings exports them (all `FitMate.Core.JsonModels.*` types are auto-exported — see `server/FitMate.Web/Infrastructure/ReinforcedTypingsConfiguration.cs`).
- Validation exceptions use the existing `FitMateException` (`server/FitMate.Core/Exceptions/FitMateException.cs`).
- `AppDbContext.SaveChangesAsync()` stamps `DateCreated`/`DateModified` — never set them manually.
- After backend DTO changes: `dotnet build server/FitMate.Web/FitMate.Web.csproj` then `cd client && npm run process-types`. After any React/TS change: `cd client && npm run lint && npx tsc -b --noEmit`.
- All commands run from repo root `c:\Users\damian\Documents\Github\FitMate`.
- Plans 04/05/06 land before this plan. Where this plan best-guesses one of their internal names, the step carries a "verify against … at execution time" note — reconcile the name, keep the behavior.

## File Structure

```
server/FitMate.Core/JsonModels/AI/
├── ProposeProgramPlanArguments.cs        (Task 1)  [args + ProposedProgramScheduleItem
│                                                    + ProposedWorkoutTemplate + ProposedTemplateExercise
│                                                    + ProposedTemplateSet]
├── ProposeProgramUpdateArguments.cs      (Task 1)
├── CreateProgramPlanActionResultModel.cs (Task 1)
└── UpdateProgramPlanActionResultModel.cs (Task 1)

server/FitMate.Services/AI/
├── ProgramGeneration/ProgramPlanProposalValidator.cs   (Task 2)
│   [+ ProgramPlanProposalContext, ProgramPlanProposalValidationResult in same folder]
├── Tools/ProposeProgramPlanToolHandler.cs              (Task 3)
├── Tools/ProposeProgramUpdateToolHandler.cs            (Task 6)
├── Actions/CreateProgramPlanActionExecutor.cs          (Task 4)
├── Actions/UpdateProgramPlanActionExecutor.cs          (Task 6)
└── Prompts/program-generation-v1.txt                   (Task 3)

server/FitMate.DB/Enums/AiActionType.cs (modify if members missing)      (Task 1)
server/FitMate.Services/ProgramPlans/IProgramPlanService.cs (modify)     (Task 5)
server/FitMate.Services/ProgramPlans/ProgramPlanService.cs (modify)      (Task 5)
server/FitMate.Services/FitMate.Services.csproj (modify: prompt copy)    (Task 3)
server/FitMate.Web/Program.cs (modify: DI)                               (Tasks 3, 4, 6)

server/FitMate.Tests/Unit/Services/
├── ProgramPlanProposalValidatorTests.cs                (Task 2)
├── ProposeProgramPlanToolHandlerTests.cs               (Task 3)
├── CreateProgramPlanActionExecutorTests.cs             (Task 4)
├── ProgramPlanUpdateScheduleTests.cs                   (Task 5)
└── UpdateProgramPlanActionExecutorTests.cs             (Task 6)
server/FitMate.Tests/Unit/Ai/AiProgramGenerationContractTests.cs (Task 7)

client/src/pages/Coach/components/actions/ProgramPlanProposalCard.tsx    (Task 8)
client/src/pages/Coach/components/AiActionCard.tsx (modify: register)    (Task 8)
client/src/pages/Program/components/ActivateProgramDialog.tsx            (Task 8)
client/src/pages/Program/... (modify: wire dialog into activate flow)    (Task 8)
client/src/types/backend.ts + JsonModels/ (regenerated)                  (Tasks 1, 8)
```

> Frontend paths under `pages/Coach` and `pages/Program` are the expected outputs of Plans 06 and 02.
> Verify the actual directory names those plans created at execution time and place files in the
> matching locations (the component names and behavior are fixed; only the directories may differ).

---

### Task 1: Proposal DTOs (spec §31 shapes) + AiActionType members

**Files:**
- Create: `server/FitMate.Core/JsonModels/AI/ProposeProgramPlanArguments.cs`, `ProposeProgramUpdateArguments.cs`, `CreateProgramPlanActionResultModel.cs`, `UpdateProgramPlanActionResultModel.cs`
- Modify (only if members missing): `server/FitMate.DB/Enums/AiActionType.cs`

**Interfaces:**
- Consumes: `TrainingGoal`, `ProgramScheduleType`, `ProgramPlanDayType` (Plan 01 enums), `AiActionType` (Plan 06 enum).
- Produces the exact spec-§31 argument types every later task uses: `ProposeProgramPlanArguments`, `ProposedProgramScheduleItem`, `ProposedWorkoutTemplate`, `ProposedTemplateExercise`, `ProposedTemplateSet`, `ProposeProgramUpdateArguments`, `CreateProgramPlanActionResultModel`, `UpdateProgramPlanActionResultModel`.

- [ ] **Step 1: Write the argument DTOs** (`server/FitMate.Core/JsonModels/AI/ProposeProgramPlanArguments.cs` — all five classes in one file, matching how Plan 06 grouped its proposal argument files; split per-class if Plan 06 used one-class-per-file)

```csharp
using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.AI;

public class ProposeProgramPlanArguments
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public TrainingGoal Goal { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly? EndDate { get; set; }              // null = open-ended (roadmap D1 extension of spec §31)
    public ProgramScheduleType ScheduleType { get; set; }
    public int WorkoutsPerWeek { get; set; }
    public List<ProposedProgramScheduleItem> Schedule { get; set; } = [];
    public List<ProposedWorkoutTemplate> NewTemplates { get; set; } = [];
}

public class ProposedProgramScheduleItem
{
    public string ClientKey { get; set; } = string.Empty;
    public DayOfWeek? DayOfWeek { get; set; }           // FixedWeekdays only
    public int? RotationDayIndex { get; set; }          // Rotation only, 1-based sequential
    public ProgramPlanDayType DayType { get; set; }
    public long? ExistingWorkoutTemplateId { get; set; }
    public string? NewWorkoutTemplateClientKey { get; set; }
    public bool IsOptional { get; set; }
}

public class ProposedWorkoutTemplate
{
    public string ClientKey { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int? EstimatedDurationMinutes { get; set; }
    public List<ProposedTemplateExercise> Exercises { get; set; } = [];
}

public class ProposedTemplateExercise
{
    public long ExerciseId { get; set; }                // must reference an EXISTING exercise
    public string? Notes { get; set; }
    public List<ProposedTemplateSet> Sets { get; set; } = [];
}

public class ProposedTemplateSet
{
    public int? Reps { get; set; }
    public decimal? WeightKg { get; set; }
    public int? DurationSeconds { get; set; }
    public int? RestSeconds { get; set; }
    public decimal? Rpe { get; set; }
}
```

- [ ] **Step 2: Write the update arguments and executor result DTOs**

`server/FitMate.Core/JsonModels/AI/ProposeProgramUpdateArguments.cs`:

```csharp
using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.AI;

public class ProposeProgramUpdateArguments
{
    public long ProgramPlanId { get; set; }
    public string Reason { get; set; } = string.Empty;
    public int WorkoutsPerWeek { get; set; }
    public List<ProposedProgramScheduleItem> Schedule { get; set; } = [];
    public List<ProposedWorkoutTemplate> NewTemplates { get; set; } = [];
}
```

`server/FitMate.Core/JsonModels/AI/CreateProgramPlanActionResultModel.cs`:

```csharp
namespace FitMate.Core.JsonModels.AI;

public class CreateProgramPlanActionResultModel
{
    public long ProgramPlanId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int? PlannedWorkouts { get; set; }           // null for open-ended plans
    public List<long> CreatedTemplateIds { get; set; } = [];
}
```

`server/FitMate.Core/JsonModels/AI/UpdateProgramPlanActionResultModel.cs`:

```csharp
namespace FitMate.Core.JsonModels.AI;

public class UpdateProgramPlanActionResultModel
{
    public long ProgramPlanId { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateOnly EffectiveFrom { get; set; }
    public int RegeneratedDays { get; set; }
    public List<long> CreatedTemplateIds { get; set; } = [];
}
```

- [ ] **Step 3: Ensure `AiActionType` has the two members.** Open `server/FitMate.DB/Enums/AiActionType.cs` (created by Plan 06). It must contain `CreateProgramPlan` and `UpdateProgramPlan` with the numeric values the spec PDF §34 assigns. If Plan 06 already added them (it should — the enum is printed in full in the spec), change nothing; if missing, append them with the spec's values. Verify against the spec PDF §34 enum listing at execution time.

- [ ] **Step 4: Build + regenerate types**

Run: `dotnet build server/FitMate.sln`
Then: `dotnet build server/FitMate.Web/FitMate.Web.csproj` and `cd client && npm run process-types`
Expected: build OK; `client/src/types/JsonModels/AI/` now contains `ProposeProgramPlanArguments.ts`, `ProposedProgramScheduleItem.ts`, `CreateProgramPlanActionResultModel.ts`, etc., and `DayOfWeek` appears under `JsonModels/Enums` (Plan 01 already exports it via `ProgramScheduleRuleRequest`).

- [ ] **Step 5: Commit**

```bash
git add server/FitMate.Core server/FitMate.DB client/src/types
git commit -m "feat(ai-program): spec-31 proposal argument DTOs and action result models"
```

---

### Task 2: ProgramPlanProposalValidator (pure logic, TDD — every §32 rule)

**Files:**
- Create: `server/FitMate.Services/AI/ProgramGeneration/ProgramPlanProposalValidator.cs`
- Test: `server/FitMate.Tests/Unit/Services/ProgramPlanProposalValidatorTests.cs`

**Interfaces:**
- Consumes: Task 1 DTOs, Plan 01 enums.
- Produces (Tasks 3 and 6 call these exact signatures):

```csharp
namespace FitMate.Services.AI.ProgramGeneration;

public class ProgramPlanProposalContext
{
    public IReadOnlySet<long> VisibleTemplateIds { get; init; } = new HashSet<long>();
    public IReadOnlySet<long> VisibleExerciseIds { get; init; } = new HashSet<long>();
    public int? MaxDurationMonths { get; init; }        // ProgramPlanDurationMonths entitlement; null = unlimited
}

public class ProgramPlanProposalValidationResult
{
    public List<string> Errors { get; } = [];
    public List<string> Warnings { get; } = [];
    public bool IsValid => Errors.Count == 0;
}

public class ProgramPlanProposalValidator
{
    public ProgramPlanProposalValidationResult Validate(
        ProposeProgramPlanArguments args, ProgramPlanProposalContext context);
    public ProgramPlanProposalValidationResult ValidateUpdate(
        ProposeProgramUpdateArguments args, ProgramScheduleType scheduleType,
        DateOnly effectiveFrom, ProgramPlanProposalContext context);
}
```

Rules (spec §32). **Errors:** empty name; start after end; duration exceeds `MaxDurationMonths`; workouts/week outside 1–7; `ScheduleType == CustomCalendar` (AI proposals cannot carry per-date custom days — spec §31 args have no date field, so "custom schedule invalid dates" is realized as "CustomCalendar not supported for AI proposals"); referenced template missing/not visible; referenced exercise missing/not visible; FixedWeekdays item without `DayOfWeek` or with `RotationDayIndex`; Rotation item without `RotationDayIndex` or with `DayOfWeek`; rotation indexes not exactly `1..N` sequential; duplicate schedule rules (duplicate `DayOfWeek` / duplicate schedule `ClientKey`); duplicate template `ClientKey`s; `NewWorkoutTemplateClientKey` pointing nowhere; workout day referencing both or neither template source; rest day referencing a template; template with no exercises; set values out of range (Reps 1–100, WeightKg 0–1000, DurationSeconds 1–7200, RestSeconds 0–3600, Rpe 0–10, 1–10 sets per exercise). **Warnings** (only computed when there are zero errors): more than 3 consecutive training days (wrap-aware across the week/rotation cycle; training = Workout/OptionalWorkout/Deload); workouts/week mismatch vs schedule count; plan longer than 16 weeks.

- [ ] **Step 1: Write failing tests** (`ProgramPlanProposalValidatorTests.cs` — pure unit tests, no database)

```csharp
using FitMate.Core.JsonModels.AI;
using FitMate.DB.Enums;
using FitMate.Services.AI.ProgramGeneration;

namespace FitMate.Tests.Unit.Services;

public class ProgramPlanProposalValidatorTests
{
    private static ProgramPlanProposalContext Context(int? maxMonths = 3) => new()
    {
        VisibleTemplateIds = new HashSet<long> { 10 },
        VisibleExerciseIds = new HashSet<long> { 100, 101, 102 },
        MaxDurationMonths = maxMonths,
    };

    private static ProposedWorkoutTemplate NewTemplate(string clientKey = "tpl-a", string name = "Upper A") => new()
    {
        ClientKey = clientKey,
        Name = name,
        Exercises =
        [
            new ProposedTemplateExercise
            {
                ExerciseId = 100,
                Sets = [new ProposedTemplateSet { Reps = 8, WeightKg = 60, RestSeconds = 120, Rpe = 8 }],
            },
        ],
    };

    private static ProposeProgramPlanArguments ValidProposal() => new()
    {
        Name = "August Hypertrophy",
        Goal = TrainingGoal.Hypertrophy,
        StartDate = new DateOnly(2026, 8, 3),
        EndDate = new DateOnly(2026, 8, 30),
        ScheduleType = ProgramScheduleType.FixedWeekdays,
        WorkoutsPerWeek = 3,
        Schedule =
        [
            new ProposedProgramScheduleItem { ClientKey = "mon", DayOfWeek = DayOfWeek.Monday, DayType = ProgramPlanDayType.Workout, NewWorkoutTemplateClientKey = "tpl-a" },
            new ProposedProgramScheduleItem { ClientKey = "wed", DayOfWeek = DayOfWeek.Wednesday, DayType = ProgramPlanDayType.Workout, ExistingWorkoutTemplateId = 10 },
            new ProposedProgramScheduleItem { ClientKey = "fri", DayOfWeek = DayOfWeek.Friday, DayType = ProgramPlanDayType.Workout, NewWorkoutTemplateClientKey = "tpl-a" },
        ],
        NewTemplates = [NewTemplate()],
    };

    private readonly ProgramPlanProposalValidator validator = new();

    [Fact]
    public void ValidProposal_NoErrorsNoWarnings()
    {
        var result = validator.Validate(ValidProposal(), Context());

        Assert.True(result.IsValid);
        Assert.Empty(result.Warnings);
    }

    [Fact]
    public void StartAfterEnd_Error()
    {
        var args = ValidProposal();
        args.EndDate = args.StartDate.AddDays(-1);

        var result = validator.Validate(args, Context());

        Assert.Contains(result.Errors, e => e.Contains("startDate"));
    }

    [Fact]
    public void DurationExceedsEntitlement_Error()
    {
        var args = ValidProposal();
        args.EndDate = args.StartDate.AddMonths(4);

        var result = validator.Validate(args, Context(maxMonths: 3));

        Assert.Contains(result.Errors, e => e.Contains("3 months"));
    }

    [Fact]
    public void DurationWithinUnlimitedEntitlement_NoError()
    {
        var args = ValidProposal();
        args.EndDate = args.StartDate.AddMonths(12);

        var result = validator.Validate(args, Context(maxMonths: null));

        Assert.DoesNotContain(result.Errors, e => e.Contains("months"));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(8)]
    public void WorkoutsPerWeekOutOfRange_Error(int perWeek)
    {
        var args = ValidProposal();
        args.WorkoutsPerWeek = perWeek;

        var result = validator.Validate(args, Context());

        Assert.Contains(result.Errors, e => e.Contains("workoutsPerWeek"));
    }

    [Fact]
    public void CustomCalendar_Error()
    {
        var args = ValidProposal();
        args.ScheduleType = ProgramScheduleType.CustomCalendar;

        var result = validator.Validate(args, Context());

        Assert.Contains(result.Errors, e => e.Contains("CustomCalendar"));
    }

    [Fact]
    public void ExistingTemplateNotVisible_Error()
    {
        var args = ValidProposal();
        args.Schedule[1].ExistingWorkoutTemplateId = 999;

        var result = validator.Validate(args, Context());

        Assert.Contains(result.Errors, e => e.Contains("999"));
    }

    [Fact]
    public void ExerciseNotVisible_ErrorMentionsProposeExercise()
    {
        var args = ValidProposal();
        args.NewTemplates[0].Exercises[0].ExerciseId = 999;

        var result = validator.Validate(args, Context());

        Assert.Contains(result.Errors, e => e.Contains("propose_exercise"));
    }

    [Fact]
    public void FixedWeekdays_MissingDayOfWeek_Error()
    {
        var args = ValidProposal();
        args.Schedule[0].DayOfWeek = null;

        var result = validator.Validate(args, Context());

        Assert.Contains(result.Errors, e => e.Contains("dayOfWeek"));
    }

    [Fact]
    public void FixedWeekdays_DuplicateWeekday_Error()
    {
        var args = ValidProposal();
        args.Schedule[1].DayOfWeek = DayOfWeek.Monday;

        var result = validator.Validate(args, Context());

        Assert.Contains(result.Errors, e => e.Contains("Duplicate schedule rule"));
    }

    [Fact]
    public void Rotation_GappedIndexes_Error()
    {
        var args = ValidProposal();
        args.ScheduleType = ProgramScheduleType.Rotation;
        foreach (var item in args.Schedule)
        {
            item.DayOfWeek = null;
        }
        args.Schedule[0].RotationDayIndex = 1;
        args.Schedule[1].RotationDayIndex = 3;
        args.Schedule[2].RotationDayIndex = 4;

        var result = validator.Validate(args, Context());

        Assert.Contains(result.Errors, e => e.Contains("sequential"));
    }

    [Fact]
    public void Rotation_ItemWithDayOfWeek_Error()
    {
        var args = ValidProposal();
        args.ScheduleType = ProgramScheduleType.Rotation;
        args.Schedule[0].RotationDayIndex = 1;
        args.Schedule[1].RotationDayIndex = 2;
        args.Schedule[2].RotationDayIndex = 3;
        // DayOfWeek values still set from ValidProposal → invalid for Rotation

        var result = validator.Validate(args, Context());

        Assert.Contains(result.Errors, e => e.Contains("rotationDayIndex") || e.Contains("dayOfWeek"));
    }

    [Fact]
    public void DuplicateScheduleClientKeys_Error()
    {
        var args = ValidProposal();
        args.Schedule[1].ClientKey = "mon";

        var result = validator.Validate(args, Context());

        Assert.Contains(result.Errors, e => e.Contains("clientKey 'mon'"));
    }

    [Fact]
    public void DuplicateTemplateClientKeys_Error()
    {
        var args = ValidProposal();
        args.NewTemplates.Add(NewTemplate(clientKey: "tpl-a", name: "Upper B"));

        var result = validator.Validate(args, Context());

        Assert.Contains(result.Errors, e => e.Contains("template clientKey 'tpl-a'"));
    }

    [Fact]
    public void UnknownNewTemplateClientKey_Error()
    {
        var args = ValidProposal();
        args.Schedule[0].NewWorkoutTemplateClientKey = "tpl-missing";

        var result = validator.Validate(args, Context());

        Assert.Contains(result.Errors, e => e.Contains("tpl-missing"));
    }

    [Fact]
    public void WorkoutDayWithoutTemplate_Error()
    {
        var args = ValidProposal();
        args.Schedule[0].NewWorkoutTemplateClientKey = null;

        var result = validator.Validate(args, Context());

        Assert.Contains(result.Errors, e => e.Contains("must reference a template"));
    }

    [Fact]
    public void WorkoutDayWithBothTemplateSources_Error()
    {
        var args = ValidProposal();
        args.Schedule[0].ExistingWorkoutTemplateId = 10;   // also has NewWorkoutTemplateClientKey

        var result = validator.Validate(args, Context());

        Assert.Contains(result.Errors, e => e.Contains("not both"));
    }

    [Fact]
    public void SetRepsOutOfRange_Error()
    {
        var args = ValidProposal();
        args.NewTemplates[0].Exercises[0].Sets[0].Reps = 500;

        var result = validator.Validate(args, Context());

        Assert.Contains(result.Errors, e => e.Contains("reps"));
    }

    [Fact]
    public void TemplateWithoutExercises_Error()
    {
        var args = ValidProposal();
        args.NewTemplates[0].Exercises.Clear();

        var result = validator.Validate(args, Context());

        Assert.Contains(result.Errors, e => e.Contains("at least one exercise"));
    }

    [Fact]
    public void EmptyName_Error()
    {
        var args = ValidProposal();
        args.Name = "  ";

        var result = validator.Validate(args, Context());

        Assert.Contains(result.Errors, e => e.Contains("name"));
    }

    // ---- Warnings ----

    [Fact]
    public void FourConsecutiveTrainingDays_Warning()
    {
        var args = ValidProposal();
        args.WorkoutsPerWeek = 4;
        args.Schedule =
        [
            new ProposedProgramScheduleItem { ClientKey = "mon", DayOfWeek = DayOfWeek.Monday, DayType = ProgramPlanDayType.Workout, ExistingWorkoutTemplateId = 10 },
            new ProposedProgramScheduleItem { ClientKey = "tue", DayOfWeek = DayOfWeek.Tuesday, DayType = ProgramPlanDayType.Workout, ExistingWorkoutTemplateId = 10 },
            new ProposedProgramScheduleItem { ClientKey = "wed", DayOfWeek = DayOfWeek.Wednesday, DayType = ProgramPlanDayType.Workout, ExistingWorkoutTemplateId = 10 },
            new ProposedProgramScheduleItem { ClientKey = "thu", DayOfWeek = DayOfWeek.Thursday, DayType = ProgramPlanDayType.Workout, ExistingWorkoutTemplateId = 10 },
        ];

        var result = validator.Validate(args, Context());

        Assert.True(result.IsValid);
        Assert.Contains(result.Warnings, w => w.Contains("4 consecutive"));
    }

    [Fact]
    public void ConsecutiveTrainingDays_WrapsAroundWeek_Warning()
    {
        var args = ValidProposal();
        args.WorkoutsPerWeek = 4;
        args.Schedule =
        [
            new ProposedProgramScheduleItem { ClientKey = "sat", DayOfWeek = DayOfWeek.Saturday, DayType = ProgramPlanDayType.Workout, ExistingWorkoutTemplateId = 10 },
            new ProposedProgramScheduleItem { ClientKey = "sun", DayOfWeek = DayOfWeek.Sunday, DayType = ProgramPlanDayType.Workout, ExistingWorkoutTemplateId = 10 },
            new ProposedProgramScheduleItem { ClientKey = "mon", DayOfWeek = DayOfWeek.Monday, DayType = ProgramPlanDayType.Workout, ExistingWorkoutTemplateId = 10 },
            new ProposedProgramScheduleItem { ClientKey = "tue", DayOfWeek = DayOfWeek.Tuesday, DayType = ProgramPlanDayType.Workout, ExistingWorkoutTemplateId = 10 },
        ];

        var result = validator.Validate(args, Context());

        Assert.Contains(result.Warnings, w => w.Contains("4 consecutive"));
    }

    [Fact]
    public void WorkoutsPerWeekMismatch_Warning()
    {
        var args = ValidProposal();
        args.WorkoutsPerWeek = 5;   // schedule only has 3 required workouts

        var result = validator.Validate(args, Context());

        Assert.True(result.IsValid);
        Assert.Contains(result.Warnings, w => w.Contains("workoutsPerWeek"));
    }

    [Fact]
    public void LongerThan16Weeks_Warning()
    {
        var args = ValidProposal();
        args.EndDate = args.StartDate.AddDays(16 * 7);   // 113 days > 112

        var result = validator.Validate(args, Context(maxMonths: null));

        Assert.Contains(result.Warnings, w => w.Contains("16 weeks"));
    }

    [Fact]
    public void OpenEnded_NullEndDate_IsValid()
    {
        var args = ValidProposal();
        args.EndDate = null;

        var result = validator.Validate(args, Context());

        Assert.True(result.IsValid);
    }

    [Fact]
    public void ValidateUpdate_ReusesScheduleRules()
    {
        var update = new ProposeProgramUpdateArguments
        {
            ProgramPlanId = 1,
            Reason = "More recovery",
            WorkoutsPerWeek = 2,
            Schedule =
            [
                new ProposedProgramScheduleItem { ClientKey = "mon", DayOfWeek = DayOfWeek.Monday, DayType = ProgramPlanDayType.Workout, ExistingWorkoutTemplateId = 10 },
                new ProposedProgramScheduleItem { ClientKey = "thu", DayOfWeek = DayOfWeek.Monday, DayType = ProgramPlanDayType.Workout, ExistingWorkoutTemplateId = 10 },
            ],
        };

        var result = validator.ValidateUpdate(
            update, ProgramScheduleType.FixedWeekdays, new DateOnly(2026, 8, 10), Context());

        Assert.Contains(result.Errors, e => e.Contains("Duplicate schedule rule"));
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter ProgramPlanProposalValidatorTests`
Expected: FAIL — `ProgramPlanProposalValidator` does not exist.

- [ ] **Step 3: Implement** (`server/FitMate.Services/AI/ProgramGeneration/ProgramPlanProposalValidator.cs` — context/result classes at the top of the same file)

```csharp
using FitMate.Core.JsonModels.AI;
using FitMate.DB.Enums;

namespace FitMate.Services.AI.ProgramGeneration;

public class ProgramPlanProposalContext
{
    public IReadOnlySet<long> VisibleTemplateIds { get; init; } = new HashSet<long>();
    public IReadOnlySet<long> VisibleExerciseIds { get; init; } = new HashSet<long>();
    public int? MaxDurationMonths { get; init; }
}

public class ProgramPlanProposalValidationResult
{
    public List<string> Errors { get; } = [];
    public List<string> Warnings { get; } = [];
    public bool IsValid => Errors.Count == 0;
}

public class ProgramPlanProposalValidator
{
    private const int MaxRecommendedDurationDays = 16 * 7;
    private const int MaxConsecutiveTrainingDays = 3;

    public ProgramPlanProposalValidationResult Validate(
        ProposeProgramPlanArguments args,
        ProgramPlanProposalContext context)
    {
        var result = new ProgramPlanProposalValidationResult();

        if (string.IsNullOrWhiteSpace(args.Name))
        {
            result.Errors.Add("Plan name is required.");
        }

        if (args.EndDate != null && args.EndDate < args.StartDate)
        {
            result.Errors.Add("startDate must be on or before endDate.");
        }

        if (args.WorkoutsPerWeek is < 1 or > 7)
        {
            result.Errors.Add("workoutsPerWeek must be between 1 and 7.");
        }

        if (args.ScheduleType == ProgramScheduleType.CustomCalendar)
        {
            result.Errors.Add(
                "scheduleType CustomCalendar is not supported for AI proposals. Use FixedWeekdays or Rotation.");
        }

        if (context.MaxDurationMonths is int maxMonths
            && args.EndDate != null
            && args.EndDate > args.StartDate.AddMonths(maxMonths))
        {
            result.Errors.Add($"Plan duration exceeds the subscription limit of {maxMonths} months.");
        }

        ValidateSchedule(args, result.Errors, context);
        ValidateNewTemplates(args.NewTemplates, result.Errors, context);

        if (result.Errors.Count == 0)
        {
            CollectWarnings(args, result.Warnings);
        }

        return result;
    }

    public ProgramPlanProposalValidationResult ValidateUpdate(
        ProposeProgramUpdateArguments args,
        ProgramScheduleType scheduleType,
        DateOnly effectiveFrom,
        ProgramPlanProposalContext context)
    {
        var synthetic = new ProposeProgramPlanArguments
        {
            Name = "(update)",
            Goal = TrainingGoal.GeneralFitness,
            StartDate = effectiveFrom,
            EndDate = null,
            ScheduleType = scheduleType,
            WorkoutsPerWeek = args.WorkoutsPerWeek,
            Schedule = args.Schedule,
            NewTemplates = args.NewTemplates,
        };
        return Validate(synthetic, context);
    }

    private static void ValidateSchedule(
        ProposeProgramPlanArguments args,
        List<string> errors,
        ProgramPlanProposalContext context)
    {
        if (args.Schedule.Count == 0)
        {
            errors.Add("schedule must contain at least one item.");
            return;
        }

        foreach (var key in args.Schedule
                     .GroupBy(i => i.ClientKey, StringComparer.Ordinal)
                     .Where(g => g.Count() > 1)
                     .Select(g => g.Key))
        {
            errors.Add($"Duplicate schedule clientKey '{key}'.");
        }

        var newTemplateKeys = args.NewTemplates
            .Select(t => t.ClientKey)
            .ToHashSet(StringComparer.Ordinal);

        foreach (var item in args.Schedule)
        {
            var label = $"schedule item '{item.ClientKey}'";

            switch (args.ScheduleType)
            {
                case ProgramScheduleType.FixedWeekdays
                    when item.DayOfWeek == null || item.RotationDayIndex != null:
                    errors.Add($"{label}: FixedWeekdays items must set dayOfWeek and must not set rotationDayIndex.");
                    break;
                case ProgramScheduleType.Rotation
                    when item.RotationDayIndex == null || item.DayOfWeek != null:
                    errors.Add($"{label}: Rotation items must set rotationDayIndex and must not set dayOfWeek.");
                    break;
            }

            var hasExisting = item.ExistingWorkoutTemplateId != null;
            var hasNew = !string.IsNullOrEmpty(item.NewWorkoutTemplateClientKey);

            if (hasExisting && hasNew)
            {
                errors.Add($"{label}: set either existingWorkoutTemplateId or newWorkoutTemplateClientKey, not both.");
            }

            if (item.DayType is ProgramPlanDayType.Workout or ProgramPlanDayType.OptionalWorkout
                && !hasExisting && !hasNew)
            {
                errors.Add($"{label}: workout days must reference a template.");
            }

            if (item.DayType == ProgramPlanDayType.Rest && (hasExisting || hasNew))
            {
                errors.Add($"{label}: rest days must not reference a template.");
            }

            if (hasExisting && !context.VisibleTemplateIds.Contains(item.ExistingWorkoutTemplateId!.Value))
            {
                errors.Add($"{label}: workout template {item.ExistingWorkoutTemplateId} does not exist or is not visible to this user.");
            }

            if (hasNew && !newTemplateKeys.Contains(item.NewWorkoutTemplateClientKey!))
            {
                errors.Add($"{label}: newWorkoutTemplateClientKey '{item.NewWorkoutTemplateClientKey}' has no matching entry in newTemplates.");
            }
        }

        if (args.ScheduleType == ProgramScheduleType.FixedWeekdays)
        {
            foreach (var day in args.Schedule
                         .Where(i => i.DayOfWeek != null)
                         .GroupBy(i => i.DayOfWeek!.Value)
                         .Where(g => g.Count() > 1)
                         .Select(g => g.Key))
            {
                errors.Add($"Duplicate schedule rule for {day}.");
            }
        }

        if (args.ScheduleType == ProgramScheduleType.Rotation)
        {
            var indexes = args.Schedule
                .Where(i => i.RotationDayIndex != null)
                .Select(i => i.RotationDayIndex!.Value)
                .OrderBy(i => i)
                .ToList();
            if (indexes.Count == 0 || !indexes.SequenceEqual(Enumerable.Range(1, indexes.Count)))
            {
                errors.Add("rotationDayIndex values must be sequential starting at 1 with no gaps or duplicates.");
            }
        }
    }

    private static void ValidateNewTemplates(
        List<ProposedWorkoutTemplate> templates,
        List<string> errors,
        ProgramPlanProposalContext context)
    {
        foreach (var key in templates
                     .GroupBy(t => t.ClientKey, StringComparer.Ordinal)
                     .Where(g => g.Count() > 1)
                     .Select(g => g.Key))
        {
            errors.Add($"Duplicate template clientKey '{key}'.");
        }

        foreach (var template in templates)
        {
            var label = $"template '{(string.IsNullOrWhiteSpace(template.Name) ? template.ClientKey : template.Name)}'";

            if (string.IsNullOrWhiteSpace(template.Name))
            {
                errors.Add($"{label}: name is required.");
            }

            if (template.Exercises.Count == 0)
            {
                errors.Add($"{label}: must contain at least one exercise.");
            }

            foreach (var exercise in template.Exercises)
            {
                if (!context.VisibleExerciseIds.Contains(exercise.ExerciseId))
                {
                    errors.Add(
                        $"{label}: exercise {exercise.ExerciseId} does not exist or is not visible. "
                        + "Use search_exercises to find real ids; propose missing exercises with propose_exercise first.");
                    continue;
                }

                if (exercise.Sets.Count is 0 or > 10)
                {
                    errors.Add($"{label}: exercise {exercise.ExerciseId} must have between 1 and 10 sets.");
                }

                foreach (var set in exercise.Sets)
                {
                    if (set.Reps is < 1 or > 100)
                    {
                        errors.Add($"{label}: exercise {exercise.ExerciseId} has reps outside 1-100.");
                    }

                    if (set.WeightKg is < 0 or > 1000)
                    {
                        errors.Add($"{label}: exercise {exercise.ExerciseId} has weightKg outside 0-1000.");
                    }

                    if (set.DurationSeconds is < 1 or > 7200)
                    {
                        errors.Add($"{label}: exercise {exercise.ExerciseId} has durationSeconds outside 1-7200.");
                    }

                    if (set.RestSeconds is < 0 or > 3600)
                    {
                        errors.Add($"{label}: exercise {exercise.ExerciseId} has restSeconds outside 0-3600.");
                    }

                    if (set.Rpe is < 0 or > 10)
                    {
                        errors.Add($"{label}: exercise {exercise.ExerciseId} has rpe outside 0-10.");
                    }
                }
            }
        }
    }

    private static void CollectWarnings(ProposeProgramPlanArguments args, List<string> warnings)
    {
        if (args.EndDate != null
            && args.EndDate.Value.DayNumber - args.StartDate.DayNumber + 1 > MaxRecommendedDurationDays)
        {
            warnings.Add("Plan is longer than 16 weeks. Consider splitting it into shorter blocks.");
        }

        var requiredWorkouts = args.Schedule
            .Count(i => i.DayType == ProgramPlanDayType.Workout && !i.IsOptional);

        if (args.ScheduleType == ProgramScheduleType.FixedWeekdays)
        {
            if (requiredWorkouts != args.WorkoutsPerWeek)
            {
                warnings.Add(
                    $"Schedule contains {requiredWorkouts} required workouts per week "
                    + $"but workoutsPerWeek is {args.WorkoutsPerWeek}.");
            }

            var trainingWeekdays = args.Schedule
                .Where(i => i.DayOfWeek != null && IsTrainingDay(i.DayType))
                .Select(i => (int)i.DayOfWeek!.Value)
                .ToHashSet();
            var maxRun = MaxConsecutiveRun(trainingWeekdays, 7);
            if (maxRun > MaxConsecutiveTrainingDays)
            {
                warnings.Add($"Schedule has {maxRun} consecutive training days. Consider adding a rest day.");
            }
        }
        else if (args.ScheduleType == ProgramScheduleType.Rotation)
        {
            var cycleLength = args.Schedule.Max(i => i.RotationDayIndex!.Value);
            var weeklyAverage = 7m * requiredWorkouts / cycleLength;
            if (Math.Abs(weeklyAverage - args.WorkoutsPerWeek) >= 1m)
            {
                warnings.Add(
                    $"Rotation averages {weeklyAverage:0.#} workouts per week "
                    + $"but workoutsPerWeek is {args.WorkoutsPerWeek}.");
            }

            var trainingIndexes = args.Schedule
                .Where(i => IsTrainingDay(i.DayType))
                .Select(i => i.RotationDayIndex!.Value - 1)
                .ToHashSet();
            var maxRun = MaxConsecutiveRun(trainingIndexes, cycleLength);
            if (maxRun > MaxConsecutiveTrainingDays)
            {
                warnings.Add($"Rotation has {maxRun} consecutive training days. Consider adding a rest day.");
            }
        }
    }

    private static bool IsTrainingDay(ProgramPlanDayType dayType) =>
        dayType is ProgramPlanDayType.Workout or ProgramPlanDayType.OptionalWorkout or ProgramPlanDayType.Deload;

    private static int MaxConsecutiveRun(IReadOnlySet<int> trainingSlots, int cycleLength)
    {
        if (trainingSlots.Count >= cycleLength)
        {
            return cycleLength;
        }

        var maxRun = 0;
        var run = 0;
        for (var i = 0; i < cycleLength * 2; i++)
        {
            if (trainingSlots.Contains(i % cycleLength))
            {
                run++;
                maxRun = Math.Max(maxRun, run);
            }
            else
            {
                run = 0;
            }
        }

        return maxRun;
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter ProgramPlanProposalValidatorTests`
Expected: PASS (26 tests).

- [ ] **Step 5: Commit**

```bash
git add server/FitMate.Services server/FitMate.Tests
git commit -m "feat(ai-program): proposal validator with spec-32 errors and warnings"
```

---

### Task 3: propose_program_plan tool handler + usage charging + system prompt

**Files:**
- Create: `server/FitMate.Services/AI/Tools/ProposeProgramPlanToolHandler.cs`
- Create: `server/FitMate.Services/AI/Prompts/program-generation-v1.txt`
- Modify: `server/FitMate.Services/FitMate.Services.csproj` (copy prompt to output — only if Plan 05 uses copied files rather than embedded resources), `server/FitMate.Web/Program.cs` (DI)
- Test: `server/FitMate.Tests/Unit/Services/ProposeProgramPlanToolHandlerTests.cs`

**Interfaces:**
- Consumes (roadmap shared contracts, implemented by Plans 04/05/06 — reconcile exact member names against those files at execution time, keep behavior identical):
  - `IAiToolHandler` (`Name`, `Definition`, `IsAvailable(AiToolContext)`, `ExecuteAsync(argumentsJson, AiToolContext, CancellationToken)`) — Plan 05, `server/FitMate.Services/AI/Tools/IAiToolHandler.cs`.
  - `AiToolContext` — assumed `{ long UserId; long ConversationId; IReadOnlySet<SubscriptionFeature> EnabledFeatures; }` (verify against Plan 05's `AiToolContext.cs`).
  - `AiToolExecutionResult` — Plan 05's canonical result type name (its file structure lists `AI/Tools/AiToolExecutionResult.cs`, Task 8). The members used here — `Ok(object data)` / `Fail(params string[] errors)` / `Success` / `Errors` — are best-guess: verify against Plan 05 Task 8's final code, keep the behavior.
  - `AiJsonSerializer.Options` / `.Serialize<T>` / `.Deserialize<T>` — Plan 05 Task 1's single shared serializer, already specified in full at `server/FitMate.Integrations/AI/Serialization/AiJsonSerializer.cs` (namespace `FitMate.Integrations.AI.Serialization`): camelCase, `JsonStringEnumConverter`, ignore-null. Do NOT create a duplicate options type in `FitMate.Services`.
  - `IEntitlementService.RequireFeatureAsync(long userId, SubscriptionFeature feature)` and `GetAvailabilityAsync(long userId, SubscriptionFeature feature)` (Plan 04). The availability model is assumed to expose `int? Limit` for numeric entitlements — verify against Plan 04's `FeatureAvailabilityModel`.
  - `IUsageService.ReserveAsync(long userId, SubscriptionFeature feature, int quantity)` → reservation id (`long`), `CommitAsync(long reservationId)`, `ReleaseAsync(long reservationId)` (Plan 04).
  - `IAiActionService.CreatePendingAsync(...)` (Plan 06) — assumed signature `Task<AiActionModel> CreatePendingAsync(CreateAiActionRequest request, long userId)` where `CreateAiActionRequest { long ConversationId; AiActionType Type; string PayloadJson; string Summary; string? ValidationSummaryJson; }`. Verify against Plan 06's `IAiActionService.cs` and adapt the call — do NOT bypass it by inserting `AiAction` rows directly (Plan 06's service owns expiry/status).
  - `SubscriptionFeature.AiProgramGeneration`, `SubscriptionFeature.ProgramPlanDurationMonths` (Plan 04 enum; member names per spec — verify).
- Produces: tool `propose_program_plan` registered in the allow-list; pending `AiAction` of type `CreateProgramPlan` with warnings in `ValidationSummaryJson`.

- [ ] **Step 1: Write failing tests** (self-contained fakes so this task does not depend on Plan 04/06 test infrastructure; adjust fake method signatures to the real interfaces at execution time)

```csharp
using System.Text.Json;
using FitMate.Core.JsonModels.AI;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Integrations.AI.Serialization;
using FitMate.Services.AI.ProgramGeneration;
using FitMate.Services.AI.Tools;
using FitMate.Tests.TestInfrastructure;

namespace FitMate.Tests.Unit.Services;

public class ProposeProgramPlanToolHandlerTests
{
    // Local fakes implementing Plan 04/06 interfaces. Verify member lists against
    // IEntitlementService / IUsageService / IAiActionService at execution time.
    private sealed class FakeUsageService : IUsageService
    {
        public long NextReservationId = 77;
        public List<long> Reserved = [];
        public List<long> Committed = [];
        public List<long> Released = [];

        public Task<UsageReservationModel> ReserveAsync(long userId, SubscriptionFeature feature, int quantity)
        {
            Reserved.Add(NextReservationId);
            return Task.FromResult(NextReservationId);
        }

        public Task CommitAsync(long reservationId) { Committed.Add(reservationId); return Task.CompletedTask; }
        public Task ReleaseAsync(long reservationId) { Released.Add(reservationId); return Task.CompletedTask; }
    }

    private static async Task<(long exerciseId, long templateId)> SeedAsync(SqliteTestDatabase db)
    {
        await using var context = db.CreateContext();
        var exercise = new Exercise { Name = "Bench Press", Slug = "bench-press", PrimaryMuscleGroupId = SqliteTestDatabase.ChestId, IsPublic = true };
        var template = new WorkoutTemplate { UserId = SqliteTestDatabase.UserId, Name = "Upper A" };
        context.Exercises.Add(exercise);
        context.WorkoutTemplates.Add(template);
        await context.SaveChangesAsync();
        return (exercise.Id, template.Id);
    }

    private static ProposeProgramPlanArguments ValidArgs(long exerciseId, long templateId) => new()
    {
        Name = "August Hypertrophy",
        Goal = TrainingGoal.Hypertrophy,
        StartDate = new DateOnly(2026, 8, 3),
        EndDate = new DateOnly(2026, 8, 30),
        ScheduleType = ProgramScheduleType.FixedWeekdays,
        WorkoutsPerWeek = 2,
        Schedule =
        [
            new ProposedProgramScheduleItem { ClientKey = "mon", DayOfWeek = DayOfWeek.Monday, DayType = ProgramPlanDayType.Workout, ExistingWorkoutTemplateId = templateId },
            new ProposedProgramScheduleItem { ClientKey = "thu", DayOfWeek = DayOfWeek.Thursday, DayType = ProgramPlanDayType.Workout, NewWorkoutTemplateClientKey = "tpl-b" },
        ],
        NewTemplates =
        [
            new ProposedWorkoutTemplate
            {
                ClientKey = "tpl-b",
                Name = "Upper B",
                Exercises = [new ProposedTemplateExercise { ExerciseId = exerciseId, Sets = [new ProposedTemplateSet { Reps = 8 }] }],
            },
        ],
    };

    [Fact]
    public async Task ValidProposal_CreatesPendingActionAndCommitsUsage()
    {
        using var db = new SqliteTestDatabase();
        var (exerciseId, templateId) = await SeedAsync(db);
        var usage = new FakeUsageService();
        var handler = TestHandlerFactory.CreateProposeProgramPlan(db, usage);   // helper built in Step 3
        var context = TestHandlerFactory.ToolContext(SqliteTestDatabase.UserId, aiProgramGeneration: true);

        var result = await handler.ExecuteAsync(
            JsonSerializer.Serialize(ValidArgs(exerciseId, templateId), AiJsonSerializer.Options),
            context,
            CancellationToken.None);

        Assert.True(result.Success);
        Assert.Single(usage.Committed);
        Assert.Empty(usage.Released);
        await using var dbContext = db.CreateContext();
        var action = Assert.Single(dbContext.AiActions);
        Assert.Equal(AiActionType.CreateProgramPlan, action.Type);
        Assert.Empty(dbContext.ProgramPlans);   // nothing created until confirmation
    }

    [Fact]
    public async Task ValidationErrors_ReturnFailure_NoActionNoUsage()
    {
        using var db = new SqliteTestDatabase();
        var (exerciseId, templateId) = await SeedAsync(db);
        var usage = new FakeUsageService();
        var handler = TestHandlerFactory.CreateProposeProgramPlan(db, usage);
        var context = TestHandlerFactory.ToolContext(SqliteTestDatabase.UserId, aiProgramGeneration: true);
        var args = ValidArgs(exerciseId, templateId);
        args.WorkoutsPerWeek = 0;   // invalid

        var result = await handler.ExecuteAsync(
            JsonSerializer.Serialize(args, AiJsonSerializer.Options), context, CancellationToken.None);

        Assert.False(result.Success);
        Assert.Contains(result.Errors, e => e.Contains("workoutsPerWeek"));
        Assert.Empty(usage.Reserved);
        await using var dbContext = db.CreateContext();
        Assert.Empty(dbContext.AiActions);
    }

    [Fact]
    public async Task Warnings_StoredOnActionValidationSummary()
    {
        using var db = new SqliteTestDatabase();
        var (exerciseId, templateId) = await SeedAsync(db);
        var handler = TestHandlerFactory.CreateProposeProgramPlan(db, new FakeUsageService());
        var context = TestHandlerFactory.ToolContext(SqliteTestDatabase.UserId, aiProgramGeneration: true);
        var args = ValidArgs(exerciseId, templateId);
        args.WorkoutsPerWeek = 5;   // mismatch vs 2 scheduled → warning, still valid

        var result = await handler.ExecuteAsync(
            JsonSerializer.Serialize(args, AiJsonSerializer.Options), context, CancellationToken.None);

        Assert.True(result.Success);
        await using var dbContext = db.CreateContext();
        var action = Assert.Single(dbContext.AiActions);
        Assert.NotNull(action.ValidationSummaryJson);
        Assert.Contains("workoutsPerWeek", action.ValidationSummaryJson);
    }

    [Fact]
    public void IsAvailable_FalseWithoutEntitlement()
    {
        using var db = new SqliteTestDatabase();
        var handler = TestHandlerFactory.CreateProposeProgramPlan(db, new FakeUsageService());

        Assert.False(handler.IsAvailable(
            TestHandlerFactory.ToolContext(SqliteTestDatabase.UserId, aiProgramGeneration: false)));
        Assert.True(handler.IsAvailable(
            TestHandlerFactory.ToolContext(SqliteTestDatabase.UserId, aiProgramGeneration: true)));
    }

    [Fact]
    public async Task InvalidJson_ReturnsFailure()
    {
        using var db = new SqliteTestDatabase();
        var handler = TestHandlerFactory.CreateProposeProgramPlan(db, new FakeUsageService());
        var context = TestHandlerFactory.ToolContext(SqliteTestDatabase.UserId, aiProgramGeneration: true);

        var result = await handler.ExecuteAsync("{not json", context, CancellationToken.None);

        Assert.False(result.Success);
    }
}
```

> `TestHandlerFactory` is a small static helper written in Step 3 alongside the handler: it news up the
> handler with `db.CreateContext()`, the real `ProgramPlanProposalValidator`, a fake `IEntitlementService`
> (RequireFeatureAsync no-op when enabled / throws Plan 04's limit exception when disabled;
> `GetAvailabilityAsync(ProgramPlanDurationMonths)` returns `Limit = 3`), the passed `IUsageService`
> fake, and the **real** `IAiActionService` from Plan 06 (so the `AiActions` row assertions are real).
> If Plan 06's `AiAction` requires a seeded `AiConversation` FK, seed one in `SeedAsync` — verify
> against `server/FitMate.DB/Entities/AiAction.cs` at execution time.

- [ ] **Step 2: Run tests to verify they fail**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter ProposeProgramPlanToolHandlerTests`
Expected: FAIL — `ProposeProgramPlanToolHandler` / `TestHandlerFactory` do not exist.

- [ ] **Step 3: Implement the handler**

`server/FitMate.Services/AI/Tools/ProposeProgramPlanToolHandler.cs` (adjust `AiToolDefinition`/`AiToolExecutionResult` member names to Plan 05's actual types):

```csharp
using System.Text.Json;
using FitMate.Core.JsonModels.AI;
using FitMate.DB;
using FitMate.DB.Enums;
using FitMate.Services.AI.Actions;
using FitMate.Services.AI.ProgramGeneration;
using FitMate.Services.Subscriptions;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.AI.Tools;

public class ProposeProgramPlanToolHandler : IAiToolHandler
{
    private readonly AppDbContext dbContext;
    private readonly ProgramPlanProposalValidator validator;
    private readonly IEntitlementService entitlementService;
    private readonly IUsageService usageService;
    private readonly IAiActionService aiActionService;

    public ProposeProgramPlanToolHandler(
        AppDbContext dbContext,
        ProgramPlanProposalValidator validator,
        IEntitlementService entitlementService,
        IUsageService usageService,
        IAiActionService aiActionService)
    {
        this.dbContext = dbContext;
        this.validator = validator;
        this.entitlementService = entitlementService;
        this.usageService = usageService;
        this.aiActionService = aiActionService;
    }

    public string Name => "propose_program_plan";

    public AiToolDefinition Definition => new()
    {
        Name = Name,
        Description =
            "Propose a complete training program for the user to review and confirm. "
            + "Every exercise inside newTemplates must reference an EXISTING exercise id "
            + "(use search_exercises; missing exercises must be proposed with propose_exercise and "
            + "confirmed first). endDate null means an open-ended program. On confirmation a DRAFT "
            + "plan is created — it is never auto-activated.",
        ParametersSchema = ProgramPlanToolSchemas.ProposeProgramPlan,
    };

    public bool IsAvailable(AiToolContext context) =>
        context.EnabledFeatures.Contains(SubscriptionFeature.AiProgramGeneration);

    public async Task<AiToolExecutionResult> ExecuteAsync(
        string argumentsJson, AiToolContext context, CancellationToken cancellationToken)
    {
        await entitlementService.RequireFeatureAsync(context.UserId, SubscriptionFeature.AiProgramGeneration);

        ProposeProgramPlanArguments? args;
        try
        {
            args = JsonSerializer.Deserialize<ProposeProgramPlanArguments>(argumentsJson, AiJsonSerializer.Options);
        }
        catch (JsonException)
        {
            args = null;
        }

        if (args == null)
        {
            return AiToolExecutionResult.Fail("propose_program_plan arguments are not valid JSON for the documented schema.");
        }

        var visibleTemplateIds = (await dbContext.WorkoutTemplates
            .Where(t => t.UserId == context.UserId || t.IsPublic)
            .Select(t => t.Id)
            .ToListAsync(cancellationToken)).ToHashSet();
        var visibleExerciseIds = (await dbContext.Exercises
            .Where(e => e.UserId == context.UserId || e.IsPublic)
            .Select(e => e.Id)
            .ToListAsync(cancellationToken)).ToHashSet();
        var durationAvailability = await entitlementService.GetAvailabilityAsync(
            context.UserId, SubscriptionFeature.ProgramPlanDurationMonths);

        var validation = validator.Validate(args, new ProgramPlanProposalContext
        {
            VisibleTemplateIds = visibleTemplateIds,
            VisibleExerciseIds = visibleExerciseIds,
            MaxDurationMonths = durationAvailability.Limit,   // verify property name vs Plan 04
        });

        if (!validation.IsValid)
        {
            return AiToolExecutionResult.Fail(validation.Errors.ToArray());
        }

        var reservationId = await usageService.ReserveAsync(
            context.UserId, SubscriptionFeature.AiProgramGeneration, 1);
        try
        {
            var action = await aiActionService.CreatePendingAsync(new CreateAiActionRequest
            {
                ConversationId = context.ConversationId,
                Type = AiActionType.CreateProgramPlan,
                PayloadJson = JsonSerializer.Serialize(args, AiJsonSerializer.Options),
                Summary = $"Create program plan '{args.Name}' ({args.WorkoutsPerWeek}x/week)",
                ValidationSummaryJson = validation.Warnings.Count == 0
                    ? null
                    : JsonSerializer.Serialize(validation.Warnings, AiJsonSerializer.Options),
            }, context.UserId);

            await usageService.CommitAsync(reservationId);

            return AiToolExecutionResult.Ok(new
            {
                actionId = action.Id,
                status = "pending_confirmation",
                warnings = validation.Warnings,
                message = "Proposal created. The user must confirm it; the plan will be created as a draft.",
            });
        }
        catch
        {
            await usageService.ReleaseAsync(reservationId);
            throw;
        }
    }
}
```

Add `ProgramPlanToolSchemas` in the same folder (`server/FitMate.Services/AI/Tools/ProgramPlanToolSchemas.cs`). If Plan 05 ships a schema-from-type helper, use it instead of these literals:

```csharp
namespace FitMate.Services.AI.Tools;

public static class ProgramPlanToolSchemas
{
    public const string ProposeProgramPlan = """
    {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "description": { "type": ["string", "null"] },
        "goal": { "type": "string", "enum": ["GeneralFitness", "Hypertrophy", "Strength", "FatLoss", "Endurance", "Maintenance"] },
        "startDate": { "type": "string", "description": "YYYY-MM-DD" },
        "endDate": { "type": ["string", "null"], "description": "YYYY-MM-DD; null = open-ended program" },
        "scheduleType": { "type": "string", "enum": ["FixedWeekdays", "Rotation"] },
        "workoutsPerWeek": { "type": "integer", "minimum": 1, "maximum": 7 },
        "schedule": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "clientKey": { "type": "string" },
              "dayOfWeek": { "type": ["string", "null"], "enum": ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", null] },
              "rotationDayIndex": { "type": ["integer", "null"] },
              "dayType": { "type": "string", "enum": ["Workout", "Rest", "OptionalWorkout", "Recovery", "Deload"] },
              "existingWorkoutTemplateId": { "type": ["integer", "null"] },
              "newWorkoutTemplateClientKey": { "type": ["string", "null"] },
              "isOptional": { "type": "boolean" }
            },
            "required": ["clientKey", "dayType"]
          }
        },
        "newTemplates": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "clientKey": { "type": "string" },
              "name": { "type": "string" },
              "description": { "type": ["string", "null"] },
              "estimatedDurationMinutes": { "type": ["integer", "null"] },
              "exercises": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "exerciseId": { "type": "integer", "description": "id of an EXISTING exercise" },
                    "notes": { "type": ["string", "null"] },
                    "sets": {
                      "type": "array",
                      "items": {
                        "type": "object",
                        "properties": {
                          "reps": { "type": ["integer", "null"] },
                          "weightKg": { "type": ["number", "null"] },
                          "durationSeconds": { "type": ["integer", "null"] },
                          "restSeconds": { "type": ["integer", "null"] },
                          "rpe": { "type": ["number", "null"] }
                        }
                      }
                    }
                  },
                  "required": ["exerciseId", "sets"]
                }
              }
            },
            "required": ["clientKey", "name", "exercises"]
          }
        }
      },
      "required": ["name", "goal", "startDate", "scheduleType", "workoutsPerWeek", "schedule"]
    }
    """;
}
```

Add `TestHandlerFactory` to `server/FitMate.Tests/TestInfrastructure/TestHandlerFactory.cs` implementing the fakes described in Step 1's note (fake `IEntitlementService` + `ToolContext(...)` builder returning Plan 05's `AiToolContext` with/without `SubscriptionFeature.AiProgramGeneration` in `EnabledFeatures`).

- [ ] **Step 4: Write the system prompt** — `server/FitMate.Services/AI/Prompts/program-generation-v1.txt`:

```
PROGRAM GENERATION RULES (v1)

When the user asks for a training program (a plan spanning days or weeks), follow this exact order:

1. Call get_training_profile and get_training_snapshot to learn the user's goal, experience level,
   available days and recent training. Call get_active_program to check for an existing program.
   If one is active, ask whether to adjust it (propose_program_update) instead of creating a new one.
2. Find every exercise you intend to use with search_exercises, and check get_exercise_history for
   the user's staples. NEVER invent exercise ids.
3. If an exercise you need does not exist, call propose_exercise for each missing one and STOP.
   Wait for the user to confirm those exercises before continuing.
4. Prefer reusing the user's existing workout templates (get_workout_templates). For substantial new
   workouts, propose them with propose_workout_template and wait for confirmation, then reference
   them by their real id. Small helper templates may instead be defined inline in
   propose_program_plan's newTemplates.
5. Call propose_program_plan exactly once with the full schedule. Use scheduleType FixedWeekdays
   when the user trains on specific weekdays, Rotation for repeating cycles (e.g. push/pull/legs/rest).
   Set endDate to null ONLY if the user wants an open-ended program.
6. If propose_program_plan returns validation errors, fix the arguments and call it again.
7. After the proposal is confirmed the plan exists as a DRAFT. Tell the user to review and activate
   it from the program page. Never claim the program is already active.
```

Register the prompt the same way Plan 05 registers its prompt files (embedded resource or `CopyToOutputDirectory` + prompt provider lookup by name `program-generation-v1`) and append its content to the coach system prompt where Plan 05 composes it — verify against Plan 05's prompt loading code at execution time. If Plan 05 copies files, add to `FitMate.Services.csproj`:

```xml
<ItemGroup>
  <None Update="Ai\Prompts\program-generation-v1.txt" CopyToOutputDirectory="PreserveNewest" />
</ItemGroup>
```

- [ ] **Step 5: Register DI** — in `server/FitMate.Web/Program.cs`, next to Plan 05/06's tool registrations:

```csharp
builder.Services.AddScoped<ProgramPlanProposalValidator>();
builder.Services.AddScoped<IAiToolHandler, ProposeProgramPlanToolHandler>();
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter ProposeProgramPlanToolHandlerTests`
Expected: PASS (5 tests). Then `dotnet build server/FitMate.sln` — OK.

- [ ] **Step 7: Commit**

```bash
git add server/FitMate.Services server/FitMate.Web server/FitMate.Tests
git commit -m "feat(ai-program): propose_program_plan tool with validation, usage charging and prompt"
```

---

### Task 4: CreateProgramPlanActionExecutor (two-stage, idempotent, never activates)

**Files:**
- Create: `server/FitMate.Services/AI/Actions/CreateProgramPlanActionExecutor.cs`
- Modify: `server/FitMate.Web/Program.cs` (DI)
- Test: `server/FitMate.Tests/Unit/Services/CreateProgramPlanActionExecutorTests.cs`

**Interfaces:**
- Consumes: `IAiActionExecutor` (`ActionType`, `ExecuteAsync(AiAction, long userId, CancellationToken)` — Plan 06; the return type is assumed `Task<string>` carrying the ResultJson that Plan 06's confirm flow stores on the action — verify against Plan 06's `IAiActionExecutor.cs`), `IWorkoutTemplateService.CreateAsync(CreateWorkoutTemplateRequest, long)` (existing), `IProgramPlanService.CreateDraftAsync(SaveProgramPlanRequest, long)` + `IProgramPlanScheduleService.GenerateDays(ProgramPlan, DateOnly, DateOnly)` (Plan 01).
- Produces: executor for `AiActionType.CreateProgramPlan` returning serialized `CreateProgramPlanActionResultModel`. `ProgramPlan.SourceAiActionId` (plain column from Plan 01, FK'd in Plan 06) is the idempotency key.

- [ ] **Step 1: Write failing tests**

```csharp
using System.Text.Json;
using FitMate.Core.JsonModels.AI;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Integrations.AI.Serialization;
using FitMate.Services.AI.Actions;
using FitMate.Services.ProgramPlans;
using FitMate.Services.WorkoutTemplates;
using FitMate.Tests.TestInfrastructure;

namespace FitMate.Tests.Unit.Services;

public class CreateProgramPlanActionExecutorTests
{
    private static async Task<(long exerciseId, long existingTemplateId)> SeedAsync(SqliteTestDatabase db)
    {
        await using var context = db.CreateContext();
        var exercise = new Exercise { Name = "Squat", Slug = "squat", PrimaryMuscleGroupId = SqliteTestDatabase.LegsId, IsPublic = true };
        var template = new WorkoutTemplate { UserId = SqliteTestDatabase.UserId, Name = "Leg Day" };
        context.Exercises.Add(exercise);
        context.WorkoutTemplates.Add(template);
        await context.SaveChangesAsync();
        return (exercise.Id, template.Id);
    }

    private static async Task<AiAction> SeedActionAsync(SqliteTestDatabase db, ProposeProgramPlanArguments args)
    {
        await using var context = db.CreateContext();
        // Adjust required members/FKs (e.g. seeded AiConversation) to Plan 06's AiAction entity
        // at execution time — verify against server/FitMate.DB/Entities/AiAction.cs.
        var action = new AiAction
        {
            UserId = SqliteTestDatabase.UserId,
            Type = AiActionType.CreateProgramPlan,
            Status = AiActionStatus.Confirmed,
            PayloadJson = JsonSerializer.Serialize(args, AiJsonSerializer.Options),
        };
        context.AiActions.Add(action);
        await context.SaveChangesAsync();
        return action;
    }

    // 2 new templates + 1 existing mixed — the ClientKey resolution scenario.
    private static ProposeProgramPlanArguments MixedArgs(long exerciseId, long existingTemplateId) => new()
    {
        Name = "August Hypertrophy",
        Goal = TrainingGoal.Hypertrophy,
        StartDate = new DateOnly(2026, 8, 3),
        EndDate = new DateOnly(2026, 8, 30),
        ScheduleType = ProgramScheduleType.FixedWeekdays,
        WorkoutsPerWeek = 3,
        Schedule =
        [
            new ProposedProgramScheduleItem { ClientKey = "mon", DayOfWeek = DayOfWeek.Monday, DayType = ProgramPlanDayType.Workout, NewWorkoutTemplateClientKey = "push" },
            new ProposedProgramScheduleItem { ClientKey = "wed", DayOfWeek = DayOfWeek.Wednesday, DayType = ProgramPlanDayType.Workout, NewWorkoutTemplateClientKey = "pull" },
            new ProposedProgramScheduleItem { ClientKey = "fri", DayOfWeek = DayOfWeek.Friday, DayType = ProgramPlanDayType.Workout, ExistingWorkoutTemplateId = existingTemplateId },
        ],
        NewTemplates =
        [
            new ProposedWorkoutTemplate
            {
                ClientKey = "push", Name = "AI Push",
                Exercises = [new ProposedTemplateExercise { ExerciseId = exerciseId, Sets = [new ProposedTemplateSet { Reps = 8, WeightKg = 80 }] }],
            },
            new ProposedWorkoutTemplate
            {
                ClientKey = "pull", Name = "AI Pull",
                Exercises = [new ProposedTemplateExercise { ExerciseId = exerciseId, Sets = [new ProposedTemplateSet { Reps = 10 }] }],
            },
        ],
    };

    private static CreateProgramPlanActionExecutor CreateExecutor(SqliteTestDatabase db)
    {
        var context = db.CreateContext();
        // Mirror the service construction used in ProgramPlanServiceTests (Plan 01) and
        // WorkoutTemplateService's test construction — verify ctor args at execution time.
        var templateService = TestWorkoutTemplateServiceFactory.Create(context);
        var scheduleService = new ProgramPlanScheduleService();
        var planService = new ProgramPlanService(context, scheduleService,
            new ProgramPlanDayService(context, TestWorkoutServiceFactory.Create(context)));
        return new CreateProgramPlanActionExecutor(context, templateService, planService, scheduleService);
    }

    [Fact]
    public async Task Execute_CreatesDraftWithResolvedTemplates_TwoNewOneExisting()
    {
        using var db = new SqliteTestDatabase();
        var (exerciseId, existingTemplateId) = await SeedAsync(db);
        var action = await SeedActionAsync(db, MixedArgs(exerciseId, existingTemplateId));
        var executor = CreateExecutor(db);

        var resultJson = await executor.ExecuteAsync(action, SqliteTestDatabase.UserId, CancellationToken.None);

        var result = JsonSerializer.Deserialize<CreateProgramPlanActionResultModel>(resultJson, AiJsonSerializer.Options)!;
        await using var context = db.CreateContext();
        var plan = Assert.Single(context.ProgramPlans);
        Assert.Equal(ProgramPlanStatus.Draft, plan.Status);          // NEVER auto-activated (spec §33)
        Assert.True(plan.IsAiGenerated);
        Assert.Equal(action.Id, plan.SourceAiActionId);
        Assert.Empty(context.ProgramPlanDays);                       // drafts generate no calendar

        var rules = context.ProgramPlanScheduleRules.OrderBy(r => r.OrderIndex).ToList();
        Assert.Equal(3, rules.Count);
        Assert.Equal(2, result.CreatedTemplateIds.Count);
        Assert.Equal(result.CreatedTemplateIds[0], rules[0].WorkoutTemplateId);  // "push"
        Assert.Equal(result.CreatedTemplateIds[1], rules[1].WorkoutTemplateId);  // "pull"
        Assert.Equal(existingTemplateId, rules[2].WorkoutTemplateId);
        Assert.Equal(2, context.WorkoutTemplates.Count(t => t.Name.StartsWith("AI ")));
        Assert.Equal(12, result.PlannedWorkouts);                    // Mon+Wed+Fri over Aug 3-30 = 4 weeks * 3
    }

    [Fact]
    public async Task Execute_Twice_CreatesExactlyOneDraft()
    {
        using var db = new SqliteTestDatabase();
        var (exerciseId, existingTemplateId) = await SeedAsync(db);
        var action = await SeedActionAsync(db, MixedArgs(exerciseId, existingTemplateId));

        var first = await CreateExecutor(db).ExecuteAsync(action, SqliteTestDatabase.UserId, CancellationToken.None);
        var second = await CreateExecutor(db).ExecuteAsync(action, SqliteTestDatabase.UserId, CancellationToken.None);

        await using var context = db.CreateContext();
        Assert.Equal(1, context.ProgramPlans.Count());
        var firstResult = JsonSerializer.Deserialize<CreateProgramPlanActionResultModel>(first, AiJsonSerializer.Options)!;
        var secondResult = JsonSerializer.Deserialize<CreateProgramPlanActionResultModel>(second, AiJsonSerializer.Options)!;
        Assert.Equal(firstResult.ProgramPlanId, secondResult.ProgramPlanId);
    }

    [Fact]
    public async Task Execute_OpenEnded_PlannedWorkoutsIsNull()
    {
        using var db = new SqliteTestDatabase();
        var (exerciseId, existingTemplateId) = await SeedAsync(db);
        var args = MixedArgs(exerciseId, existingTemplateId);
        args.EndDate = null;
        var action = await SeedActionAsync(db, args);

        var resultJson = await CreateExecutor(db).ExecuteAsync(action, SqliteTestDatabase.UserId, CancellationToken.None);

        var result = JsonSerializer.Deserialize<CreateProgramPlanActionResultModel>(resultJson, AiJsonSerializer.Options)!;
        Assert.Null(result.PlannedWorkouts);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter CreateProgramPlanActionExecutorTests`
Expected: FAIL — executor does not exist.

- [ ] **Step 3: Implement**

```csharp
using System.Text.Json;
using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.AI;
using FitMate.Core.JsonModels.ProgramPlans;
using FitMate.Core.JsonModels.WorkoutTemplates;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.ProgramPlans;
using FitMate.Services.WorkoutTemplates;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.AI.Actions;

public class CreateProgramPlanActionExecutor : IAiActionExecutor
{
    private readonly AppDbContext dbContext;
    private readonly IWorkoutTemplateService workoutTemplateService;
    private readonly IProgramPlanService programPlanService;
    private readonly IProgramPlanScheduleService scheduleService;

    public CreateProgramPlanActionExecutor(
        AppDbContext dbContext,
        IWorkoutTemplateService workoutTemplateService,
        IProgramPlanService programPlanService,
        IProgramPlanScheduleService scheduleService)
    {
        this.dbContext = dbContext;
        this.workoutTemplateService = workoutTemplateService;
        this.programPlanService = programPlanService;
        this.scheduleService = scheduleService;
    }

    public AiActionType ActionType => AiActionType.CreateProgramPlan;

    public async Task<AiActionExecutionResult> ExecuteAsync(AiAction action, long userId, CancellationToken cancellationToken)
    {
        // Idempotency: SourceAiActionId is the natural key — double confirm returns the same draft.
        var existing = await dbContext.ProgramPlans
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.SourceAiActionId == action.Id && p.UserId == userId, cancellationToken);
        if (existing != null)
        {
            return JsonSerializer.Serialize(await BuildResultAsync(existing.Id, []), AiJsonSerializer.Options);
        }

        var args = JsonSerializer.Deserialize<ProposeProgramPlanArguments>(action.PayloadJson, AiJsonSerializer.Options)
            ?? throw new FitMateException("Action payload is empty.");

        // Stage 1: create the new templates. WorkoutTemplateService.CreateAsync opens its own
        // transaction, so there is deliberately NO outer transaction here; idempotency (above)
        // protects against double execution, and a failure mid-way leaves only valid personal
        // templates behind (documented tradeoff).
        var templateIdByClientKey = new Dictionary<string, long>(StringComparer.Ordinal);
        var createdTemplateIds = new List<long>();
        foreach (var proposed in args.NewTemplates)
        {
            var created = await workoutTemplateService.CreateAsync(MapTemplate(proposed), userId);
            templateIdByClientKey[proposed.ClientKey] = created.Id;
            createdTemplateIds.Add(created.Id);
        }

        // Stage 2: build the draft request with resolved template ids.
        var request = new SaveProgramPlanRequest
        {
            Name = args.Name,
            Description = args.Description,
            Goal = args.Goal,
            ScheduleType = args.ScheduleType,
            StartDate = args.StartDate,
            EndDate = args.EndDate,
            TargetWorkoutsPerWeek = args.WorkoutsPerWeek,
            ScheduleRules = args.Schedule
                .Select((item, index) => new ProgramScheduleRuleRequest
                {
                    DayOfWeek = item.DayOfWeek,
                    RotationDayIndex = item.RotationDayIndex,
                    DayType = item.DayType,
                    WorkoutTemplateId = ResolveTemplateId(item, templateIdByClientKey),
                    WeekInterval = 1,
                    OrderIndex = index,
                    IsOptional = item.IsOptional,
                })
                .ToList(),
        };

        var draft = await programPlanService.CreateDraftAsync(request, userId);

        var plan = await dbContext.ProgramPlans.FirstAsync(p => p.Id == draft.Id, cancellationToken);
        plan.IsAiGenerated = true;
        plan.SourceAiActionId = action.Id;
        await dbContext.SaveChangesAsync();
        // NEVER activate here (spec §33): the user activates explicitly from the program page.

        return JsonSerializer.Serialize(await BuildResultAsync(plan.Id, createdTemplateIds), AiJsonSerializer.Options);
    }

    private async Task<CreateProgramPlanActionResultModel> BuildResultAsync(
        long planId, List<long> createdTemplateIds)
    {
        var plan = await dbContext.ProgramPlans
            .AsNoTracking()
            .Include(p => p.ScheduleRules)
            .FirstAsync(p => p.Id == planId);

        int? plannedWorkouts = null;
        if (plan.EndDate != null)
        {
            plannedWorkouts = scheduleService
                .GenerateDays(plan, plan.StartDate, plan.EndDate.Value)
                .Count(d => d.DayType is ProgramPlanDayType.Workout or ProgramPlanDayType.OptionalWorkout);
        }

        return new CreateProgramPlanActionResultModel
        {
            ProgramPlanId = plan.Id,
            Name = plan.Name,
            PlannedWorkouts = plannedWorkouts,
            CreatedTemplateIds = createdTemplateIds,
        };
    }

    private static CreateWorkoutTemplateRequest MapTemplate(ProposedWorkoutTemplate proposed) => new()
    {
        Name = proposed.Name,
        Description = proposed.Description,
        EstimatedDurationMinutes = proposed.EstimatedDurationMinutes,
        IsPublic = false,   // AI-created templates are always personal
        Exercises = proposed.Exercises
            .Select(e => new CreateWorkoutTemplateExerciseRequest
            {
                GroupType = ExerciseGroupType.Straight,
                ExerciseId = e.ExerciseId,
                Notes = e.Notes,
                Sets = e.Sets
                    .Select(s => new CreateWorkoutTemplateExerciseSetRequest
                    {
                        SetType = ExerciseSetType.Working,
                        WeightKg = s.WeightKg,
                        Reps = s.Reps,
                        DurationSeconds = s.DurationSeconds,
                        Rpe = s.Rpe,
                        RestSeconds = s.RestSeconds,
                    })
                    .ToList(),
            })
            .ToList(),
    };

    private static long? ResolveTemplateId(
        ProposedProgramScheduleItem item, IReadOnlyDictionary<string, long> templateIdByClientKey)
    {
        if (item.ExistingWorkoutTemplateId != null)
        {
            return item.ExistingWorkoutTemplateId;
        }

        return string.IsNullOrEmpty(item.NewWorkoutTemplateClientKey)
            ? null
            : templateIdByClientKey[item.NewWorkoutTemplateClientKey];
    }
}
```

- [ ] **Step 4: Register DI** — in `server/FitMate.Web/Program.cs`, next to Plan 06's executor registrations:

```csharp
builder.Services.AddScoped<IAiActionExecutor, CreateProgramPlanActionExecutor>();
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter CreateProgramPlanActionExecutorTests`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add server/FitMate.Services server/FitMate.Web server/FitMate.Tests
git commit -m "feat(ai-program): CreateProgramPlan executor with ClientKey resolution and idempotency"
```

---

### Task 5: IProgramPlanService.UpdateActiveScheduleAsync (future days only)

**Files:**
- Modify: `server/FitMate.Services/ProgramPlans/IProgramPlanService.cs`, `ProgramPlanService.cs`
- Test: `server/FitMate.Tests/Unit/Services/ProgramPlanUpdateScheduleTests.cs`

**Interfaces:**
- Consumes: Plan 01's `ProgramPlanService` internals (`ValidateAsync`, rule mapping, `IProgramPlanScheduleService`).
- Produces (Task 6's executor calls this exact signature — this is a deliberate Plan 07 extension of the Plan 01 interface):

```csharp
/// Replaces the schedule rules of an ACTIVE plan and regenerates ONLY future days.
/// Days before effectiveFrom, and any day whose Status != Scheduled, are never touched —
/// regeneration must not destroy completed history (spec §31 update rules).
Task<ProgramPlanModel> UpdateActiveScheduleAsync(
    long planId, SaveProgramPlanRequest request, DateOnly effectiveFrom, long userId);
```

Semantics (document in the method's XML doc):
- Plan must be Active and owned by `userId`; `request.ScheduleType` must equal the plan's current type (changing type on an active plan is out of v1 scope); CustomCalendar plans cannot be rescheduled.
- Deletes only days with `ScheduledDate >= effectiveFrom && Status == Scheduled`. Completed / Started / Missed / Skipped / Rescheduled days survive untouched (including future ones — e.g. a day the user moved forward).
- Regenerates days from `effectiveFrom` to `EndDate` (fixed-length) or `effectiveFrom + 28 days` (open-ended, same horizon as Plan 01), skipping any date that still has a surviving day (avoids the unique `(ProgramPlanId, ScheduledDate, OrderIndex)` index).
- Rotation phase stays anchored to `plan.StartDate` (Plan 01's generator) — with a new cycle length, future indexes are recomputed deterministically from the original start date.
- Runs in a transaction.

- [ ] **Step 1: Write failing tests**

```csharp
using FitMate.Core.JsonModels.ProgramPlans;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.ProgramPlans;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Tests.Unit.Services;

public class ProgramPlanUpdateScheduleTests
{
    // Reuse Plan 01's helpers: SeedTemplateAsync + FixedWeekdayRequest + CreateService are
    // identical to ProgramPlanServiceTests — copy them here (or extract to a shared helper).

    private static async Task<long> SeedTemplateAsync(SqliteTestDatabase db, long userId, string name)
    {
        await using var context = db.CreateContext();
        var template = new WorkoutTemplate { UserId = userId, Name = name };
        context.WorkoutTemplates.Add(template);
        await context.SaveChangesAsync();
        return template.Id;
    }

    private static SaveProgramPlanRequest MonThuRequest(long templateId) => new()
    {
        Name = "August Upper Lower",
        Goal = TrainingGoal.Hypertrophy,
        ScheduleType = ProgramScheduleType.FixedWeekdays,
        StartDate = new DateOnly(2026, 8, 3),
        EndDate = new DateOnly(2026, 8, 30),
        TargetWorkoutsPerWeek = 2,
        ScheduleRules =
        [
            new ProgramScheduleRuleRequest { DayOfWeek = DayOfWeek.Monday, DayType = ProgramPlanDayType.Workout, WorkoutTemplateId = templateId, OrderIndex = 0 },
            new ProgramScheduleRuleRequest { DayOfWeek = DayOfWeek.Thursday, DayType = ProgramPlanDayType.Workout, WorkoutTemplateId = templateId, OrderIndex = 1 },
        ],
    };

    private static SaveProgramPlanRequest TueOnlyRequest(long templateId)
    {
        var request = MonThuRequest(templateId);
        request.TargetWorkoutsPerWeek = 1;
        request.ScheduleRules =
        [
            new ProgramScheduleRuleRequest { DayOfWeek = DayOfWeek.Tuesday, DayType = ProgramPlanDayType.Workout, WorkoutTemplateId = templateId, OrderIndex = 0 },
        ];
        return request;
    }

    private static ProgramPlanService CreateService(SqliteTestDatabase db)
    {
        var context = db.CreateContext();
        return new ProgramPlanService(context, new ProgramPlanScheduleService(),
            new ProgramPlanDayService(context, TestWorkoutServiceFactory.Create(context)));
        // verify ctor args against Plan 01's final ProgramPlanService at execution time
    }

    private static async Task<long> SeedActivePlanAsync(SqliteTestDatabase db, long templateId)
    {
        var service = CreateService(db);
        var created = await service.CreateDraftAsync(MonThuRequest(templateId), SqliteTestDatabase.UserId);
        await service.ActivateAsync(created.Id, SqliteTestDatabase.UserId);
        return created.Id;
    }

    [Fact]
    public async Task Update_DeletesOnlyFutureScheduledDays_KeepsHistory()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var planId = await SeedActivePlanAsync(db, templateId);
        await using (var context = db.CreateContext())
        {
            var aug3 = await context.ProgramPlanDays.FirstAsync(d => d.ScheduledDate == new DateOnly(2026, 8, 3));
            aug3.Status = ProgramPlanDayStatus.Completed;
            await context.SaveChangesAsync();
        }
        var service = CreateService(db);

        await service.UpdateActiveScheduleAsync(
            planId, TueOnlyRequest(templateId), new DateOnly(2026, 8, 10), SqliteTestDatabase.UserId);

        await using var verify = db.CreateContext();
        var days = verify.ProgramPlanDays.OrderBy(d => d.ScheduledDate).ToList();
        Assert.Contains(days, d => d.ScheduledDate == new DateOnly(2026, 8, 3) && d.Status == ProgramPlanDayStatus.Completed);
        Assert.Contains(days, d => d.ScheduledDate == new DateOnly(2026, 8, 6));            // before effectiveFrom, untouched
        Assert.DoesNotContain(days, d => d.ScheduledDate == new DateOnly(2026, 8, 10));     // old Monday removed
        Assert.DoesNotContain(days, d => d.ScheduledDate == new DateOnly(2026, 8, 13));     // old Thursday removed
        Assert.Contains(days, d => d.ScheduledDate == new DateOnly(2026, 8, 11));           // new Tuesdays
        Assert.Contains(days, d => d.ScheduledDate == new DateOnly(2026, 8, 18));
        Assert.Contains(days, d => d.ScheduledDate == new DateOnly(2026, 8, 25));
    }

    [Fact]
    public async Task Update_SurvivingFutureDay_NotDeleted_NoDuplicateGenerated()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var planId = await SeedActivePlanAsync(db, templateId);
        await using (var context = db.CreateContext())
        {
            var aug11 = new DateOnly(2026, 8, 11);
            var moved = await context.ProgramPlanDays.FirstAsync(d => d.ScheduledDate == new DateOnly(2026, 8, 10));
            moved.ScheduledDate = aug11;
            moved.Status = ProgramPlanDayStatus.Rescheduled;
            await context.SaveChangesAsync();
        }
        var service = CreateService(db);

        await service.UpdateActiveScheduleAsync(
            planId, TueOnlyRequest(templateId), new DateOnly(2026, 8, 10), SqliteTestDatabase.UserId);

        await using var verify = db.CreateContext();
        var aug11Days = verify.ProgramPlanDays.Where(d => d.ScheduledDate == new DateOnly(2026, 8, 11)).ToList();
        Assert.Single(aug11Days);                                                    // survivor kept, no duplicate
        Assert.Equal(ProgramPlanDayStatus.Rescheduled, aug11Days[0].Status);
    }

    [Fact]
    public async Task Update_DraftPlan_Throws()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var service = CreateService(db);
        var created = await service.CreateDraftAsync(MonThuRequest(templateId), SqliteTestDatabase.UserId);

        await Assert.ThrowsAnyAsync<Exception>(() => service.UpdateActiveScheduleAsync(
            created.Id, TueOnlyRequest(templateId), new DateOnly(2026, 8, 10), SqliteTestDatabase.UserId));
    }

    [Fact]
    public async Task Update_ChangedScheduleType_Throws()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var planId = await SeedActivePlanAsync(db, templateId);
        var request = TueOnlyRequest(templateId);
        request.ScheduleType = ProgramScheduleType.Rotation;
        request.ScheduleRules = [new ProgramScheduleRuleRequest { RotationDayIndex = 1, DayType = ProgramPlanDayType.Workout, WorkoutTemplateId = templateId, OrderIndex = 0 }];
        var service = CreateService(db);

        await Assert.ThrowsAnyAsync<Exception>(() => service.UpdateActiveScheduleAsync(
            planId, request, new DateOnly(2026, 8, 10), SqliteTestDatabase.UserId));
    }

    [Fact]
    public async Task Update_OtherUsersPlan_Throws()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var planId = await SeedActivePlanAsync(db, templateId);
        var service = CreateService(db);

        await Assert.ThrowsAnyAsync<Exception>(() => service.UpdateActiveScheduleAsync(
            planId, TueOnlyRequest(templateId), new DateOnly(2026, 8, 10), SqliteTestDatabase.OtherUserId));
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter ProgramPlanUpdateScheduleTests`
Expected: FAIL — `UpdateActiveScheduleAsync` does not exist.

- [ ] **Step 3: Implement** — add to `ProgramPlanService` (reuse Plan 01's private `ValidateAsync(request, userId)` and the same rule-entity mapping `ApplyRequest` uses for `ScheduleRules`; verify those private method names in the final Plan 01 code):

```csharp
    public async Task<ProgramPlanModel> UpdateActiveScheduleAsync(
        long planId, SaveProgramPlanRequest request, DateOnly effectiveFrom, long userId)
    {
        var plan = await dbContext.ProgramPlans
            .Include(p => p.ScheduleRules)
            .FirstOrDefaultAsync(p => p.Id == planId && p.UserId == userId)
            ?? throw new KeyNotFoundException("Program plan not found.");

        if (plan.Status != ProgramPlanStatus.Active)
        {
            throw new FitMateException("Only active plans can be rescheduled.");
        }

        if (request.ScheduleType != plan.ScheduleType || plan.ScheduleType == ProgramScheduleType.CustomCalendar)
        {
            throw new FitMateException("Changing the schedule type of an active plan is not supported.");
        }

        await ValidateAsync(request, userId);

        await using var transaction = await dbContext.Database.BeginTransactionAsync();

        dbContext.ProgramPlanScheduleRules.RemoveRange(plan.ScheduleRules);
        plan.ScheduleRules.Clear();
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

        plan.TargetWorkoutsPerWeek = request.TargetWorkoutsPerWeek;

        // Delete ONLY future, still-Scheduled days. Completed history and user-touched days survive.
        var futureScheduled = await dbContext.ProgramPlanDays
            .Where(d => d.ProgramPlanId == plan.Id
                && d.ScheduledDate >= effectiveFrom
                && d.Status == ProgramPlanDayStatus.Scheduled)
            .ToListAsync();
        dbContext.ProgramPlanDays.RemoveRange(futureScheduled);

        var horizonEnd = plan.EndDate ?? effectiveFrom.AddDays(28);
        var occupiedDates = (await dbContext.ProgramPlanDays
            .Where(d => d.ProgramPlanId == plan.Id
                && d.ScheduledDate >= effectiveFrom
                && d.Status != ProgramPlanDayStatus.Scheduled)
            .Select(d => d.ScheduledDate)
            .ToListAsync()).ToHashSet();

        var newDays = scheduleService.GenerateDays(plan, effectiveFrom, horizonEnd)
            .Where(d => !occupiedDates.Contains(d.ScheduledDate));
        dbContext.ProgramPlanDays.AddRange(newDays);

        await dbContext.SaveChangesAsync();
        await transaction.CommitAsync();

        return (await GetByIdAsync(plan.Id, userId))!;
    }
```

Add the signature (with the XML doc from the Interfaces block) to `IProgramPlanService.cs`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter ProgramPlanUpdateScheduleTests`
Expected: PASS (5 tests). Then `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter ProgramPlan` — all Plan 01 tests still PASS.

- [ ] **Step 5: Commit**

```bash
git add server/FitMate.Services server/FitMate.Tests
git commit -m "feat(program-plans): UpdateActiveScheduleAsync regenerates future days only"
```

---

### Task 6: propose_program_update tool + UpdateProgramPlanActionExecutor

**Files:**
- Create: `server/FitMate.Services/AI/Tools/ProposeProgramUpdateToolHandler.cs`, `server/FitMate.Services/AI/Actions/UpdateProgramPlanActionExecutor.cs`
- Modify: `server/FitMate.Web/Program.cs` (DI), `server/FitMate.Services/AI/Tools/ProgramPlanToolSchemas.cs` (add schema)
- Test: `server/FitMate.Tests/Unit/Services/UpdateProgramPlanActionExecutorTests.cs`

**Interfaces:**
- Consumes: Task 2 `ValidateUpdate`, Task 5 `UpdateActiveScheduleAsync`, same Plan 04/05/06 contracts as Tasks 3–4.
- Produces: tool `propose_program_update` (allow-list name), executor for `AiActionType.UpdateProgramPlan` returning serialized `UpdateProgramPlanActionResultModel`.

- [ ] **Step 1: Write the tool handler** — same skeleton as `ProposeProgramPlanToolHandler`; the differences:

```csharp
using System.Text.Json;
using FitMate.Core.JsonModels.AI;
using FitMate.DB;
using FitMate.DB.Enums;
using FitMate.Services.AI.Actions;
using FitMate.Services.AI.ProgramGeneration;
using FitMate.Services.Subscriptions;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.AI.Tools;

public class ProposeProgramUpdateToolHandler : IAiToolHandler
{
    // same ctor dependencies as ProposeProgramPlanToolHandler

    public string Name => "propose_program_update";

    public AiToolDefinition Definition => new()
    {
        Name = Name,
        Description =
            "Propose a schedule change to the user's ACTIVE program plan. Only FUTURE days are "
            + "regenerated (from tomorrow); completed and past days are never modified. The schedule "
            + "type cannot change. Requires user confirmation.",
        ParametersSchema = ProgramPlanToolSchemas.ProposeProgramUpdate,
    };

    public bool IsAvailable(AiToolContext context) =>
        context.EnabledFeatures.Contains(SubscriptionFeature.AiProgramGeneration);

    public async Task<AiToolExecutionResult> ExecuteAsync(
        string argumentsJson, AiToolContext context, CancellationToken cancellationToken)
    {
        await entitlementService.RequireFeatureAsync(context.UserId, SubscriptionFeature.AiProgramGeneration);

        ProposeProgramUpdateArguments? args;
        try
        {
            args = JsonSerializer.Deserialize<ProposeProgramUpdateArguments>(argumentsJson, AiJsonSerializer.Options);
        }
        catch (JsonException)
        {
            args = null;
        }

        if (args == null)
        {
            return AiToolExecutionResult.Fail("propose_program_update arguments are not valid JSON for the documented schema.");
        }

        var plan = await dbContext.ProgramPlans
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == args.ProgramPlanId
                && p.UserId == context.UserId
                && p.Status == ProgramPlanStatus.Active, cancellationToken);
        if (plan == null)
        {
            return AiToolExecutionResult.Fail(
                $"No active program plan with id {args.ProgramPlanId}. Call get_active_program to find the current plan.");
        }

        if (plan.ScheduleType == ProgramScheduleType.CustomCalendar)
        {
            return AiToolExecutionResult.Fail("Custom calendar plans cannot be updated by AI.");
        }

        // visibleTemplateIds / visibleExerciseIds loaded exactly as in ProposeProgramPlanToolHandler
        var effectiveFrom = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1);
        var validation = validator.ValidateUpdate(args, plan.ScheduleType, effectiveFrom, new ProgramPlanProposalContext
        {
            VisibleTemplateIds = visibleTemplateIds,
            VisibleExerciseIds = visibleExerciseIds,
            MaxDurationMonths = null,   // updates do not change plan duration
        });

        if (!validation.IsValid)
        {
            return AiToolExecutionResult.Fail(validation.Errors.ToArray());
        }

        // reserve → CreatePendingAsync(AiActionType.UpdateProgramPlan,
        //   Summary = $"Update program '{plan.Name}' from {effectiveFrom:yyyy-MM-dd}: {args.Reason}")
        // → commit → Ok(...), release + rethrow on failure — identical structure to Task 3.
    }
}
```

Write the elided parts in full (copy the Task 3 structure — visibility queries, reservation block). Add the update schema constant:

```csharp
    public const string ProposeProgramUpdate = """
    {
      "type": "object",
      "properties": {
        "programPlanId": { "type": "integer" },
        "reason": { "type": "string", "description": "Short user-facing reason for the change" },
        "workoutsPerWeek": { "type": "integer", "minimum": 1, "maximum": 7 },
        "schedule": { "$comment": "same item shape as propose_program_plan.schedule" },
        "newTemplates": { "$comment": "same item shape as propose_program_plan.newTemplates" }
      },
      "required": ["programPlanId", "reason", "workoutsPerWeek", "schedule"]
    }
    """;
```

(Inline the full `schedule`/`newTemplates` item schemas by duplicating the objects from `ProposeProgramPlan` — JSON Schema `$comment` is a note for the implementer, not a reference mechanism.)

- [ ] **Step 2: Write failing executor tests**

```csharp
using System.Text.Json;
using FitMate.Core.JsonModels.AI;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Integrations.AI.Serialization;
using FitMate.Services.AI.Actions;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Tests.Unit.Services;

public class UpdateProgramPlanActionExecutorTests
{
    // Seed helpers: reuse the SeedTemplateAsync / MonThuRequest / SeedActivePlanAsync helpers from
    // ProgramPlanUpdateScheduleTests (Task 5) and the SeedActionAsync pattern from Task 4 with
    // Type = AiActionType.UpdateProgramPlan.

    private static ProposeProgramUpdateArguments TueOnlyUpdate(long planId, long templateId) => new()
    {
        ProgramPlanId = planId,
        Reason = "Only one gym day available now",
        WorkoutsPerWeek = 1,
        Schedule =
        [
            new ProposedProgramScheduleItem { ClientKey = "tue", DayOfWeek = DayOfWeek.Tuesday, DayType = ProgramPlanDayType.Workout, ExistingWorkoutTemplateId = templateId },
        ],
    };

    [Fact]
    public async Task Execute_RegeneratesFutureDaysWithNewRules()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var planId = await SeedActivePlanAsync(db, templateId);           // Mon+Thu Aug 3-30 (Plan starts in the past relative to nothing — see note)
        var action = await SeedUpdateActionAsync(db, TueOnlyUpdate(planId, templateId));
        var executor = CreateExecutor(db);                                // built like Task 4's, plus ProgramPlanService

        var resultJson = await executor.ExecuteAsync(action, SqliteTestDatabase.UserId, CancellationToken.None);

        var result = JsonSerializer.Deserialize<UpdateProgramPlanActionResultModel>(resultJson, AiJsonSerializer.Options)!;
        Assert.Equal(planId, result.ProgramPlanId);
        await using var context = db.CreateContext();
        var futureDays = context.ProgramPlanDays
            .Where(d => d.ScheduledDate >= result.EffectiveFrom)
            .ToList();
        Assert.All(futureDays, d => Assert.Equal(DayOfWeek.Tuesday, d.ScheduledDate.DayOfWeek));
        var pastDays = context.ProgramPlanDays.Where(d => d.ScheduledDate < result.EffectiveFrom).ToList();
        Assert.All(pastDays, d => Assert.NotEqual(DayOfWeek.Tuesday, d.ScheduledDate.DayOfWeek)); // untouched Mon/Thu
    }

    [Fact]
    public async Task Execute_WithStoredResult_ReturnsItWithoutRerunning()
    {
        using var db = new SqliteTestDatabase();
        var templateId = await SeedTemplateAsync(db, SqliteTestDatabase.UserId, "Upper A");
        var planId = await SeedActivePlanAsync(db, templateId);
        var action = await SeedUpdateActionAsync(db, TueOnlyUpdate(planId, templateId));
        var executor = CreateExecutor(db);

        var first = await executor.ExecuteAsync(action, SqliteTestDatabase.UserId, CancellationToken.None);
        action.ResultJson = first;   // Plan 06's confirm flow persists this after execution
        var countAfterFirst = db.CreateContext().ProgramPlanDays.Count();

        var second = await CreateExecutor(db).ExecuteAsync(action, SqliteTestDatabase.UserId, CancellationToken.None);

        Assert.Equal(first, second);
        Assert.Equal(countAfterFirst, db.CreateContext().ProgramPlanDays.Count());
    }
}
```

> Note: the plan seeded by `SeedActivePlanAsync` uses fixed 2026 dates while `effectiveFrom` is
> "tomorrow (UTC)". Make the seed helper shift the plan window to
> `DateOnly.FromDateTime(DateTime.UtcNow)` −7 / +21 days so future days actually exist regardless of
> when the test runs (same technique as Plan 01's `GetToday_OpenEnded_TopsUpHorizon` test).

- [ ] **Step 3: Run tests — expect FAIL** (`UpdateProgramPlanActionExecutor` missing)

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter UpdateProgramPlanActionExecutorTests`

- [ ] **Step 4: Implement the executor**

```csharp
using System.Text.Json;
using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.AI;
using FitMate.Core.JsonModels.ProgramPlans;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.ProgramPlans;
using FitMate.Services.WorkoutTemplates;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.AI.Actions;

public class UpdateProgramPlanActionExecutor : IAiActionExecutor
{
    private readonly AppDbContext dbContext;
    private readonly IWorkoutTemplateService workoutTemplateService;
    private readonly IProgramPlanService programPlanService;

    public UpdateProgramPlanActionExecutor(
        AppDbContext dbContext,
        IWorkoutTemplateService workoutTemplateService,
        IProgramPlanService programPlanService)
    {
        this.dbContext = dbContext;
        this.workoutTemplateService = workoutTemplateService;
        this.programPlanService = programPlanService;
    }

    public AiActionType ActionType => AiActionType.UpdateProgramPlan;

    public async Task<AiActionExecutionResult> ExecuteAsync(AiAction action, long userId, CancellationToken cancellationToken)
    {
        // Idempotency: Plan 06's confirm flow stores ResultJson after execution; a stored result
        // means the update already ran. (Verify the property name on AiAction at execution time.)
        if (!string.IsNullOrEmpty(action.ResultJson))
        {
            return action.ResultJson;
        }

        var args = JsonSerializer.Deserialize<ProposeProgramUpdateArguments>(action.PayloadJson, AiJsonSerializer.Options)
            ?? throw new FitMateException("Action payload is empty.");

        var plan = await dbContext.ProgramPlans
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == args.ProgramPlanId && p.UserId == userId, cancellationToken)
            ?? throw new FitMateException("Program plan not found.");

        // Stage 1: create any new templates (same tradeoffs as CreateProgramPlanActionExecutor).
        var templateIdByClientKey = new Dictionary<string, long>(StringComparer.Ordinal);
        var createdTemplateIds = new List<long>();
        foreach (var proposed in args.NewTemplates)
        {
            var created = await workoutTemplateService.CreateAsync(
                CreateProgramPlanActionExecutor.MapTemplate(proposed), userId);   // make MapTemplate internal static
            templateIdByClientKey[proposed.ClientKey] = created.Id;
            createdTemplateIds.Add(created.Id);
        }

        // Stage 2: apply from tomorrow — future Scheduled days only (Task 5 semantics).
        var effectiveFrom = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1);
        var request = new SaveProgramPlanRequest
        {
            Name = plan.Name,
            Description = plan.Description,
            Goal = plan.Goal,
            ScheduleType = plan.ScheduleType,
            StartDate = plan.StartDate,
            EndDate = plan.EndDate,
            TargetWorkoutsPerWeek = args.WorkoutsPerWeek,
            ScheduleRules = args.Schedule
                .Select((item, index) => new ProgramScheduleRuleRequest
                {
                    DayOfWeek = item.DayOfWeek,
                    RotationDayIndex = item.RotationDayIndex,
                    DayType = item.DayType,
                    WorkoutTemplateId = item.ExistingWorkoutTemplateId
                        ?? (string.IsNullOrEmpty(item.NewWorkoutTemplateClientKey)
                            ? null
                            : templateIdByClientKey[item.NewWorkoutTemplateClientKey]),
                    WeekInterval = 1,
                    OrderIndex = index,
                    IsOptional = item.IsOptional,
                })
                .ToList(),
        };

        var updated = await programPlanService.UpdateActiveScheduleAsync(
            plan.Id, request, effectiveFrom, userId);

        var regenerated = await dbContext.ProgramPlanDays
            .CountAsync(d => d.ProgramPlanId == plan.Id
                && d.ScheduledDate >= effectiveFrom
                && d.Status == ProgramPlanDayStatus.Scheduled, cancellationToken);

        return JsonSerializer.Serialize(new UpdateProgramPlanActionResultModel
        {
            ProgramPlanId = updated.Id,
            Name = updated.Name,
            EffectiveFrom = effectiveFrom,
            RegeneratedDays = regenerated,
            CreatedTemplateIds = createdTemplateIds,
        }, AiJsonSerializer.Options);
    }
}
```

Change `CreateProgramPlanActionExecutor.MapTemplate` from `private` to `internal` so both executors share it.

- [ ] **Step 5: Register DI**

```csharp
builder.Services.AddScoped<IAiToolHandler, ProposeProgramUpdateToolHandler>();
builder.Services.AddScoped<IAiActionExecutor, UpdateProgramPlanActionExecutor>();
```

- [ ] **Step 6: Run tests — expect PASS**, then full suite

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter UpdateProgramPlanActionExecutorTests` then `dotnet build server/FitMate.sln`

- [ ] **Step 7: Commit**

```bash
git add server/FitMate.Services server/FitMate.Web server/FitMate.Tests
git commit -m "feat(ai-program): propose_program_update tool and future-days-only executor"
```

---

### Task 7: Deterministic fake-provider contract tests (spec §78 style)

**Files:**
- Create: `server/FitMate.Tests/Unit/Ai/AiProgramGenerationContractTests.cs`

**Interfaces:**
- Consumes Plan 05's scripted fake provider and orchestrator test harness plus Plan 06's confirm flow. Before writing, read `server/FitMate.Tests/Unit/Ai/` (Plan 05/06 tests) and reuse their exact harness helpers — the code below assumes `FakeAiCompletionProvider` with `EnqueueToolCall(name, argumentsJson)` / `EnqueueText(text)` and a recorded `Requests` list exposing the tool definitions sent to the provider, and an orchestrator entry point `SendMessageAsync(text, userId)`. Verify every one of these names against Plan 05's tests at execution time; the assertions are the contract.

- [ ] **Step 1: Write the tests**

```csharp
using System.Text.Json;
using FitMate.Core.JsonModels.AI;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Integrations.AI.Serialization;
using FitMate.Tests.TestInfrastructure;

namespace FitMate.Tests.Unit.Ai;

public class AiProgramGenerationContractTests
{
    private const string UserMessage = "Create me a four-day hypertrophy program for August.";

    private static ProposeProgramPlanArguments FourDayProposal(long exerciseId) => new()
    {
        Name = "August Hypertrophy",
        Goal = TrainingGoal.Hypertrophy,
        StartDate = new DateOnly(2026, 8, 3),
        EndDate = new DateOnly(2026, 8, 30),
        ScheduleType = ProgramScheduleType.FixedWeekdays,
        WorkoutsPerWeek = 4,
        Schedule =
        [
            new ProposedProgramScheduleItem { ClientKey = "mon", DayOfWeek = DayOfWeek.Monday, DayType = ProgramPlanDayType.Workout, NewWorkoutTemplateClientKey = "upper-a" },
            new ProposedProgramScheduleItem { ClientKey = "tue", DayOfWeek = DayOfWeek.Tuesday, DayType = ProgramPlanDayType.Workout, NewWorkoutTemplateClientKey = "lower-a" },
            new ProposedProgramScheduleItem { ClientKey = "thu", DayOfWeek = DayOfWeek.Thursday, DayType = ProgramPlanDayType.Workout, NewWorkoutTemplateClientKey = "upper-a" },
            new ProposedProgramScheduleItem { ClientKey = "sat", DayOfWeek = DayOfWeek.Saturday, DayType = ProgramPlanDayType.Workout, NewWorkoutTemplateClientKey = "lower-a" },
        ],
        NewTemplates =
        [
            new ProposedWorkoutTemplate
            {
                ClientKey = "upper-a", Name = "Upper A",
                Exercises = [new ProposedTemplateExercise { ExerciseId = exerciseId, Sets = [new ProposedTemplateSet { Reps = 8 }] }],
            },
            new ProposedWorkoutTemplate
            {
                ClientKey = "lower-a", Name = "Lower A",
                Exercises = [new ProposedTemplateExercise { ExerciseId = exerciseId, Sets = [new ProposedTemplateSet { Reps = 10 }] }],
            },
        ],
    };

    [Fact]
    public async Task ScriptedFlow_CreatesPendingAction_NoDraftUntilConfirm()
    {
        using var db = new SqliteTestDatabase();
        var exerciseId = await AiTestHarness.SeedPublicExerciseAsync(db, "Bench Press");
        var provider = new FakeAiCompletionProvider();
        provider.EnqueueToolCall("get_training_profile", "{}");
        provider.EnqueueToolCall("get_training_snapshot", "{}");
        provider.EnqueueToolCall("propose_program_plan",
            JsonSerializer.Serialize(FourDayProposal(exerciseId), AiJsonSerializer.Options));
        provider.EnqueueText("I've prepared a 4-day hypertrophy program for August. Review and confirm it.");
        var harness = AiTestHarness.Create(db, provider, aiProgramGeneration: true);

        await harness.SendMessageAsync(UserMessage, SqliteTestDatabase.UserId);

        await using var context = db.CreateContext();
        var action = Assert.Single(context.AiActions.Where(a => a.Type == AiActionType.CreateProgramPlan));
        Assert.Equal(AiActionStatus.Pending, action.Status);
        Assert.Empty(context.ProgramPlans);   // draft is NOT created before confirmation
    }

    [Fact]
    public async Task Confirm_CreatesDraftWithRulesAndTemplates()
    {
        using var db = new SqliteTestDatabase();
        var exerciseId = await AiTestHarness.SeedPublicExerciseAsync(db, "Bench Press");
        var provider = new FakeAiCompletionProvider();
        provider.EnqueueToolCall("propose_program_plan",
            JsonSerializer.Serialize(FourDayProposal(exerciseId), AiJsonSerializer.Options));
        provider.EnqueueText("Done — please confirm.");
        var harness = AiTestHarness.Create(db, provider, aiProgramGeneration: true);
        await harness.SendMessageAsync(UserMessage, SqliteTestDatabase.UserId);
        long actionId;
        await using (var context = db.CreateContext())
        {
            actionId = context.AiActions.Single(a => a.Type == AiActionType.CreateProgramPlan).Id;
        }

        await harness.ConfirmActionAsync(actionId, SqliteTestDatabase.UserId);   // Plan 06 confirm entry point

        await using var verify = db.CreateContext();
        var plan = Assert.Single(verify.ProgramPlans);
        Assert.Equal(ProgramPlanStatus.Draft, plan.Status);
        Assert.Equal(4, verify.ProgramPlanScheduleRules.Count(r => r.ProgramPlanId == plan.Id));
        Assert.Equal(2, verify.WorkoutTemplates.Count(t => t.Name == "Upper A" || t.Name == "Lower A"));
    }

    [Fact]
    public async Task EntitlementDisabled_ProposeProgramPlanNotOfferedToModel()
    {
        using var db = new SqliteTestDatabase();
        var provider = new FakeAiCompletionProvider();
        provider.EnqueueText("I cannot generate programs on your current plan.");
        var harness = AiTestHarness.Create(db, provider, aiProgramGeneration: false);

        await harness.SendMessageAsync(UserMessage, SqliteTestDatabase.UserId);

        var offeredTools = provider.Requests.Single().Tools.Select(t => t.Name).ToList();
        Assert.DoesNotContain("propose_program_plan", offeredTools);
        Assert.DoesNotContain("propose_program_update", offeredTools);
    }
}
```

- [ ] **Step 2: Run** `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter AiProgramGenerationContractTests` — expect PASS (fix harness-name mismatches per the verify note; the asserted behavior is non-negotiable).

- [ ] **Step 3: Run the full backend suite** — `dotnet test server/FitMate.sln` — expect PASS.

- [ ] **Step 4: Commit**

```bash
git add server/FitMate.Tests
git commit -m "test(ai-program): deterministic fake-provider contract tests for program generation"
```

---

### Task 8: Frontend — ProgramPlanProposalCard + explicit activation flow

**Files:**
- Create: `client/src/pages/Coach/components/actions/ProgramPlanProposalCard.tsx` (place inside whatever directory Plan 06 created for its action cards — verify)
- Modify: Plan 06's action-card dispatcher (assumed `client/src/pages/Coach/components/AiActionCard.tsx`) to route `CreateProgramPlan`/`UpdateProgramPlan`
- Create: `client/src/pages/Program/components/ActivateProgramDialog.tsx` (inside Plan 02's program page — verify)
- Modify: Plan 02's program detail page/hook to open the dialog before activating

**Interfaces:**
- Consumes generated types only (global rule — no handwritten API models): `JsonModels.AI.ProposeProgramPlanArguments`, `ProposeProgramUpdateArguments`, `CreateProgramPlanActionResultModel`, `UpdateProgramPlanActionResultModel`, `AiActionModel` (Plan 06), `ProgramPlanModel` (Plan 01/02), enums `AiActionType`, `AiActionStatus`, `ProgramPlanDayType`, `ProgramScheduleType`, `DayOfWeek` — all exported automatically from `@/types`. Services: Plan 06's `aiService` (confirm/reject) and Plan 02's `programPlanService` (`activate(id)`) — verify both file names.
- Produces: spec-§33 preview card and the explicit activation confirmation.

- [ ] **Step 1: Write `ProgramPlanProposalCard.tsx`** (spec §33 layout: name, duration, frequency, weekday→template table or rotation list, total workouts, new templates, warnings, Create draft / Reject; executed state with View program + Activate)

```tsx
import { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  AiActionStatus,
  AiActionType,
  ProgramPlanDayType,
  ProgramScheduleType,
  type AiActionModel,
  type CreateProgramPlanActionResultModel,
  type ProposeProgramPlanArguments,
  type ProposeProgramUpdateArguments,
  type ProposedProgramScheduleItem,
} from "@/types";
import { programPlanService } from "@/services/programPlanService";

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface ProgramPlanProposalCardProps {
  action: AiActionModel;
  onConfirm: (actionId: number) => Promise<void>;
  onReject: (actionId: number) => Promise<void>;
}

function formatDay(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

function scheduleLabel(item: ProposedProgramScheduleItem, proposal: ProposeProgramPlanArguments | ProposeProgramUpdateArguments): string {
  if (item.dayType === ProgramPlanDayType.Rest) {
    return "Rest";
  }
  if (item.newWorkoutTemplateClientKey) {
    const template = proposal.newTemplates.find((t) => t.clientKey === item.newWorkoutTemplateClientKey);
    return template ? `${template.name} (new)` : item.newWorkoutTemplateClientKey;
  }
  return item.existingWorkoutTemplateId ? `Template #${item.existingWorkoutTemplateId}` : "—";
}

function countTotalWorkouts(proposal: ProposeProgramPlanArguments): number | null {
  if (!proposal.endDate) {
    return null;
  }
  const start = new Date(`${proposal.startDate}T00:00:00`);
  const end = new Date(`${proposal.endDate}T00:00:00`);
  const workoutItems = proposal.schedule.filter(
    (i) => i.dayType === ProgramPlanDayType.Workout || i.dayType === ProgramPlanDayType.OptionalWorkout,
  );
  let total = 0;
  if (proposal.scheduleType === ProgramScheduleType.FixedWeekdays) {
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      total += workoutItems.filter((i) => i.dayOfWeek === d.getDay()).length;
    }
    return total;
  }
  const cycleLength = Math.max(0, ...proposal.schedule.map((i) => i.rotationDayIndex ?? 0));
  if (cycleLength === 0) {
    return null;
  }
  const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  for (let offset = 0; offset < days; offset += 1) {
    const index = (offset % cycleLength) + 1;
    total += workoutItems.filter((i) => i.rotationDayIndex === index).length;
  }
  return total;
}

export function ProgramPlanProposalCard({ action, onConfirm, onReject }: ProgramPlanProposalCardProps) {
  const isUpdate = action.type === AiActionType.UpdateProgramPlan;
  const [busy, setBusy] = useState(false);
  const [activated, setActivated] = useState(false);

  const proposal = useMemo(
    () => JSON.parse(action.payloadJson) as ProposeProgramPlanArguments | ProposeProgramUpdateArguments,
    [action.payloadJson],
  );
  const warnings = useMemo(
    () => (action.validationSummaryJson ? (JSON.parse(action.validationSummaryJson) as string[]) : []),
    [action.validationSummaryJson],
  );
  const result = useMemo(
    () =>
      action.status === AiActionStatus.Executed && action.resultJson
        ? (JSON.parse(action.resultJson) as CreateProgramPlanActionResultModel)
        : null,
    [action.status, action.resultJson],
  );

  const createProposal = isUpdate ? null : (proposal as ProposeProgramPlanArguments);
  const totalWorkouts = createProposal ? countTotalWorkouts(createProposal) : null;
  const isRotation = createProposal?.scheduleType === ProgramScheduleType.Rotation;

  const handle = async (fn: (id: number) => Promise<void>) => {
    setBusy(true);
    try {
      await fn(action.id);
    } finally {
      setBusy(false);
    }
  };

  const handleActivate = async () => {
    if (!result) {
      return;
    }
    setBusy(true);
    try {
      await programPlanService.activate(result.programPlanId);
      setActivated(true);
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-4 text-sm">
        <p className="font-medium">
          {isUpdate ? "Program updated" : "Program created"} — {result.name}
          {result.plannedWorkouts != null && `, ${result.plannedWorkouts} planned workouts`}
        </p>
        <div className="mt-3 flex gap-2">
          <Link className="rounded-lg border px-3 py-1.5" to={`/program/${result.programPlanId}`}>
            View program
          </Link>
          {!isUpdate && !activated && (
            <button type="button" className="rounded-lg bg-emerald-600 px-3 py-1.5 text-white" disabled={busy} onClick={handleActivate}>
              Activate
            </button>
          )}
          {activated && <span className="px-3 py-1.5 text-emerald-500">Activated</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border p-4 text-sm">
      {isUpdate ? (
        <>
          <p className="font-semibold">Update program schedule</p>
          <p className="mt-1 text-muted-foreground">{(proposal as ProposeProgramUpdateArguments).reason}</p>
        </>
      ) : (
        <>
          <p className="font-semibold">{createProposal!.name}</p>
          <p className="mt-1 text-muted-foreground">
            {createProposal!.endDate
              ? `${formatDay(createProposal!.startDate)} – ${formatDay(createProposal!.endDate)}`
              : "Open-ended"}
            {" · "}
            {createProposal!.workoutsPerWeek}x per week
            {totalWorkouts != null && ` · ${totalWorkouts} workouts total`}
          </p>
        </>
      )}

      <table className="mt-3 w-full">
        <tbody>
          {proposal.schedule.map((item) => (
            <tr key={item.clientKey} className="border-t">
              <td className="py-1.5 pr-3 font-medium">
                {isRotation ? `Day ${item.rotationDayIndex}` : WEEKDAY_NAMES[item.dayOfWeek ?? 0]}
              </td>
              <td className="py-1.5">
                {scheduleLabel(item, proposal)}
                {item.isOptional && <span className="ml-1 text-muted-foreground">(optional)</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {proposal.newTemplates.length > 0 && (
        <div className="mt-3">
          <p className="font-medium">New workout templates</p>
          <ul className="mt-1 list-disc pl-5">
            {proposal.newTemplates.map((template) => (
              <li key={template.clientKey}>
                {template.name} · {template.exercises.length} exercises
              </li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <ul className="mt-3 rounded-lg border border-amber-600/40 bg-amber-950/20 p-2 pl-6 list-disc">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}

      {action.status === AiActionStatus.Pending && (
        <div className="mt-4 flex gap-2">
          <button type="button" className="rounded-lg bg-primary px-3 py-1.5 text-primary-foreground" disabled={busy} onClick={() => handle(onConfirm)}>
            {isUpdate ? "Apply update" : "Create draft"}
          </button>
          <button type="button" className="rounded-lg border px-3 py-1.5" disabled={busy} onClick={() => handle(onReject)}>
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
```

> Match the surrounding card styling (class names, button variants) to the action cards Plan 06
> shipped — copy their classes so the chat looks uniform; the structure above is the contract. If
> `AiActionModel`'s executed result for updates is `UpdateProgramPlanActionResultModel`, branch the
> `result` parse on `action.type` (both models share `programPlanId`/`name`).

- [ ] **Step 2: Register the card** in Plan 06's dispatcher switch:

```tsx
case AiActionType.CreateProgramPlan:
case AiActionType.UpdateProgramPlan:
  return <ProgramPlanProposalCard action={action} onConfirm={onConfirm} onReject={onReject} />;
```

- [ ] **Step 3: Add `ActivateProgramDialog.tsx`** to the program page (spec §33: activation requires a final schedule confirmation). If Plan 02 already ships an equivalent confirmation, verify it shows the schedule summary and skip this step.

```tsx
import type { ProgramPlanModel } from "@/types";

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface ActivateProgramDialogProps {
  plan: ProgramPlanModel;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ActivateProgramDialog({ plan, busy, onConfirm, onCancel }: ActivateProgramDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border bg-background p-5">
        <h2 className="text-lg font-semibold">Activate "{plan.name}"?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {plan.endDate
            ? `Runs ${plan.startDate} to ${plan.endDate}.`
            : "Open-ended — keeps going until you complete or cancel it."}{" "}
          The calendar will be generated and this becomes your active program.
        </p>
        <ul className="mt-3 space-y-1 text-sm">
          {plan.scheduleRules.map((rule) => (
            <li key={rule.id}>
              {rule.rotationDayIndex != null ? `Day ${rule.rotationDayIndex}` : WEEKDAY_NAMES[rule.dayOfWeek ?? 0]}
              {" — "}
              {rule.workoutTemplateName ?? "Rest"}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="rounded-lg border px-3 py-1.5" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="rounded-lg bg-primary px-3 py-1.5 text-primary-foreground" disabled={busy} onClick={onConfirm}>
            Activate program
          </button>
        </div>
      </div>
    </div>
  );
}
```

Wire it into Plan 02's program detail page: the existing Activate button opens this dialog; `onConfirm` calls the page's existing activate handler (`await programPlanService.activate(plan.id)` + refresh). Follow the page's existing state-hook pattern (`useState<boolean>` for dialog visibility inside the page hook).

- [ ] **Step 4: Lint + typecheck**

Run: `cd client && npm run lint && npx tsc -b --noEmit`
Expected: clean. Fix any errors before finishing (global rule).

- [ ] **Step 5: Commit**

```bash
git add client/src
git commit -m "feat(ai-program): program proposal card and explicit activation confirmation"
```

---

## Acceptance criteria (Plan 07 done)

- `propose_program_plan` accepts exactly the spec-§31 argument shape (with nullable `EndDate` per roadmap D1); every exercise must reference an existing visible exercise, and the error message steers the model to `propose_exercise` (roadmap D5 three-step flow, reinforced by `program-generation-v1.txt` which also mandates `get_training_profile` / `get_training_snapshot` / `search_exercises` / `get_exercise_history` / `get_active_program` first).
- `ProgramPlanProposalValidator` enforces every spec-§32 error rule (start/end, duration entitlement, workouts/week 1–7, template/exercise visibility, weekday/rotation field validity, sequential rotation indexes, duplicates, dangling ClientKeys, set ranges) and emits the three confirmable warnings (>3 consecutive training days, workouts/week mismatch, >16 weeks) — errors make the tool return `Success=false` (model retries); warnings ride on the action's `ValidationSummaryJson`.
- Confirming a `CreateProgramPlan` action creates NewTemplates first (ClientKey→id map, mixed with existing template ids), then a DRAFT plan via `CreateDraftAsync` with `IsAiGenerated=true` and `SourceAiActionId` set; the executor **never** activates and is idempotent (double confirm → one draft).
- `propose_program_update` + `UpdateProgramPlanActionExecutor` modify only future `Scheduled` days from tomorrow via `UpdateActiveScheduleAsync`; completed/started/moved days are untouched; schedule type cannot change.
- `SubscriptionFeature.AiProgramGeneration` is charged reserve→commit (release on failure); both tools are hidden from the model (`IsAvailable`) and hard-gated (`RequireFeatureAsync`) without the entitlement — proven by the forbidden-tool contract test.
- Deterministic fake-provider tests cover: scripted "four-day hypertrophy program" flow → pending action, no draft; confirm → draft with 4 rules + 2 created templates; entitlement-off tool hiding; plus full validator matrix, executor idempotency and the 2-new+1-existing ClientKey resolution test.
- Frontend shows the spec-§33 proposal card (name, duration or "Open-ended", frequency, weekday/rotation table, total workouts, new templates, warnings, Create draft / Reject) and, after execution, "Program created — name, N planned workouts" with View program (`/program/{id}`) and an explicit Activate step with final schedule confirmation.
- `dotnet build server/FitMate.sln`, `dotnet test server/FitMate.sln`, and `cd client && npm run lint && npx tsc -b --noEmit` all pass; generated types include the new `JsonModels.AI` models.
