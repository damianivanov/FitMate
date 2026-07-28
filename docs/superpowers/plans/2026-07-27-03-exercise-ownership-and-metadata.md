# Exercise Ownership, Metadata/Aliases and User Training Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exercise creation scope becomes explicit (personal vs global comes from the endpoint called, never inferred from role), exercises gain structured metadata (equipment / movement pattern / difficulty / category) and searchable aliases, and each user gets a one-per-user training profile (goal, experience, schedule preferences, equipment, restrictions) editable from the Profile page — the data foundation the AI phases (Plans 05–07) consume.

**Architecture:** `ExerciseService.CreateAsync` (which silently made every admin-created exercise global) is split into `CreatePersonalAsync(request, userId)` (POST `api/exercises`) and `CreateGlobalAsync(request)` (POST `api/admin/exercises`, admin-only, enforced in both controller and service). `Exercise` gains four nullable enums plus an `ExerciseAlias` child entity (normalized via a unit-tested static `ExerciseAliasNormalizer`) that is folded into the existing exercise search queries. A new `UserTrainingProfile` entity (unique per user, jsonb list columns) is exposed through `ITrainingProfileService` and `GET/PUT api/training-profile`, with a new "Training" section on the Profile page.

**Tech Stack:** .NET 9, EF Core + Npgsql (Sqlite in tests), xUnit, Reinforced.Typings type export, React 19 + existing liquid-UI components (`Dropdown`, `SegmentControl`, `TextInputField`, `TextareaField`).

## Global Constraints

- Follow repo conventions (roadmap D4): services take `(request, long userId)` where a user scope is needed, **no CancellationToken**; controllers extend `BaseApiController(ILogger<BaseApiController>, AppDbContext, IUserService)` and use `this.ReturnJson(...)` / `this.ReturnJsonError(...)`; DTOs in `FitMate.Core/JsonModels/<Feature>/`; enums in `FitMate.DB/Enums`; entity configs in `FitMate.DB/Configurations` (extend `BaseConfiguration<T>`); DbSets as expression-bodied properties in `AppDbContext`.
- Validation/authorization failures inside services throw the repo's `FitMateException` (`server/FitMate.Core/Exceptions/FitMateException.cs`) — do not invent new exception types.
- `AppDbContext.SaveChangesAsync()` stamps `DateCreated`/`DateModified` — never set them manually.
- Canonical names (roadmap Shared Contracts): entities `ExerciseAlias`, `UserTrainingProfile`; enums `TrainingGoal`, `TrainingExperienceLevel`, `ExerciseEquipment`, `ExerciseMovementPattern`, `ExerciseDifficulty`, `ExerciseCategory`. `TrainingGoal` is defined by **Plan 01** — do not redefine it if it exists; if Plan 01 has not merged yet, create it byte-identical to Plan 01 Task 1 so the merge is a no-op.
- **No** `FixExerciseOwnership` migration: the ownership bug is logic-only (no schema change). Reclassifying historical wrongly-global exercises cannot be automated safely (intended-global and accidental-global are indistinguishable in data) — leave existing rows untouched. **REVIEW decision** — see Acceptance criteria.
- Migrations in this order: `AddExerciseMetadataAndAliases` (Task 4), `AddUserTrainingProfile` (Task 6).
- jsonb columns use `.HasColumnType("jsonb")` (Npgsql). Sqlite ignores the unknown type name and stores the JSON string as TEXT — tests keep working with `EnsureCreated`.
- After backend DTO changes: `dotnet build server/FitMate.Web/FitMate.Web.csproj` regenerates `client/src/types/backend.ts`, then `cd client && npm run process-types` (this also regenerates `client/src/types/JsonModels/**` and `client/src/types/index.ts` — never hand-edit those).
- Frontend: never write TS interfaces for API models by hand; all API types come from `@/types`. After any React/TS change: `cd client && npm run lint && npx tsc -b --noEmit`.
- All commands run from repo root `c:\Users\damian\Documents\Github\FitMate`.

## File Structure

```
server/FitMate.Services/Exercises/
├── IExerciseService.cs (modify: split create)                    (Task 1)
├── ExerciseService.cs (modify: create split; metadata; aliases)  (Tasks 1, 3, 4)
└── ExerciseAliasNormalizer.cs                                    (Task 4)
server/FitMate.Web/Controllers/ExerciseController.cs (modify)     (Task 1)
server/FitMate.Web/Controllers/Admin/AdminExerciseController.cs (modify) (Task 1)
server/FitMate.Tests/Unit/Services/ExerciseServiceTests.cs (modify) (Tasks 1, 3, 4)

client/src/services/adminService.ts (modify: exercises.create)    (Task 2)
client/src/pages/AdminPanel/ExerciseGrid/hooks/useExerciseGridPage.ts (modify) (Tasks 2, 5)

server/FitMate.DB/Enums/ExerciseEquipment.cs, ExerciseMovementPattern.cs,
│         ExerciseDifficulty.cs, ExerciseCategory.cs              (Task 3)
server/FitMate.DB/Entities/Exercise.cs (modify)                   (Tasks 3, 4)
server/FitMate.Core/JsonModels/Exercises/ExerciseModel.cs (modify) (Tasks 3, 4)
server/FitMate.Core/JsonModels/Exercises/CreateExerciseRequest.cs (modify) (Tasks 3, 4)
server/FitMate.Core/JsonModels/Exercises/ExerciseLookupModel.cs (modify) (Tasks 3, 4)

server/FitMate.DB/Entities/ExerciseAlias.cs                       (Task 4)
server/FitMate.DB/Configurations/ExerciseAliasConfiguration.cs    (Task 4)
server/FitMate.DB/AppDbContext.cs (modify: ExerciseAliases DbSet) (Task 4)
server/FitMate.DB/Migrations/xxx_AddExerciseMetadataAndAliases.cs (generated) (Task 4)
server/FitMate.Tests/Unit/Services/ExerciseAliasNormalizerTests.cs (Task 4)

client/src/shared/components/exerciseFormValues.ts (modify)       (Task 5)
client/src/shared/components/AddExerciseModal.tsx (modify)        (Task 5)
client/src/pages/Profile/hooks/useMyExercisesPage.ts (modify)     (Task 5)
client/src/pages/Profile/MyExercises.tsx (modify)                 (Task 5)
client/src/pages/AdminPanel/ExerciseGrid/ExerciseGrid.tsx (modify) (Task 5)

server/FitMate.DB/Enums/TrainingExperienceLevel.cs, WeightUnit.cs (Task 6)
server/FitMate.DB/Enums/TrainingGoal.cs (ONLY if Plan 01 not merged) (Task 6)
server/FitMate.DB/Entities/UserTrainingProfile.cs                 (Task 6)
server/FitMate.DB/Configurations/UserTrainingProfileConfiguration.cs (Task 6)
server/FitMate.DB/AppDbContext.cs (modify: UserTrainingProfiles DbSet) (Task 6)
server/FitMate.DB/Migrations/xxx_AddUserTrainingProfile.cs (generated) (Task 6)

server/FitMate.Core/JsonModels/TrainingProfiles/TrainingProfileModel.cs,
│         SaveTrainingProfileRequest.cs                           (Task 7)
server/FitMate.Services/TrainingProfiles/ITrainingProfileService.cs,
│         TrainingProfileService.cs                               (Task 7)
server/FitMate.Web/Controllers/TrainingProfileController.cs       (Task 7)
server/FitMate.Web/Program.cs (modify: 1 DI line)                 (Task 7)
server/FitMate.Tests/Unit/Services/TrainingProfileServiceTests.cs (Task 7)

client/src/services/trainingProfileService.ts                     (Task 8)
client/src/pages/Profile/TrainingProfile.tsx                      (Task 8)
client/src/pages/Profile/hooks/useTrainingProfilePage.ts          (Task 8)
client/src/pages/Profile/Profile.tsx (modify: nav item)           (Task 8)
client/src/pages/Profile/index.ts (modify)                        (Task 8)
client/src/routes.tsx (modify: profile/training route)            (Task 8)

server/FitMate.Tests/Integration/ExerciseOwnershipApiTests.cs     (Task 9)
server/FitMate.Tests/Integration/TrainingProfileApiTests.cs       (Task 9)
```

---

### Task 1: Explicit exercise creation scope — `CreatePersonalAsync` / `CreateGlobalAsync` (TDD)

**Files:**
- Modify: `server/FitMate.Services/Exercises/IExerciseService.cs`, `server/FitMate.Services/Exercises/ExerciseService.cs`
- Modify: `server/FitMate.Web/Controllers/ExerciseController.cs`, `server/FitMate.Web/Controllers/Admin/AdminExerciseController.cs`
- Test: `server/FitMate.Tests/Unit/Services/ExerciseServiceTests.cs`

**Interfaces:**
- Consumes: existing `CreateExerciseRequest`, `ExerciseModel`, `FitMateException`, `IUserService.LoggedInUserIsAdmin`, private `CreateInternalAsync(request, exerciseOwnerUserId, isPublic)` already in `ExerciseService`.
- Produces (later tasks, Plan 06 executors, and the frontend rely on these exact signatures):

```csharp
// IExerciseService — CreateAsync is REMOVED and replaced by:
Task<ExerciseModel> CreatePersonalAsync(CreateExerciseRequest request, long userId);
Task<ExerciseModel> CreateGlobalAsync(CreateExerciseRequest request);
```

HTTP surface:

```
POST /api/exercises        → ExerciseModel   (always personal: UserId = caller, IsPublic = request.IsPublic — for admins too)
POST /api/admin/exercises  → ExerciseModel   (always global: UserId = null, IsPublic = true; [AdminGuard])
```

- [ ] **Step 1: Write failing tests** — in `ExerciseServiceTests.cs`, DELETE the three obsolete tests `CreateAsync_UserCreatesExercise_AssignsUserIdAndKeepsRequestVisibility`, `CreateAsync_AdminCreatesExercise_CreatesGlobalPublicExercise` and `CreateAsync_NoLoggedInUser_ThrowsUnauthorized` (the unauthorized guard moves to the controller — the service now receives an explicit `userId`), and add:

```csharp
    // Потребител създава лично упражнение със своя UserId и зададена видимост
    [Fact]
    public async Task CreatePersonalAsync_NormalUser_AssignsUserIdAndKeepsRequestVisibility()
    {
        using var db = new SqliteTestDatabase();

        ExerciseModel created;
        using (var context = db.CreateContext())
        {
            var service = BuildService(context, FakeUserService.ForUser(SqliteTestDatabase.UserId));
            created = await service.CreatePersonalAsync(NewRequest(isPublic: false), SqliteTestDatabase.UserId);
        }

        using var assert = db.CreateContext();
        var stored = await assert.Exercises.SingleAsync(x => x.Id == created.Id);
        Assert.Equal(SqliteTestDatabase.UserId, stored.UserId);
        Assert.False(stored.IsPublic);
    }

    // Admin през personal endpoint-а създава ЛИЧНО упражнение (фикс на бъга)
    [Fact]
    public async Task CreatePersonalAsync_Admin_CreatesPersonalExerciseOwnedByAdmin()
    {
        using var db = new SqliteTestDatabase();

        ExerciseModel created;
        using (var context = db.CreateContext())
        {
            var service = BuildService(context, FakeUserService.ForAdmin(SqliteTestDatabase.AdminUserId));
            created = await service.CreatePersonalAsync(NewRequest(isPublic: false), SqliteTestDatabase.AdminUserId);
        }

        using var assert = db.CreateContext();
        var stored = await assert.Exercises.SingleAsync(x => x.Id == created.Id);
        Assert.Equal(SqliteTestDatabase.AdminUserId, stored.UserId);
        Assert.False(stored.IsPublic);
    }

    // Admin изрично създава глобално: UserId = null, винаги публично
    [Fact]
    public async Task CreateGlobalAsync_Admin_CreatesGlobalPublicExercise()
    {
        using var db = new SqliteTestDatabase();

        ExerciseModel created;
        using (var context = db.CreateContext())
        {
            var service = BuildService(context, FakeUserService.ForAdmin(SqliteTestDatabase.AdminUserId));
            created = await service.CreateGlobalAsync(NewRequest(isPublic: false)); // isPublic in request is ignored
        }

        using var assert = db.CreateContext();
        var stored = await assert.Exercises.SingleAsync(x => x.Id == created.Id);
        Assert.Null(stored.UserId);
        Assert.True(stored.IsPublic);
    }

    // Обикновен потребител не може да създава глобални упражнения
    [Fact]
    public async Task CreateGlobalAsync_NonAdmin_Throws()
    {
        using var db = new SqliteTestDatabase();
        using var context = db.CreateContext();
        var service = BuildService(context, FakeUserService.ForUser(SqliteTestDatabase.UserId));

        var ex = await Assert.ThrowsAsync<FitMateException>(() => service.CreateGlobalAsync(NewRequest()));
        Assert.Equal("Administrator access is required.", ex.Message);
    }
```

Also update every remaining test in the file that calls `service.CreateAsync(...)` (validation tests: empty name, missing muscle group, duplicate slug, etc.) to call `service.CreatePersonalAsync(<request>, SqliteTestDatabase.UserId)` — same assertions, unchanged messages. This is the "existing behavior regression" coverage.

- [ ] **Step 2: Run tests to verify they fail**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter ExerciseServiceTests`
Expected: FAIL — `CreatePersonalAsync`/`CreateGlobalAsync` do not exist (compile error).

- [ ] **Step 3: Implement the split** — in `IExerciseService.cs` replace `Task<ExerciseModel> CreateAsync(CreateExerciseRequest request);` with the two signatures from the Interfaces block. In `ExerciseService.cs` replace the `CreateAsync` method body with:

```csharp
    public async Task<ExerciseModel> CreatePersonalAsync(CreateExerciseRequest request, long userId)
    {
        return await CreateInternalAsync(request, exerciseOwnerUserId: userId, isPublic: request.IsPublic);
    }

    public async Task<ExerciseModel> CreateGlobalAsync(CreateExerciseRequest request)
    {
        // Scope comes from the endpoint called; this second check guards against a future
        // controller wiring mistake (same belt-and-braces style as LoadEditableExerciseAsync).
        if (!userService.LoggedInUserIsAdmin)
        {
            throw new FitMateException("Administrator access is required.");
        }

        return await CreateInternalAsync(request, exerciseOwnerUserId: null, isPublic: true);
    }
```

`CreateInternalAsync` stays exactly as it is.

- [ ] **Step 4: Update the controllers**

`ExerciseController.Create` becomes:

```csharp
    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CreateExerciseRequest request)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        // Always personal — admins wanting a global exercise use POST api/admin/exercises.
        var created = await exerciseService.CreatePersonalAsync(request, userId.Value);
        return this.ReturnJson(created);
    }
```

(Keep the existing comment about the image being attached separately.) `AdminExerciseController` gains:

```csharp
    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CreateExerciseRequest request)
    {
        var created = await exerciseService.CreateGlobalAsync(request);
        return this.ReturnJson(created);
    }
```

(The class-level `[AdminGuard]` already covers it.) Then grep the server for any other `CreateAsync` call on `IExerciseService` (`rg "exerciseService.CreateAsync|IExerciseService" server/`) — `ExerciseController` should have been the only caller; fix any others the same way.

- [ ] **Step 5: Run tests to verify they pass**

Run: `dotnet build server/FitMate.sln` then `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter ExerciseServiceTests`
Expected: build OK, all ExerciseServiceTests PASS.

- [ ] **Step 6: Commit**

```bash
git add server/FitMate.Services server/FitMate.Web server/FitMate.Tests
git commit -m "fix(exercises): explicit personal vs global creation scope per endpoint"
```

---

### Task 2: Frontend — admin grid creates globals via the admin endpoint

**Files:**
- Modify: `client/src/services/adminService.ts`, `client/src/pages/AdminPanel/ExerciseGrid/hooks/useExerciseGridPage.ts`

**Interfaces:**
- Consumes: Task 1's `POST /api/admin/exercises`; existing `exerciseService.uploadImage` / `exerciseService.remove` (both already work for admins on any exercise).
- Produces: `adminService.exercises.create(payload: CreateExerciseRequest, file?: File)`.

Call-site inventory (verified): `exerciseService.create` is used by `useMyExercisesPage.ts` (personal — correct as-is), `ExerciseAddModal.tsx` in ExerciseBuilder (ad-hoc personal creation from the workout builder — correct as-is, admins now correctly get a personal exercise), and `useExerciseGridPage.ts` (admin grid — must switch to the global endpoint). Only the admin grid changes.

- [ ] **Step 1: Add `create` to `adminService.exercises`** (mirrors `exerciseService.create`'s create-then-image-then-cleanup contract):

```ts
// adminService.ts — add imports:
import { unwrap } from "@/lib/unwrap";
import { exerciseService } from "@/services/exerciseService";
import type { CreateExerciseRequest } from "@/types";

// inside exercises: { ... }
    async create(payload: CreateExerciseRequest, file?: File) {
      // Admin-scope endpoint: creates a GLOBAL exercise (userId = null, always public).
      const response = await api.post<JsonData<Exercise>>("admin/exercises", payload);

      if (!file) {
        return response;
      }

      const created = unwrap(response.data, "Create failed.");

      try {
        return await exerciseService.uploadImage(created.id, file);
      } catch (imageError) {
        try {
          await exerciseService.remove(created.id);
        } catch {
          // Ignore cleanup failures; surface the original image error.
        }

        throw imageError;
      }
    },
```

- [ ] **Step 2: Switch the admin grid's create path** — in `useExerciseGridPage.ts` `save` callback replace:

```ts
        const response = editingId
          ? await exerciseService.update(editingId, payload)
          : await exerciseService.create(payload, file);
```

with:

```ts
        const response = editingId
          ? await exerciseService.update(editingId, payload)
          : await adminService.exercises.create(payload, file);
```

(`adminService` is already imported in this hook. Edit stays on `exerciseService.update` — admins may edit any exercise there.)

- [ ] **Step 3: Lint + typecheck**

Run: `cd client && npm run lint && npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add client/src
git commit -m "fix(admin): exercise grid creates global exercises via admin endpoint"
```

---

### Task 3: Exercise metadata enums + entity/DTO fields (TDD)

**Files:**
- Create: `server/FitMate.DB/Enums/ExerciseEquipment.cs`, `ExerciseMovementPattern.cs`, `ExerciseDifficulty.cs`, `ExerciseCategory.cs`
- Modify: `server/FitMate.DB/Entities/Exercise.cs`, `server/FitMate.Core/JsonModels/Exercises/ExerciseModel.cs`, `CreateExerciseRequest.cs`, `ExerciseLookupModel.cs`, `server/FitMate.Services/Exercises/ExerciseService.cs`
- Test: `server/FitMate.Tests/Unit/Services/ExerciseServiceTests.cs`

**Interfaces:**
- Consumes: Task 1 service shape.
- Produces: the four enums below (canonical roadmap names; member sets are a pragmatic proposal — **flagged for review**, the spec does not enumerate them) and the four nullable properties on `Exercise`/`ExerciseModel`/`CreateExerciseRequest`/`ExerciseLookupModel`. Plan 05's `search_exercises` tool and Plan 07's program generation read these exact property names.

- [ ] **Step 1: Write the enums** (one file each, namespace `FitMate.DB.Enums`):

```csharp
namespace FitMate.DB.Enums;

public enum ExerciseEquipment
{
    Barbell = 1,
    Dumbbell = 2,
    Kettlebell = 3,
    Cable = 4,
    Machine = 5,
    Bodyweight = 6,
    ResistanceBand = 7,
    MedicineBall = 8,
    Other = 9,
}

public enum ExerciseMovementPattern
{
    HorizontalPush = 1,
    HorizontalPull = 2,
    VerticalPush = 3,
    VerticalPull = 4,
    Squat = 5,
    Hinge = 6,
    Lunge = 7,
    Carry = 8,
    Rotation = 9,
    Isolation = 10,
    Other = 11,
}

public enum ExerciseDifficulty
{
    Beginner = 1,
    Intermediate = 2,
    Advanced = 3,
}

public enum ExerciseCategory
{
    Strength = 1,
    Cardio = 2,
    Mobility = 3,
    Plyometric = 4,
    Olympic = 5,
    Other = 6,
}
```

- [ ] **Step 2: Write failing tests** — add to `ExerciseServiceTests.cs`:

```csharp
    // Метаданните се записват при създаване
    [Fact]
    public async Task CreatePersonalAsync_WithMetadata_PersistsMetadata()
    {
        using var db = new SqliteTestDatabase();

        ExerciseModel created;
        using (var context = db.CreateContext())
        {
            var service = BuildService(context, FakeUserService.ForUser(SqliteTestDatabase.UserId));
            var request = NewRequest();
            request.Equipment = ExerciseEquipment.Barbell;
            request.MovementPattern = ExerciseMovementPattern.HorizontalPush;
            request.Difficulty = ExerciseDifficulty.Intermediate;
            request.Category = ExerciseCategory.Strength;
            created = await service.CreatePersonalAsync(request, SqliteTestDatabase.UserId);
        }

        Assert.Equal(ExerciseEquipment.Barbell, created.Equipment);
        using var assert = db.CreateContext();
        var stored = await assert.Exercises.SingleAsync(x => x.Id == created.Id);
        Assert.Equal(ExerciseEquipment.Barbell, stored.Equipment);
        Assert.Equal(ExerciseMovementPattern.HorizontalPush, stored.MovementPattern);
        Assert.Equal(ExerciseDifficulty.Intermediate, stored.Difficulty);
        Assert.Equal(ExerciseCategory.Strength, stored.Category);
    }

    // Update променя и изчиства метаданните
    [Fact]
    public async Task UpdateAsync_ChangesAndClearsMetadata()
    {
        using var db = new SqliteTestDatabase();
        using var context = db.CreateContext();
        var service = BuildService(context, FakeUserService.ForUser(SqliteTestDatabase.UserId));
        var request = NewRequest();
        request.Equipment = ExerciseEquipment.Dumbbell;
        var created = await service.CreatePersonalAsync(request, SqliteTestDatabase.UserId);

        var update = NewRequest();
        update.Slug = created.Slug;
        update.Equipment = null;                          // clear
        update.Difficulty = ExerciseDifficulty.Advanced;  // set
        var updated = await service.UpdateAsync(created.Id, update);

        Assert.Null(updated.Equipment);
        Assert.Equal(ExerciseDifficulty.Advanced, updated.Difficulty);
    }
```

Add `using FitMate.DB.Enums;` to the test file.

- [ ] **Step 3: Run tests — expect FAIL** (compile error: `CreateExerciseRequest.Equipment` missing)

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter ExerciseServiceTests`

- [ ] **Step 4: Add the four properties everywhere.** Same block in all four types (add `using FitMate.DB.Enums;` where missing — `FitMate.Core` already references `FitMate.DB`, same as `CreateWorkoutTemplateExerciseRequest` using `ExerciseGroupType`):

`Exercise.cs` (after `SecondaryMuscleGroupId`), `ExerciseModel.cs` (after `SecondaryMuscleGroupId`), `CreateExerciseRequest.cs` (after `SecondaryMuscleGroupId`), `ExerciseLookupModel.cs` (after `SecondaryMuscleGroupName`):

```csharp
    public ExerciseEquipment? Equipment { get; set; }
    public ExerciseMovementPattern? MovementPattern { get; set; }
    public ExerciseDifficulty? Difficulty { get; set; }
    public ExerciseCategory? Category { get; set; }
```

No `ExerciseConfiguration` change needed — nullable enums map to nullable int columns automatically.

- [ ] **Step 5: Thread metadata through `ExerciseService`** — five touch points:

1. `NormalizeRequest` — add to the returned object initializer:

```csharp
            Equipment = request.Equipment,
            MovementPattern = request.MovementPattern,
            Difficulty = request.Difficulty,
            Category = request.Category,
```

2. `CreateInternalAsync` — add the same four assignments to the `new Exercise { ... }` initializer.
3. `UpdateAsync` — after `exercise.SecondaryMuscleGroupId = normalized.SecondaryMuscleGroupId;` add:

```csharp
        exercise.Equipment = normalized.Equipment;
        exercise.MovementPattern = normalized.MovementPattern;
        exercise.Difficulty = normalized.Difficulty;
        exercise.Category = normalized.Category;
```

4. `MapToModel` and `MapToModelExpression` — add `Equipment = entity.Equipment, MovementPattern = entity.MovementPattern, Difficulty = entity.Difficulty, Category = entity.Category,` to both initializers.
5. `MapToLookupModelExpression` — same four lines (`x.` instead of `entity.`) — **and** add the same four properties to the manual copy inside `ResolveLookupUrlsAsync` (it clones `ExerciseLookupModel` field-by-field; forgetting this silently drops metadata from lookups).

- [ ] **Step 6: Run tests to verify they pass, then full suite**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter ExerciseServiceTests` then `dotnet test server/FitMate.sln`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/FitMate.DB server/FitMate.Core server/FitMate.Services server/FitMate.Tests
git commit -m "feat(exercises): equipment/movement/difficulty/category metadata"
```

---

### Task 4: Alias normalizer, `ExerciseAlias` entity, alias editing + search, migration (TDD)

**Files:**
- Create: `server/FitMate.Services/Exercises/ExerciseAliasNormalizer.cs`, `server/FitMate.DB/Entities/ExerciseAlias.cs`, `server/FitMate.DB/Configurations/ExerciseAliasConfiguration.cs`
- Modify: `server/FitMate.DB/Entities/Exercise.cs`, `server/FitMate.DB/AppDbContext.cs`, `server/FitMate.Core/JsonModels/Exercises/{CreateExerciseRequest,ExerciseModel,ExerciseLookupModel}.cs`, `server/FitMate.Services/Exercises/ExerciseService.cs`
- Test: `server/FitMate.Tests/Unit/Services/ExerciseAliasNormalizerTests.cs`, `ExerciseServiceTests.cs`

**Interfaces:**
- Consumes: Task 3 state.
- Produces (Plan 05's exercise-matching tools call the normalizer with AI-provided names; search behavior is relied on by the exercise pickers):

```csharp
public static class ExerciseAliasNormalizer
{
    public static string Normalize(string? value); // trim, lowercase, strip punctuation, collapse whitespace
}
```

`CreateExerciseRequest` gains `List<string>? Aliases`; `ExerciseModel`/`ExerciseLookupModel` gain `List<string> Aliases`. Alias hits surface the exercise in `GetAllAsync`, `GetMineAsync` and admin `ListAsync` searches.

- [ ] **Step 1: Write failing normalizer tests** (`ExerciseAliasNormalizerTests.cs` — pure unit tests):

```csharp
using FitMate.Services.Exercises;

namespace FitMate.Tests.Unit.Services;

public class ExerciseAliasNormalizerTests
{
    [Theory]
    [InlineData("  Bench   Press ", "bench press")]
    [InlineData("Pull-Up", "pull up")]
    [InlineData("pull_up", "pull up")]
    [InlineData("Skullcrushers!!!", "skullcrushers")]
    [InlineData("DB Fly's", "db flys")]
    [InlineData("Overhead Press (OHP)", "overhead press ohp")]
    [InlineData("BENCH PRESS", "bench press")]
    public void Normalize_ProducesCanonicalForm(string input, string expected)
    {
        Assert.Equal(expected, ExerciseAliasNormalizer.Normalize(input));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("!!!")]
    public void Normalize_EmptyInputs_ReturnEmptyString(string? input)
    {
        Assert.Equal(string.Empty, ExerciseAliasNormalizer.Normalize(input));
    }
}
```

- [ ] **Step 2: Run — expect FAIL** (`ExerciseAliasNormalizer` missing)

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter ExerciseAliasNormalizerTests`

- [ ] **Step 3: Implement the normalizer** (`server/FitMate.Services/Exercises/ExerciseAliasNormalizer.cs` — deliberately NOT in `FitMate.Core.Common`, because Reinforced.Typings exports everything in that namespace to TypeScript):

```csharp
using System.Text;

namespace FitMate.Services.Exercises;

/// <summary>
/// Canonical alias form used for lookups and AI exercise matching:
/// trim, lowercase, separators (whitespace/-/_) collapse to single spaces, all other punctuation stripped.
/// </summary>
public static class ExerciseAliasNormalizer
{
    public static string Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var builder = new StringBuilder(value.Length);
        var pendingSpace = false;

        foreach (var character in value.Trim().ToLowerInvariant())
        {
            if (char.IsLetterOrDigit(character))
            {
                if (pendingSpace && builder.Length > 0)
                {
                    builder.Append(' ');
                }

                builder.Append(character);
                pendingSpace = false;
                continue;
            }

            if (char.IsWhiteSpace(character) || character is '-' or '_')
            {
                pendingSpace = true;
            }

            // Any other punctuation is dropped entirely ("Fly's" -> "flys").
        }

        return builder.ToString();
    }
}
```

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter ExerciseAliasNormalizerTests` — expect PASS (11 cases).

- [ ] **Step 4: Entity + configuration + DbSet**

`server/FitMate.DB/Entities/ExerciseAlias.cs`:

```csharp
using FitMate.DB.Entities.Base;

namespace FitMate.DB.Entities;

public class ExerciseAlias : BaseEntity
{
    public long ExerciseId { get; set; }
    public string Alias { get; set; } = string.Empty;
    public string NormalizedAlias { get; set; } = string.Empty;

    public Exercise Exercise { get; set; } = null!;
}
```

In `Exercise.cs` add to the navigation block:

```csharp
    public ICollection<ExerciseAlias> Aliases { get; set; } = [];
```

`server/FitMate.DB/Configurations/ExerciseAliasConfiguration.cs`:

```csharp
using FitMate.DB.Configurations.Base;
using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

internal class ExerciseAliasConfiguration : BaseConfiguration<ExerciseAlias>
{
    public override void Configure(EntityTypeBuilder<ExerciseAlias> builder)
    {
        base.Configure(builder);

        builder.Property(x => x.Alias)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(x => x.NormalizedAlias)
            .IsRequired()
            .HasMaxLength(200);

        builder.HasOne(x => x.Exercise)
            .WithMany(x => x.Aliases)
            .HasForeignKey(x => x.ExerciseId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => x.NormalizedAlias);
        builder.HasIndex(x => new { x.ExerciseId, x.NormalizedAlias }).IsUnique();
    }
}
```

In `AppDbContext.cs` add after the `Exercises` DbSet:

```csharp
    public DbSet<ExerciseAlias> ExerciseAliases => Set<ExerciseAlias>();
```

(Configurations are applied via `ApplyConfigurationsFromAssembly` — nothing else to register.)

- [ ] **Step 5: DTO fields**

`CreateExerciseRequest.cs`:

```csharp
    public List<string>? Aliases { get; set; }
```

`ExerciseModel.cs` and `ExerciseLookupModel.cs`:

```csharp
    public List<string> Aliases { get; set; } = [];
```

- [ ] **Step 6: Write failing service tests** — add to `ExerciseServiceTests.cs`:

```csharp
    // Aliases се записват нормализирани и дедупликирани
    [Fact]
    public async Task CreatePersonalAsync_WithAliases_PersistsNormalizedDeduplicatedAliases()
    {
        using var db = new SqliteTestDatabase();

        ExerciseModel created;
        using (var context = db.CreateContext())
        {
            var service = BuildService(context, FakeUserService.ForUser(SqliteTestDatabase.UserId));
            var request = NewRequest(name: "Overhead Press");
            request.Aliases = ["Military Press", "military-press", "OHP", "  "];
            created = await service.CreatePersonalAsync(request, SqliteTestDatabase.UserId);
        }

        using var assert = db.CreateContext();
        var aliases = await assert.ExerciseAliases
            .Where(x => x.ExerciseId == created.Id)
            .OrderBy(x => x.NormalizedAlias)
            .ToListAsync();
        // "Military Press" and "military-press" normalize identically -> one row
        Assert.Equal(2, aliases.Count);
        Assert.Equal("military press", aliases[0].NormalizedAlias);
        Assert.Equal("Military Press", aliases[0].Alias);
        Assert.Equal("ohp", aliases[1].NormalizedAlias);
    }

    // Update заменя изцяло списъка с aliases
    [Fact]
    public async Task UpdateAsync_ReplacesAliases()
    {
        using var db = new SqliteTestDatabase();
        using var context = db.CreateContext();
        var service = BuildService(context, FakeUserService.ForUser(SqliteTestDatabase.UserId));
        var request = NewRequest(name: "Overhead Press");
        request.Aliases = ["Military Press"];
        var created = await service.CreatePersonalAsync(request, SqliteTestDatabase.UserId);

        var update = NewRequest(name: "Overhead Press");
        update.Slug = created.Slug;
        update.Aliases = ["OHP", "Shoulder Press"];
        var updated = await service.UpdateAsync(created.Id, update);

        Assert.Equal(2, updated.Aliases.Count);
        Assert.DoesNotContain("Military Press", updated.Aliases);
        Assert.Equal(2, await context.ExerciseAliases.CountAsync(x => x.ExerciseId == created.Id));
    }

    // Търсенето намира упражнение по alias
    [Fact]
    public async Task GetAllAsync_SearchByAlias_ReturnsExercise()
    {
        using var db = new SqliteTestDatabase();
        using var context = db.CreateContext();
        var service = BuildService(context, FakeUserService.ForUser(SqliteTestDatabase.UserId));
        var request = NewRequest(name: "Overhead Press");
        request.Aliases = ["Military Press"];
        var created = await service.CreatePersonalAsync(request, SqliteTestDatabase.UserId);

        var results = await service.GetAllAsync(new ExerciseLookupRequest { Search = "military" });

        Assert.Contains(results, x => x.Id == created.Id);
    }

    // Изтриване на упражнение изтрива и aliases (cascade)
    [Fact]
    public async Task DeleteAsync_CascadesAliases()
    {
        using var db = new SqliteTestDatabase();
        using var context = db.CreateContext();
        var service = BuildService(context, FakeUserService.ForUser(SqliteTestDatabase.UserId));
        var request = NewRequest(name: "Overhead Press");
        request.Aliases = ["OHP"];
        var created = await service.CreatePersonalAsync(request, SqliteTestDatabase.UserId);

        await service.DeleteAsync(created.Id);

        Assert.Equal(0, await context.ExerciseAliases.CountAsync());
    }
```

- [ ] **Step 7: Run — expect FAIL**, then implement in `ExerciseService.cs`:

1. Private helper:

```csharp
    private static List<ExerciseAlias> BuildAliases(IEnumerable<string>? aliases)
    {
        var result = new List<ExerciseAlias>();
        var seenNormalized = new HashSet<string>(StringComparer.Ordinal);

        foreach (var raw in aliases ?? [])
        {
            var alias = (raw ?? string.Empty).Trim();
            var normalized = ExerciseAliasNormalizer.Normalize(alias);
            if (alias.Length == 0 || alias.Length > 200 || normalized.Length == 0 || !seenNormalized.Add(normalized))
            {
                continue;
            }

            result.Add(new ExerciseAlias { Alias = alias, NormalizedAlias = normalized });
        }

        return result;
    }
```

2. `NormalizeRequest` — add `Aliases = request.Aliases,` to the initializer.
3. `CreateInternalAsync` — add `Aliases = BuildAliases(normalized.Aliases),` to the `new Exercise { ... }` initializer.
4. `LoadEditableExerciseAsync` — change the query to `dbContext.Exercises.Include(x => x.Aliases).FirstOrDefaultAsync(x => x.Id == id)`.
5. `UpdateAsync` — after the metadata assignments add:

```csharp
        dbContext.ExerciseAliases.RemoveRange(exercise.Aliases);
        exercise.Aliases = BuildAliases(normalized.Aliases);
```

6. Search — in `GetAllAsync`, `GetMineAsync` and `ListAsync`, extend the search predicate with an alias clause. Pattern for `GetAllAsync` (mirror in the other two; `ListAsync` searches only Name/Slug today — add the alias clause there too):

```csharp
            if (!string.IsNullOrWhiteSpace(normalizedSearch))
            {
                var loweredSearch = normalizedSearch.ToLower();
                var aliasSearch = ExerciseAliasNormalizer.Normalize(normalizedSearch);
                query = query.Where(x =>
                    x.Name.ToLower().Contains(loweredSearch)
                    || x.Slug.ToLower().Contains(loweredSearch)
                    || x.PrimaryMuscleGroup.Name.ToLower().Contains(loweredSearch)
                    || (x.SecondaryMuscleGroup != null && x.SecondaryMuscleGroup.Name.ToLower().Contains(loweredSearch))
                    || (aliasSearch != "" && x.Aliases.Any(a => a.NormalizedAlias.Contains(aliasSearch))));
            }
```

The `aliasSearch != ""` guard is required: a search of pure punctuation (e.g. `"!!!"`) normalizes to an empty string, and `Contains("")` is true for every alias — without the guard such a search would return every exercise that has any alias.

7. Mapping — `MapToModel`: `Aliases = entity.Aliases.OrderBy(a => a.Alias).Select(a => a.Alias).ToList(),`; `MapToModelExpression` and `MapToLookupModelExpression`: `Aliases = entity.Aliases.Select(a => a.Alias).ToList(),` (EF collection projection); and add `Aliases = item.Aliases,` to the clone in `ResolveLookupUrlsAsync`.

- [ ] **Step 8: Run tests to verify they pass, then full suite**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter "ExerciseServiceTests|ExerciseAliasNormalizerTests"` then `dotnet test server/FitMate.sln`
Expected: PASS.

- [ ] **Step 9: Add the migration**

Run: `dotnet ef migrations add AddExerciseMetadataAndAliases --project server/FitMate.DB --startup-project server/FitMate.Web`
Expected: adds 4 nullable int columns on `Exercises`, creates `ExerciseAliases` table with the `NormalizedAlias` index and the unique `(ExerciseId, NormalizedAlias)` index. Inspect the generated file — no drops.

- [ ] **Step 10: Regenerate TS types**

Run: `dotnet build server/FitMate.Web/FitMate.Web.csproj` then `cd client && npm run process-types && npx tsc -b --noEmit`
Expected: `client/src/types/JsonModels/Enums/` now contains `ExerciseEquipment.ts`, `ExerciseMovementPattern.ts`, `ExerciseDifficulty.ts`, `ExerciseCategory.ts`; `ExerciseModel`/`ExerciseLookupModel`/`CreateExerciseRequest` include the new fields; tsc clean.

- [ ] **Step 11: Commit**

```bash
git add server client/src/types
git commit -m "feat(exercises): aliases with normalizer, alias search and metadata migration"
```

---

### Task 5: Frontend — metadata + aliases in the exercise editors

**Files:**
- Modify: `client/src/shared/components/exerciseFormValues.ts`, `client/src/shared/components/AddExerciseModal.tsx`
- Modify: `client/src/pages/AdminPanel/ExerciseGrid/hooks/useExerciseGridPage.ts`, `client/src/pages/AdminPanel/ExerciseGrid/ExerciseGrid.tsx`
- Modify: `client/src/pages/Profile/hooks/useMyExercisesPage.ts`, `client/src/pages/Profile/MyExercises.tsx`

**Interfaces:**
- Consumes: Task 4's regenerated types (`ExerciseEquipment` etc. enums, `aliases`/metadata fields on models).
- Produces: `AddExerciseModal` prop `showMetadataFields?: boolean`; extended `ExerciseFormValues`.

Decision (flagged for review): metadata + aliases are editable in the **admin grid AND My Exercises** editors — not admin-only. Reason: `UpdateAsync` overwrites metadata from the request, so a metadata-blind My Exercises editor would silently wipe values admins set on a user's exercise. The workout-builder ad-hoc modal (`ExerciseBuilder/ExerciseAddModal.tsx`) keeps the fields hidden (it already omits them from its payload, and omitted fields are `undefined` → `null` server-side, which is correct for brand-new ad-hoc exercises).

- [ ] **Step 1: Extend `exerciseFormValues.ts`:**

```ts
export type ExerciseFormValues = {
  name: string;
  slug: string;
  description: string;
  primaryMuscleGroupId: string;
  secondaryMuscleGroupId: string;
  isPublic: boolean;
  equipment: string;        // "" or numeric enum value as string
  movementPattern: string;
  difficulty: string;
  category: string;
  aliases: string[];
};

export const emptyExerciseFormValues: ExerciseFormValues = {
  name: "",
  slug: "",
  description: "",
  primaryMuscleGroupId: "",
  secondaryMuscleGroupId: "",
  isPublic: true,
  equipment: "",
  movementPattern: "",
  difficulty: "",
  category: "",
  aliases: [],
};
```

- [ ] **Step 2: Extend `AddExerciseModal.tsx`.** Imports and helpers at module scope:

```ts
import {
  ExerciseCategory,
  ExerciseDifficulty,
  ExerciseEquipment,
  ExerciseMovementPattern,
} from "@/types";
import { Dropdown } from "./Inputs";

function toEnumOptions(source: Record<string, string | number>): { label: string; value: string }[] {
  return Object.entries(source)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number")
    .map(([name, value]) => ({
      label: name.replace(/([a-z0-9])([A-Z])/g, "$1 $2"),
      value: String(value),
    }));
}

const equipmentOptions = toEnumOptions(ExerciseEquipment);
const movementPatternOptions = toEnumOptions(ExerciseMovementPattern);
const difficultyOptions = toEnumOptions(ExerciseDifficulty);
const categoryOptions = toEnumOptions(ExerciseCategory);
```

(Verify `Dropdown` is exported from `client/src/shared/components/Inputs/index.ts` at execution time; if not, export it there — the component exists at `Inputs/Dropdown.tsx`.)

Add prop `showMetadataFields?: boolean` (default `false`) alongside `showVisibilityToggle`. Add state:

```ts
  const [equipment, setEquipment] = useState(values.equipment);
  const [movementPattern, setMovementPattern] = useState(values.movementPattern);
  const [difficulty, setDifficulty] = useState(values.difficulty);
  const [category, setCategory] = useState(values.category);
  const [aliases, setAliases] = useState<string[]>(values.aliases);
  const [aliasDraft, setAliasDraft] = useState("");
```

`handleSave` passes them through:

```ts
  const handleSave = () => {
    onSubmit(
      {
        ...values,
        name,
        description,
        primaryMuscleGroupId,
        secondaryMuscleGroupId,
        isPublic,
        equipment,
        movementPattern,
        difficulty,
        category,
        aliases,
      },
      file ?? undefined,
    );
  };
```

Render block, inserted after the secondary muscle group dropdown, before the image section:

```tsx
        {showMetadataFields && (
          <>
            <Dropdown
              id="exercise-equipment"
              label="Equipment"
              value={equipment || null}
              onChange={(value) => setEquipment(value ?? "")}
              options={equipmentOptions}
              containerClassName={dropdownContainerClassName}
              labelClassName={labelClassName}
              placeholder="Not set"
              clearable
            />
            <Dropdown
              id="exercise-movement-pattern"
              label="Movement Pattern"
              value={movementPattern || null}
              onChange={(value) => setMovementPattern(value ?? "")}
              options={movementPatternOptions}
              containerClassName={dropdownContainerClassName}
              labelClassName={labelClassName}
              placeholder="Not set"
              clearable
            />
            <Dropdown
              id="exercise-difficulty"
              label="Difficulty"
              value={difficulty || null}
              onChange={(value) => setDifficulty(value ?? "")}
              options={difficultyOptions}
              containerClassName={dropdownContainerClassName}
              labelClassName={labelClassName}
              placeholder="Not set"
              clearable
            />
            <Dropdown
              id="exercise-category"
              label="Category"
              value={category || null}
              onChange={(value) => setCategory(value ?? "")}
              options={categoryOptions}
              containerClassName={dropdownContainerClassName}
              labelClassName={labelClassName}
              placeholder="Not set"
              clearable
            />
            <div className={`${fieldContainerClassName} md:col-span-2`}>
              <label htmlFor="exercise-aliases" className={labelClassName}>
                Aliases
              </label>
              {aliases.length > 0 && (
                <div className="flex flex-wrap gap-2 pb-2">
                  {aliases.map((alias) => (
                    <button
                      key={alias}
                      type="button"
                      className="liquid-pill rounded-full px-3 py-1 text-xs font-semibold"
                      onClick={() => setAliases((current) => current.filter((a) => a !== alias))}
                    >
                      {alias} ✕
                    </button>
                  ))}
                </div>
              )}
              <input
                id="exercise-aliases"
                value={aliasDraft}
                onChange={(event) => setAliasDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== ",") {
                    return;
                  }
                  event.preventDefault();
                  const alias = aliasDraft.trim().replace(/,+$/, "");
                  if (alias && !aliases.includes(alias)) {
                    setAliases((current) => [...current, alias]);
                  }
                  setAliasDraft("");
                }}
                className="liquid-input w-full rounded-full px-3 py-2.5"
                placeholder="Type an alias and press Enter (e.g. Military Press)"
              />
            </div>
          </>
        )}
```

- [ ] **Step 3: Map the new fields in both hooks.** In `useExerciseGridPage.ts`:

```ts
function toFormValues(item: Exercise): ExerciseFormValues {
  return {
    name: item.name,
    slug: item.slug,
    description: item.description ?? "",
    primaryMuscleGroupId: String(item.primaryMuscleGroupId),
    secondaryMuscleGroupId: item.secondaryMuscleGroupId ? String(item.secondaryMuscleGroupId) : "",
    isPublic: item.isPublic,
    equipment: item.equipment != null ? String(item.equipment) : "",
    movementPattern: item.movementPattern != null ? String(item.movementPattern) : "",
    difficulty: item.difficulty != null ? String(item.difficulty) : "",
    category: item.category != null ? String(item.category) : "",
    aliases: item.aliases ?? [],
  };
}

function toRequest(values: ExerciseFormValues): CreateExerciseRequest {
  return {
    name: values.name.trim(),
    slug: values.slug.trim(),
    description: values.description.trim() || undefined,
    primaryMuscleGroupId: Number(values.primaryMuscleGroupId),
    secondaryMuscleGroupId: values.secondaryMuscleGroupId
      ? Number(values.secondaryMuscleGroupId)
      : undefined,
    isPublic: values.isPublic,
    equipment: values.equipment ? (Number(values.equipment) as ExerciseEquipment) : undefined,
    movementPattern: values.movementPattern
      ? (Number(values.movementPattern) as ExerciseMovementPattern)
      : undefined,
    difficulty: values.difficulty ? (Number(values.difficulty) as ExerciseDifficulty) : undefined,
    category: values.category ? (Number(values.category) as ExerciseCategory) : undefined,
    aliases: values.aliases,
  };
}
```

(add the enum imports from `@/types`). Apply the identical `toFormValues`/`toRequest` shape in `useMyExercisesPage.ts` — its `toFormValues` takes `ExerciseLookup`, which now also carries `equipment`/`movementPattern`/`difficulty`/`category`/`aliases` (verify the exact source-model property names against the regenerated `client/src/types/JsonModels/Exercises/ExerciseLookupModel.ts` at execution time).

- [ ] **Step 4: Enable the fields** — pass `showMetadataFields` to `<AddExerciseModal ... />` in `ExerciseGrid.tsx` and `MyExercises.tsx` (leave `ExerciseBuilder/ExerciseAddModal.tsx` untouched).

- [ ] **Step 5: Lint + typecheck**

Run: `cd client && npm run lint && npx tsc -b --noEmit`
Expected: clean. Manually sanity-check: admin grid edit of an exercise with aliases shows the chips.

- [ ] **Step 6: Commit**

```bash
git add client/src
git commit -m "feat(exercises): metadata and alias editing in exercise editors"
```

---

### Task 6: `UserTrainingProfile` entity, enums, configuration, migration

**Files:**
- Create: `server/FitMate.DB/Enums/TrainingExperienceLevel.cs`, `server/FitMate.DB/Enums/WeightUnit.cs`
- Create (ONLY if missing — see Step 1): `server/FitMate.DB/Enums/TrainingGoal.cs`
- Create: `server/FitMate.DB/Entities/UserTrainingProfile.cs`, `server/FitMate.DB/Configurations/UserTrainingProfileConfiguration.cs`
- Modify: `server/FitMate.DB/AppDbContext.cs`
- Test: existing `server/FitMate.Tests/Unit/Database/AppDbContextTests.cs` must still pass (`EnsureCreated` validates the model)

**Interfaces:**
- Consumes: `BaseEntity`, `User`, Plan 01's `TrainingGoal`.
- Produces: the entity + enums below. Task 7, Plan 05 (`get_training_profile` tool, `ITrainingSnapshotService`) and Plan 07 read these exact property names.

- [ ] **Step 1: Enums** (namespace `FitMate.DB.Enums`, one file each):

```csharp
namespace FitMate.DB.Enums;

public enum TrainingExperienceLevel
{
    Beginner = 1,
    Intermediate = 2,
    Advanced = 3,
}

public enum WeightUnit
{
    Kg = 1,
    Lb = 2,
}
```

(No `WeightUnit`/unit-preference enum exists anywhere in the repo today — body metrics store `BodyWeightKg` only — so `WeightUnit` is created here.) `TrainingGoal`: check `server/FitMate.DB/Enums/TrainingGoal.cs` — if Plan 01 already merged it, do nothing; if absent, create it with **exactly** Plan 01 Task 1's members:

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
```

- [ ] **Step 2: Entity** (`server/FitMate.DB/Entities/UserTrainingProfile.cs`):

```csharp
using FitMate.DB.Entities.Base;
using FitMate.DB.Enums;

namespace FitMate.DB.Entities;

public class UserTrainingProfile : BaseEntity
{
    public long UserId { get; set; }
    public TrainingGoal Goal { get; set; }
    public TrainingExperienceLevel ExperienceLevel { get; set; }
    public int PreferredTrainingDaysPerWeek { get; set; }
    public int? PreferredWorkoutDurationMinutes { get; set; }
    public WeightUnit WeightUnit { get; set; } = WeightUnit.Kg;
    public string? AvailableEquipmentJson { get; set; }      // jsonb: string[] of equipment names
    public string? PreferredTrainingDaysJson { get; set; }   // jsonb: DayOfWeek[] (0 = Sunday)
    public string? ExerciseRestrictions { get; set; }
    public string? AdditionalPreferences { get; set; }
    public bool AllowAiPersonalization { get; set; } = true;
    public DateTime UpdatedAt { get; set; }                  // spec §9 field; DateModified also tracks this (REVIEW)

    public User User { get; set; } = null!;
}
```

- [ ] **Step 3: Configuration** (`server/FitMate.DB/Configurations/UserTrainingProfileConfiguration.cs`):

```csharp
using FitMate.DB.Configurations.Base;
using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

internal class UserTrainingProfileConfiguration : BaseConfiguration<UserTrainingProfile>
{
    public override void Configure(EntityTypeBuilder<UserTrainingProfile> builder)
    {
        base.Configure(builder);

        // jsonb on Npgsql; Sqlite tests store the same string with TEXT affinity.
        builder.Property(x => x.AvailableEquipmentJson).HasColumnType("jsonb");
        builder.Property(x => x.PreferredTrainingDaysJson).HasColumnType("jsonb");
        builder.Property(x => x.ExerciseRestrictions).HasMaxLength(2000);
        builder.Property(x => x.AdditionalPreferences).HasMaxLength(2000);

        builder.HasIndex(x => x.UserId).IsUnique();   // one profile per user

        builder.HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
```

In `AppDbContext.cs` add after the `PersonalRecords` DbSet:

```csharp
    public DbSet<UserTrainingProfile> UserTrainingProfiles => Set<UserTrainingProfile>();
```

- [ ] **Step 4: Build + existing model tests**

Run: `dotnet build server/FitMate.sln` then `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter AppDbContextTests`
Expected: PASS.

- [ ] **Step 5: Migration**

Run: `dotnet ef migrations add AddUserTrainingProfile --project server/FitMate.DB --startup-project server/FitMate.Web`
Expected: one new `UserTrainingProfiles` table, `AvailableEquipmentJson`/`PreferredTrainingDaysJson` columns typed `jsonb`, unique index on `UserId`. Inspect the file — no drops.

- [ ] **Step 6: Commit**

```bash
git add server/FitMate.DB
git commit -m "feat(training-profile): UserTrainingProfile entity, enums and migration"
```

---

### Task 7: Training profile DTOs, service (TDD), controller, DI, type export

**Files:**
- Create: `server/FitMate.Core/JsonModels/TrainingProfiles/TrainingProfileModel.cs`, `SaveTrainingProfileRequest.cs`
- Create: `server/FitMate.Services/TrainingProfiles/ITrainingProfileService.cs`, `TrainingProfileService.cs`
- Create: `server/FitMate.Web/Controllers/TrainingProfileController.cs`
- Modify: `server/FitMate.Web/Program.cs` (1 DI line)
- Test: `server/FitMate.Tests/Unit/Services/TrainingProfileServiceTests.cs`

**Interfaces:**
- Consumes: Task 6 entity/enums.
- Produces (Plan 05's `get_training_profile` tool and Task 8's frontend rely on these exact names):

```csharp
public interface ITrainingProfileService
{
    Task<TrainingProfileModel?> GetAsync(long userId);                                // null until first save
    Task<TrainingProfileModel> SaveAsync(SaveTrainingProfileRequest request, long userId); // upsert
}
```

HTTP surface:

```
GET /api/training-profile   → TrainingProfileModel | null (data: null until first save)
PUT /api/training-profile   → TrainingProfileModel        (upsert; body: SaveTrainingProfileRequest)
```

- [ ] **Step 1: DTOs** (namespace `FitMate.Core.JsonModels.TrainingProfiles`; lists cross the wire as typed lists — the service owns JSON (de)serialization to the jsonb columns):

```csharp
using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.TrainingProfiles;

public class SaveTrainingProfileRequest
{
    public TrainingGoal Goal { get; set; }
    public TrainingExperienceLevel ExperienceLevel { get; set; }
    public int PreferredTrainingDaysPerWeek { get; set; }
    public int? PreferredWorkoutDurationMinutes { get; set; }
    public WeightUnit WeightUnit { get; set; } = WeightUnit.Kg;
    public List<string> AvailableEquipment { get; set; } = [];
    public List<DayOfWeek> PreferredTrainingDays { get; set; } = [];
    public string? ExerciseRestrictions { get; set; }
    public string? AdditionalPreferences { get; set; }
    public bool AllowAiPersonalization { get; set; } = true;
}
```

```csharp
using FitMate.DB.Enums;

namespace FitMate.Core.JsonModels.TrainingProfiles;

public class TrainingProfileModel
{
    public TrainingGoal Goal { get; set; }
    public TrainingExperienceLevel ExperienceLevel { get; set; }
    public int PreferredTrainingDaysPerWeek { get; set; }
    public int? PreferredWorkoutDurationMinutes { get; set; }
    public WeightUnit WeightUnit { get; set; }
    public List<string> AvailableEquipment { get; set; } = [];
    public List<DayOfWeek> PreferredTrainingDays { get; set; } = [];
    public string? ExerciseRestrictions { get; set; }
    public string? AdditionalPreferences { get; set; }
    public bool AllowAiPersonalization { get; set; }
    public DateTime UpdatedAt { get; set; }
}
```

- [ ] **Step 2: Write failing tests** (`TrainingProfileServiceTests.cs`):

```csharp
using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.TrainingProfiles;
using FitMate.DB.Enums;
using FitMate.Services.TrainingProfiles;
using FitMate.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Tests.Unit.Services;

public class TrainingProfileServiceTests
{
    private static SaveTrainingProfileRequest NewRequest() => new()
    {
        Goal = TrainingGoal.Hypertrophy,
        ExperienceLevel = TrainingExperienceLevel.Intermediate,
        PreferredTrainingDaysPerWeek = 4,
        PreferredWorkoutDurationMinutes = 60,
        WeightUnit = WeightUnit.Kg,
        AvailableEquipment = ["Barbell", "Dumbbell"],
        PreferredTrainingDays = [DayOfWeek.Monday, DayOfWeek.Thursday],
        ExerciseRestrictions = "No overhead pressing",
        AllowAiPersonalization = true,
    };

    // GET без запазен профил връща null
    [Fact]
    public async Task GetAsync_NoProfile_ReturnsNull()
    {
        using var db = new SqliteTestDatabase();
        using var context = db.CreateContext();
        var service = new TrainingProfileService(context);

        Assert.Null(await service.GetAsync(SqliteTestDatabase.UserId));
    }

    // Save създава профил и GET го връща с десериализирани списъци
    [Fact]
    public async Task SaveAsync_CreatesProfile_AndGetRoundtripsLists()
    {
        using var db = new SqliteTestDatabase();
        using var context = db.CreateContext();
        var service = new TrainingProfileService(context);

        await service.SaveAsync(NewRequest(), SqliteTestDatabase.UserId);
        var model = await service.GetAsync(SqliteTestDatabase.UserId);

        Assert.NotNull(model);
        Assert.Equal(TrainingGoal.Hypertrophy, model!.Goal);
        Assert.Equal(4, model.PreferredTrainingDaysPerWeek);
        Assert.Equal(["Barbell", "Dumbbell"], model.AvailableEquipment);
        Assert.Equal([DayOfWeek.Monday, DayOfWeek.Thursday], model.PreferredTrainingDays);
        Assert.Equal("No overhead pressing", model.ExerciseRestrictions);
    }

    // Повторен Save обновява същия ред (upsert, не дублира)
    [Fact]
    public async Task SaveAsync_Twice_UpdatesSingleRow()
    {
        using var db = new SqliteTestDatabase();
        using var context = db.CreateContext();
        var service = new TrainingProfileService(context);
        await service.SaveAsync(NewRequest(), SqliteTestDatabase.UserId);

        var update = NewRequest();
        update.Goal = TrainingGoal.Strength;
        update.AvailableEquipment = [];
        var model = await service.SaveAsync(update, SqliteTestDatabase.UserId);

        Assert.Equal(TrainingGoal.Strength, model.Goal);
        Assert.Empty(model.AvailableEquipment);
        Assert.Equal(1, await context.UserTrainingProfiles.CountAsync());
    }

    // Профилите са по един на потребител, но различни потребители имат отделни
    [Fact]
    public async Task SaveAsync_TwoUsers_TwoIndependentProfiles()
    {
        using var db = new SqliteTestDatabase();
        using var context = db.CreateContext();
        var service = new TrainingProfileService(context);

        await service.SaveAsync(NewRequest(), SqliteTestDatabase.UserId);
        var other = NewRequest();
        other.Goal = TrainingGoal.FatLoss;
        await service.SaveAsync(other, SqliteTestDatabase.OtherUserId);

        Assert.Equal(2, await context.UserTrainingProfiles.CountAsync());
        Assert.Equal(TrainingGoal.FatLoss, (await service.GetAsync(SqliteTestDatabase.OtherUserId))!.Goal);
        Assert.Equal(TrainingGoal.Hypertrophy, (await service.GetAsync(SqliteTestDatabase.UserId))!.Goal);
    }

    // Валидация на дни/седмица и продължителност
    [Theory]
    [InlineData(0)]
    [InlineData(8)]
    public async Task SaveAsync_DaysPerWeekOutOfRange_Throws(int days)
    {
        using var db = new SqliteTestDatabase();
        using var context = db.CreateContext();
        var service = new TrainingProfileService(context);
        var request = NewRequest();
        request.PreferredTrainingDaysPerWeek = days;

        await Assert.ThrowsAsync<FitMateException>(() => service.SaveAsync(request, SqliteTestDatabase.UserId));
    }

    [Fact]
    public async Task SaveAsync_InvalidDuration_Throws()
    {
        using var db = new SqliteTestDatabase();
        using var context = db.CreateContext();
        var service = new TrainingProfileService(context);
        var request = NewRequest();
        request.PreferredWorkoutDurationMinutes = 5;

        await Assert.ThrowsAsync<FitMateException>(() => service.SaveAsync(request, SqliteTestDatabase.UserId));
    }
}
```

- [ ] **Step 3: Run — expect FAIL** (`TrainingProfileService` missing)

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter TrainingProfileServiceTests`

- [ ] **Step 4: Implement** — `ITrainingProfileService.cs` as in the Interfaces block; `TrainingProfileService.cs`:

```csharp
using System.Text.Json;
using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.TrainingProfiles;
using FitMate.DB;
using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.TrainingProfiles;

public class TrainingProfileService : ITrainingProfileService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly AppDbContext dbContext;

    public TrainingProfileService(AppDbContext dbContext)
    {
        this.dbContext = dbContext;
    }

    public async Task<TrainingProfileModel?> GetAsync(long userId)
    {
        var profile = await dbContext.UserTrainingProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.UserId == userId);

        return profile == null ? null : ToModel(profile);
    }

    public async Task<TrainingProfileModel> SaveAsync(SaveTrainingProfileRequest request, long userId)
    {
        Validate(request);

        var profile = await dbContext.UserTrainingProfiles
            .FirstOrDefaultAsync(x => x.UserId == userId);

        if (profile == null)
        {
            profile = new UserTrainingProfile { UserId = userId };
            dbContext.UserTrainingProfiles.Add(profile);
        }

        var equipment = request.AvailableEquipment
            .Select(e => (e ?? string.Empty).Trim())
            .Where(e => e.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        var trainingDays = request.PreferredTrainingDays.Distinct().OrderBy(d => d).ToList();

        profile.Goal = request.Goal;
        profile.ExperienceLevel = request.ExperienceLevel;
        profile.PreferredTrainingDaysPerWeek = request.PreferredTrainingDaysPerWeek;
        profile.PreferredWorkoutDurationMinutes = request.PreferredWorkoutDurationMinutes;
        profile.WeightUnit = request.WeightUnit;
        profile.AvailableEquipmentJson = SerializeList(equipment);
        profile.PreferredTrainingDaysJson = SerializeList(trainingDays);
        profile.ExerciseRestrictions = NormalizeText(request.ExerciseRestrictions);
        profile.AdditionalPreferences = NormalizeText(request.AdditionalPreferences);
        profile.AllowAiPersonalization = request.AllowAiPersonalization;
        profile.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync();
        return ToModel(profile);
    }

    private static void Validate(SaveTrainingProfileRequest request)
    {
        if (!Enum.IsDefined(request.Goal))
        {
            throw new FitMateException("Invalid training goal.");
        }

        if (!Enum.IsDefined(request.ExperienceLevel))
        {
            throw new FitMateException("Invalid experience level.");
        }

        if (!Enum.IsDefined(request.WeightUnit))
        {
            throw new FitMateException("Invalid weight unit.");
        }

        if (request.PreferredTrainingDaysPerWeek is < 1 or > 7)
        {
            throw new FitMateException("Preferred training days per week must be between 1 and 7.");
        }

        if (request.PreferredWorkoutDurationMinutes is < 10 or > 600)
        {
            throw new FitMateException("Preferred workout duration must be between 10 and 600 minutes.");
        }

        if (request.AvailableEquipment.Count > 30
            || request.AvailableEquipment.Any(e => (e ?? string.Empty).Trim().Length > 100))
        {
            throw new FitMateException("Available equipment list is invalid.");
        }

        if (request.PreferredTrainingDays.Any(d => !Enum.IsDefined(d)))
        {
            throw new FitMateException("Preferred training days contain an invalid weekday.");
        }
    }

    private static string? SerializeList<T>(List<T> values) =>
        values.Count == 0 ? null : JsonSerializer.Serialize(values, JsonOptions);

    private static List<T> DeserializeList<T>(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return [];
        }

        try
        {
            return JsonSerializer.Deserialize<List<T>>(json, JsonOptions) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    private static string? NormalizeText(string? value)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed))
        {
            return null;
        }

        return trimmed.Length > 2000 ? trimmed[..2000] : trimmed;
    }

    private static TrainingProfileModel ToModel(UserTrainingProfile profile) => new()
    {
        Goal = profile.Goal,
        ExperienceLevel = profile.ExperienceLevel,
        PreferredTrainingDaysPerWeek = profile.PreferredTrainingDaysPerWeek,
        PreferredWorkoutDurationMinutes = profile.PreferredWorkoutDurationMinutes,
        WeightUnit = profile.WeightUnit,
        AvailableEquipment = DeserializeList<string>(profile.AvailableEquipmentJson),
        PreferredTrainingDays = DeserializeList<DayOfWeek>(profile.PreferredTrainingDaysJson),
        ExerciseRestrictions = profile.ExerciseRestrictions,
        AdditionalPreferences = profile.AdditionalPreferences,
        AllowAiPersonalization = profile.AllowAiPersonalization,
        UpdatedAt = profile.UpdatedAt,
    };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter TrainingProfileServiceTests`
Expected: PASS (7 tests).

- [ ] **Step 6: Controller + DI** — `server/FitMate.Web/Controllers/TrainingProfileController.cs`:

```csharp
using FitMate.Core.JsonModels.TrainingProfiles;
using FitMate.DB;
using FitMate.Services.TrainingProfiles;
using FitMate.Services.Users;
using FitMate.Web.Controllers.Base;
using FitMate.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FitMate.Web.Controllers;

[Authorize]
[Route("api/training-profile")]
public class TrainingProfileController : BaseApiController
{
    private readonly ITrainingProfileService trainingProfileService;

    public TrainingProfileController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService,
        ITrainingProfileService trainingProfileService)
        : base(logger, dbContext, userService)
    {
        this.trainingProfileService = trainingProfileService;
    }

    [HttpGet]
    public async Task<ActionResult> Get()
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var model = await trainingProfileService.GetAsync(userId.Value);
        return this.ReturnJson(model);
    }

    [HttpPut]
    public async Task<ActionResult> Save([FromBody] SaveTrainingProfileRequest request)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var model = await trainingProfileService.SaveAsync(request, userId.Value);
        return this.ReturnJson(model);
    }
}
```

(Verify `this.ReturnJson(...)` accepts a null model — check `server/FitMate.Web/Extensions` at execution time; if it rejects null, return `this.ReturnJson<TrainingProfileModel?>(model)` or an explicit success envelope with null data the same way other nullable-returning endpoints do.) In `Program.cs` add after the `IBodyMetricService` line:

```csharp
builder.Services.AddScoped<ITrainingProfileService, TrainingProfileService>();
```

with `using FitMate.Services.TrainingProfiles;` at the top.

- [ ] **Step 7: Build, full suite, regenerate types**

Run: `dotnet build server/FitMate.sln && dotnet test server/FitMate.sln`
Then: `dotnet build server/FitMate.Web/FitMate.Web.csproj` and `cd client && npm run process-types && npx tsc -b --noEmit`
Expected: `client/src/types/JsonModels/TrainingProfiles/` contains `TrainingProfileModel.ts` and `SaveTrainingProfileRequest.ts`; `Enums/` contains `TrainingGoal`, `TrainingExperienceLevel`, `WeightUnit`, `DayOfWeek`. (If Reinforced.Typings fails to export `System.DayOfWeek`, change `PreferredTrainingDays` to `List<int>` (0 = Sunday) in both DTOs and note it — do not hand-write a TS enum.)

- [ ] **Step 8: Commit**

```bash
git add server client/src/types
git commit -m "feat(training-profile): service, GET/PUT api/training-profile and generated types"
```

---

### Task 8: Frontend — Training section on the Profile page

**Files:**
- Create: `client/src/services/trainingProfileService.ts`, `client/src/pages/Profile/TrainingProfile.tsx`, `client/src/pages/Profile/hooks/useTrainingProfilePage.ts`
- Modify: `client/src/pages/Profile/Profile.tsx`, `client/src/pages/Profile/index.ts`, `client/src/routes.tsx`

**Interfaces:**
- Consumes: Task 7's generated types + endpoints; existing `PrimaryButton`, `Dropdown`, `SegmentControl`, `TextareaField` components; `liquid-*` utility classes.
- Produces: `/profile/training` route.

- [ ] **Step 1: Service** (`client/src/services/trainingProfileService.ts` — generated types only):

```ts
import api from "@/lib/api";
import type { JsonData, SaveTrainingProfileRequest, TrainingProfileModel } from "@/types";

export const trainingProfileService = {
  async get() {
    return api.get<JsonData<TrainingProfileModel | null>>("training-profile");
  },

  async save(payload: SaveTrainingProfileRequest) {
    return api.put<JsonData<TrainingProfileModel>>("training-profile", payload);
  },
};
```

(If `npm run process-types` emitted an alias `TrainingProfile` for `TrainingProfileModel`, either name works — the tool auto-aliases `*Model` types; use whichever `tsc` resolves.)

- [ ] **Step 2: Hook** (`client/src/pages/Profile/hooks/useTrainingProfilePage.ts`):

```ts
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { unwrap } from "@/lib/unwrap";
import { trainingProfileService } from "@/services/trainingProfileService";
import {
  DayOfWeek,
  TrainingExperienceLevel,
  TrainingGoal,
  WeightUnit,
  type SaveTrainingProfileRequest,
  type TrainingProfileModel,
} from "@/types";

export type TrainingProfileFormValues = {
  goal: TrainingGoal;
  experienceLevel: TrainingExperienceLevel;
  preferredTrainingDaysPerWeek: number;
  preferredWorkoutDurationMinutes: string;
  weightUnit: WeightUnit;
  availableEquipment: string[];
  preferredTrainingDays: DayOfWeek[];
  exerciseRestrictions: string;
  additionalPreferences: string;
  allowAiPersonalization: boolean;
};

const defaultFormValues: TrainingProfileFormValues = {
  goal: TrainingGoal.GeneralFitness,
  experienceLevel: TrainingExperienceLevel.Beginner,
  preferredTrainingDaysPerWeek: 3,
  preferredWorkoutDurationMinutes: "",
  weightUnit: WeightUnit.Kg,
  availableEquipment: [],
  preferredTrainingDays: [],
  exerciseRestrictions: "",
  additionalPreferences: "",
  allowAiPersonalization: true,
};

function toFormValues(model: TrainingProfileModel): TrainingProfileFormValues {
  return {
    goal: model.goal,
    experienceLevel: model.experienceLevel,
    preferredTrainingDaysPerWeek: model.preferredTrainingDaysPerWeek,
    preferredWorkoutDurationMinutes:
      model.preferredWorkoutDurationMinutes != null ? String(model.preferredWorkoutDurationMinutes) : "",
    weightUnit: model.weightUnit,
    availableEquipment: model.availableEquipment ?? [],
    preferredTrainingDays: model.preferredTrainingDays ?? [],
    exerciseRestrictions: model.exerciseRestrictions ?? "",
    additionalPreferences: model.additionalPreferences ?? "",
    allowAiPersonalization: model.allowAiPersonalization,
  };
}

function toRequest(values: TrainingProfileFormValues): SaveTrainingProfileRequest {
  return {
    goal: values.goal,
    experienceLevel: values.experienceLevel,
    preferredTrainingDaysPerWeek: values.preferredTrainingDaysPerWeek,
    preferredWorkoutDurationMinutes: values.preferredWorkoutDurationMinutes
      ? Number(values.preferredWorkoutDurationMinutes)
      : undefined,
    weightUnit: values.weightUnit,
    availableEquipment: values.availableEquipment,
    preferredTrainingDays: values.preferredTrainingDays,
    exerciseRestrictions: values.exerciseRestrictions.trim() || undefined,
    additionalPreferences: values.additionalPreferences.trim() || undefined,
    allowAiPersonalization: values.allowAiPersonalization,
  };
}

export function useTrainingProfilePage() {
  const [formValues, setFormValues] = useState<TrainingProfileFormValues>(defaultFormValues);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function load() {
      try {
        const response = await trainingProfileService.get();
        const model = response.data.success ? response.data.data ?? null : null;
        if (!isCancelled && model) {
          setFormValues(toFormValues(model));
        }
      } catch (loadError) {
        if (!isCancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load training profile.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => {
      isCancelled = true;
    };
  }, []);

  const setField = useCallback(
    <K extends keyof TrainingProfileFormValues>(field: K, value: TrainingProfileFormValues[K]) => {
      setSuccessMessage(null);
      setFormValues((current) => ({ ...current, [field]: value }));
    },
    [],
  );

  const toggleEquipment = useCallback((name: string) => {
    setSuccessMessage(null);
    setFormValues((current) => ({
      ...current,
      availableEquipment: current.availableEquipment.includes(name)
        ? current.availableEquipment.filter((item) => item !== name)
        : [...current.availableEquipment, name],
    }));
  }, []);

  const toggleTrainingDay = useCallback((day: DayOfWeek) => {
    setSuccessMessage(null);
    setFormValues((current) => ({
      ...current,
      preferredTrainingDays: current.preferredTrainingDays.includes(day)
        ? current.preferredTrainingDays.filter((item) => item !== day)
        : [...current.preferredTrainingDays, day],
    }));
  }, []);

  const save = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);
      setSuccessMessage(null);
      setIsSaving(true);

      try {
        const response = await trainingProfileService.save(toRequest(formValues));
        setFormValues(toFormValues(unwrap(response.data, "Unable to save training profile.")));
        setSuccessMessage("Training profile saved.");
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Unable to save training profile.");
      } finally {
        setIsSaving(false);
      }
    },
    [formValues],
  );

  const state = useMemo(
    () => ({ formValues, isLoading, isSaving, error, successMessage }),
    [formValues, isLoading, isSaving, error, successMessage],
  );

  const actions = useMemo(
    () => ({ setField, toggleEquipment, toggleTrainingDay, save }),
    [setField, toggleEquipment, toggleTrainingDay, save],
  );

  return { state, actions };
}
```

- [ ] **Step 3: Page component** (`client/src/pages/Profile/TrainingProfile.tsx`):

```tsx
import { PrimaryButton } from "@/shared/components/Buttons";
import { Dropdown, SegmentControl, TextareaField } from "@/shared/components/Inputs";
import { SegmentControlSize } from "@/shared/components/Inputs/SegmentControlSize";
import {
  DayOfWeek,
  ExerciseEquipment,
  TrainingExperienceLevel,
  TrainingGoal,
  WeightUnit,
} from "@/types";
import { useTrainingProfilePage } from "./hooks/useTrainingProfilePage";

function humanize(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

function enumOptions<T extends number>(source: Record<string, string | number>) {
  return Object.entries(source)
    .filter((entry): entry is [string, T] => typeof entry[1] === "number")
    .map(([name, value]) => ({ label: humanize(name), value }));
}

const goalOptions = enumOptions<TrainingGoal>(TrainingGoal);
const experienceOptions = enumOptions<TrainingExperienceLevel>(TrainingExperienceLevel);
const weightUnitOptions = [
  { label: "Kg", value: WeightUnit.Kg },
  { label: "Lb", value: WeightUnit.Lb },
] as const;
const equipmentOptions = Object.entries(ExerciseEquipment)
  .filter((entry): entry is [string, number] => typeof entry[1] === "number")
  .map(([name]) => name);
const weekdayOptions = [
  { label: "Mon", value: DayOfWeek.Monday },
  { label: "Tue", value: DayOfWeek.Tuesday },
  { label: "Wed", value: DayOfWeek.Wednesday },
  { label: "Thu", value: DayOfWeek.Thursday },
  { label: "Fri", value: DayOfWeek.Friday },
  { label: "Sat", value: DayOfWeek.Saturday },
  { label: "Sun", value: DayOfWeek.Sunday },
] as const;
const aiOptions = [
  { label: "Enabled", value: true },
  { label: "Disabled", value: false },
] as const;

const labelClassName = "block pb-1.5 text-xs font-semibold uppercase tracking-widest text-primary";

type ChipProps = { label: string; selected: boolean; onToggle: () => void };

function Chip({ label, selected, onToggle }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
        selected ? "liquid-primary-btn" : "liquid-pill"
      }`}
    >
      {label}
    </button>
  );
}

export default function TrainingProfile() {
  const { state, actions } = useTrainingProfilePage();
  const { formValues } = state;

  if (state.isLoading) {
    return <div className="liquid-panel rounded-2xl p-6 text-sm text-secondary">Loading…</div>;
  }

  return (
    <form className="liquid-panel space-y-6 rounded-2xl p-5 md:p-6" onSubmit={actions.save}>
      <div>
        <h2 className="text-xl font-bold text-foreground">Training Profile</h2>
        <p className="pt-1 text-sm text-secondary">
          Used to personalize programs and AI coaching suggestions.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Dropdown
          id="training-goal"
          label="Goal"
          value={formValues.goal}
          onChange={(value) => actions.setField("goal", value ?? TrainingGoal.GeneralFitness)}
          options={goalOptions}
          labelClassName={labelClassName}
        />
        <Dropdown
          id="training-experience"
          label="Experience Level"
          value={formValues.experienceLevel}
          onChange={(value) =>
            actions.setField("experienceLevel", value ?? TrainingExperienceLevel.Beginner)
          }
          options={experienceOptions}
          labelClassName={labelClassName}
        />

        <div>
          <p className={labelClassName}>Training Days Per Week</p>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((count) => (
              <Chip
                key={count}
                label={String(count)}
                selected={formValues.preferredTrainingDaysPerWeek === count}
                onToggle={() => actions.setField("preferredTrainingDaysPerWeek", count)}
              />
            ))}
          </div>
        </div>

        <div>
          <label className={labelClassName} htmlFor="training-duration">
            Preferred Workout Duration (minutes)
          </label>
          <input
            id="training-duration"
            type="number"
            min={10}
            max={600}
            value={formValues.preferredWorkoutDurationMinutes}
            onChange={(event) =>
              actions.setField("preferredWorkoutDurationMinutes", event.target.value)
            }
            className="liquid-input w-full rounded-full px-3 py-2.5"
            placeholder="e.g. 60"
          />
        </div>

        <div>
          <p className={labelClassName}>Weight Unit</p>
          <SegmentControl<WeightUnit>
            id="training-weight-unit"
            value={formValues.weightUnit}
            onChange={(value) => actions.setField("weightUnit", value)}
            options={weightUnitOptions}
            size={SegmentControlSize.Md}
            className="w-full"
          />
        </div>

        <div>
          <p className={labelClassName}>AI Personalization</p>
          <SegmentControl<boolean>
            id="training-ai-personalization"
            value={formValues.allowAiPersonalization}
            onChange={(value) => actions.setField("allowAiPersonalization", value)}
            options={aiOptions}
            size={SegmentControlSize.Md}
            className="w-full"
          />
        </div>

        <div className="md:col-span-2">
          <p className={labelClassName}>Preferred Training Days</p>
          <div className="flex flex-wrap gap-2">
            {weekdayOptions.map((day) => (
              <Chip
                key={day.value}
                label={day.label}
                selected={formValues.preferredTrainingDays.includes(day.value)}
                onToggle={() => actions.toggleTrainingDay(day.value)}
              />
            ))}
          </div>
        </div>

        <div className="md:col-span-2">
          <p className={labelClassName}>Available Equipment</p>
          <div className="flex flex-wrap gap-2">
            {equipmentOptions.map((name) => (
              <Chip
                key={name}
                label={humanize(name)}
                selected={formValues.availableEquipment.includes(name)}
                onToggle={() => actions.toggleEquipment(name)}
              />
            ))}
          </div>
        </div>

        <TextareaField
          id="training-restrictions"
          label="Exercise Restrictions / Injuries"
          containerClassName="md:col-span-2 space-y-1.5 text-sm font-medium text-foreground"
          labelClassName={labelClassName}
          value={formValues.exerciseRestrictions}
          onChange={(event) => actions.setField("exerciseRestrictions", event.target.value)}
        />
        <TextareaField
          id="training-preferences"
          label="Additional Preferences"
          containerClassName="md:col-span-2 space-y-1.5 text-sm font-medium text-foreground"
          labelClassName={labelClassName}
          value={formValues.additionalPreferences}
          onChange={(event) => actions.setField("additionalPreferences", event.target.value)}
        />
      </div>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state.successMessage ? <p className="text-sm text-success">{state.successMessage}</p> : null}

      <div className="flex justify-end">
        <PrimaryButton type="submit" disabled={state.isSaving} className="w-full md:w-auto">
          {state.isSaving ? "Saving..." : "Save Training Profile"}
        </PrimaryButton>
      </div>
    </form>
  );
}
```

(Verify `SegmentControl`'s generic prop names against `Inputs/SegmentControl.tsx` at execution time — `AddExerciseModal` shows the working `<SegmentControl<boolean> ... options={...}>` usage; mirror it. Same for `Dropdown` numeric values: its `TValue extends string | number` supports enum numbers directly.)

- [ ] **Step 4: Wire nav + route.** `client/src/pages/Profile/index.ts`:

```ts
export { default } from "./Profile";
export { default as ProfileAccount } from "./ProfileAccount";
export { default as MyExercises } from "./MyExercises";
export { default as TrainingProfile } from "./TrainingProfile";
```

`Profile.tsx` — extend the import to `import { LuDumbbell, LuTarget, LuUserRound } from "react-icons/lu";` and add to `profileNavItems` (between Account and My Exercises):

```ts
  {
    label: "Training",
    to: "training",
    icon: LuTarget,
    end: false,
  },
```

`routes.tsx` — extend the Profile import to `import Profile, { ProfileAccount, MyExercises, TrainingProfile } from "./pages/Profile";` and add to the profile `children` array:

```tsx
          {
            path: "training",
            element: <TrainingProfile />,
          },
```

- [ ] **Step 5: Lint + typecheck**

Run: `cd client && npm run lint && npx tsc -b --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add client/src
git commit -m "feat(training-profile): Profile page Training section with equipment and weekday chips"
```

---

### Task 9: Integration smoke tests (ownership + training profile over HTTP)

**Files:**
- Create: `server/FitMate.Tests/Integration/ExerciseOwnershipApiTests.cs`, `server/FitMate.Tests/Integration/TrainingProfileApiTests.cs`

**Interfaces:** consumes `TestWebApplicationFactory` (`CreateApiClient`, `CreateUserClientAsync(email)`, `CreateAdminClientAsync()` — verify exact helper names against `AuthorizationApiTests.cs` / `IntegrationTestExtensions` at execution time; the first two are used verbatim in `AuthorizationApiTests.cs`). The factory seeds no muscle groups, so tests seed their own via `factory.Services`.

- [ ] **Step 1: Write the ownership tests:**

```csharp
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.Tests.TestInfrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace FitMate.Tests.Integration;

public class ExerciseOwnershipApiTests
{
    private static async Task<long> SeedMuscleGroupAsync(TestWebApplicationFactory factory)
    {
        using var scope = factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var muscleGroup = new MuscleGroup { Name = $"Chest-{Guid.NewGuid():N}" };
        dbContext.MuscleGroups.Add(muscleGroup);
        await dbContext.SaveChangesAsync();
        return muscleGroup.Id;
    }

    private static object NewExercisePayload(long muscleGroupId) => new
    {
        name = $"Exercise {Guid.NewGuid():N}",
        primaryMuscleGroupId = muscleGroupId,
        isPublic = false,
    };

    // Обикновен потребител не може да ползва глобалния admin endpoint
    [Fact]
    public async Task AdminCreate_AsNonAdmin_Returns403()
    {
        using var factory = new TestWebApplicationFactory();
        var muscleGroupId = await SeedMuscleGroupAsync(factory);
        var client = await factory.CreateUserClientAsync("owner-nonadmin@test.local");

        var response = await client.PostAsJsonAsync("/api/admin/exercises", NewExercisePayload(muscleGroupId));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // Admin през admin endpoint-а създава глобално (userId null, публично)
    [Fact]
    public async Task AdminCreate_AsAdmin_CreatesGlobalPublicExercise()
    {
        using var factory = new TestWebApplicationFactory();
        var muscleGroupId = await SeedMuscleGroupAsync(factory);
        var client = await factory.CreateAdminClientAsync();

        var response = await client.PostAsJsonAsync("/api/admin/exercises", NewExercisePayload(muscleGroupId));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var data = json.RootElement.GetProperty("data");
        Assert.Equal(JsonValueKind.Null, data.GetProperty("userId").ValueKind);
        Assert.True(data.GetProperty("isPublic").GetBoolean());
    }

    // Admin през общия endpoint създава ЛИЧНО упражнение (фиксът от Task 1, през HTTP)
    [Fact]
    public async Task UserCreate_AsAdmin_CreatesPersonalExercise()
    {
        using var factory = new TestWebApplicationFactory();
        var muscleGroupId = await SeedMuscleGroupAsync(factory);
        var client = await factory.CreateAdminClientAsync();

        var response = await client.PostAsJsonAsync("/api/exercises", NewExercisePayload(muscleGroupId));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var data = json.RootElement.GetProperty("data");
        Assert.NotEqual(JsonValueKind.Null, data.GetProperty("userId").ValueKind);
        Assert.False(data.GetProperty("isPublic").GetBoolean());
    }
}
```

- [ ] **Step 2: Write the training profile tests:**

```csharp
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FitMate.Tests.TestInfrastructure;

namespace FitMate.Tests.Integration;

public class TrainingProfileApiTests
{
    // Без логин връща 401
    [Fact]
    public async Task Get_WithoutAuth_Returns401()
    {
        using var factory = new TestWebApplicationFactory();
        var client = factory.CreateApiClient();

        var response = await client.GetAsync("/api/training-profile");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // PUT записва, GET връща същите стойности
    [Fact]
    public async Task PutThenGet_RoundtripsProfile()
    {
        using var factory = new TestWebApplicationFactory();
        var client = await factory.CreateUserClientAsync("profile-user@test.local");

        var putResponse = await client.PutAsJsonAsync("/api/training-profile", new
        {
            goal = 2,                       // TrainingGoal.Hypertrophy
            experienceLevel = 2,            // Intermediate
            preferredTrainingDaysPerWeek = 4,
            preferredWorkoutDurationMinutes = 60,
            weightUnit = 1,                 // Kg
            availableEquipment = new[] { "Barbell", "Dumbbell" },
            preferredTrainingDays = new[] { 1, 4 },   // Monday, Thursday
            exerciseRestrictions = "No overhead pressing",
            allowAiPersonalization = true,
        });
        Assert.Equal(HttpStatusCode.OK, putResponse.StatusCode);

        var getResponse = await client.GetAsync("/api/training-profile");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);
        using var json = JsonDocument.Parse(await getResponse.Content.ReadAsStringAsync());
        var data = json.RootElement.GetProperty("data");
        // Enums serialize as numbers with the app's default JSON options — if Program.cs adds a
        // JsonStringEnumConverter, assert the string names instead (verify at execution time).
        Assert.Equal(2, data.GetProperty("goal").GetInt32());
        Assert.Equal(4, data.GetProperty("preferredTrainingDaysPerWeek").GetInt32());
        Assert.Equal(2, data.GetProperty("availableEquipment").GetArrayLength());
        Assert.Equal("No overhead pressing", data.GetProperty("exerciseRestrictions").GetString());
    }
}
```

- [ ] **Step 3: Run**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter "ExerciseOwnershipApiTests|TrainingProfileApiTests"` then the full suite `dotnet test server/FitMate.sln`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/FitMate.Tests
git commit -m "test(exercises,training-profile): integration smoke tests for ownership and profile API"
```

---

## Acceptance criteria (Plan 03 done)

**Exercise ownership (spec §3):**
- A normal user creating via `POST /api/exercises` gets a personal exercise (`UserId` = caller, `IsPublic` from request).
- An **admin** creating via `POST /api/exercises` also gets a **personal** exercise — the silent-global bug is gone.
- An admin creating via `POST /api/admin/exercises` gets a global exercise (`UserId = null`, `IsPublic = true`); a non-admin gets 403 (controller `[AdminGuard]`) and the service independently throws (`FitMateException`) if miswired.
- Scope is decided only by the endpoint called; the AdminPanel exercise grid creates through the admin endpoint, all other frontend call sites unchanged.
- All pre-existing exercise validation behavior still passes (regression tests updated in place).
- REVIEW (documented decision): no `FixExerciseOwnership` migration and no data backfill — existing global rows created accidentally by admins are indistinguishable from intended globals; reclassify manually via the admin grid if desired.

**Exercise metadata (spec §10):**
- `Exercise` has nullable `Equipment`/`MovementPattern`/`Difficulty`/`Category`; exposed on `ExerciseModel`, `ExerciseLookupModel` and `CreateExerciseRequest`; editable in the admin exercise editor (and My Exercises — documented decision to prevent metadata wipe on user edits); TS enums regenerated. Enum member sets are the proposed pragmatic defaults — flagged for review.

**Exercise aliases (spec §10):**
- `ExerciseAlias` (`ExerciseId`, `Alias`, `NormalizedAlias`) : `BaseEntity`, cascade from `Exercise`, index on `NormalizedAlias`, unique `(ExerciseId, NormalizedAlias)`.
- `ExerciseAliasNormalizer.Normalize` (trim, lowercase, strip punctuation, collapse whitespace, `-`/`_` → space) is unit-tested and is the single normalization used by writes and search.
- Aliases are a `List<string>` on the request DTO, replaced wholesale on update, deduplicated by normalized form; searching by an alias returns the exercise in `GetAllAsync`, `GetMineAsync` and admin `ListAsync`.
- Migration `AddExerciseMetadataAndAliases` applied.

**User training profile (spec §9):**
- `UserTrainingProfile` exactly as specced (jsonb equipment/days columns, `AllowAiPersonalization` default true, `UpdatedAt`), unique per user, `TrainingExperienceLevel` and `WeightUnit` enums created (`TrainingGoal` reused from Plan 01, not recreated).
- `GET /api/training-profile` returns the profile or null; `PUT /api/training-profile` upserts with validation (days 1–7, duration 10–600, defined enum values) — both `[Authorize]`, service methods take `(request, long userId)`.
- Profile page has a Training section at `/profile/training` with goal/experience/unit selectors, days-per-week and weekday chips, equipment multi-select chips (stored as a JSON string array), restriction/preference textareas and an AI-personalization toggle.
- Migration `AddUserTrainingProfile` applied.

**Quality gates:** `dotnet build server/FitMate.sln` and `dotnet test server/FitMate.sln` green; `cd client && npm run lint && npx tsc -b --noEmit` clean; generated `client/src/types` contains the new models/enums with nothing hand-written.
