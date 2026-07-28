# Vision and Images Implementation Plan (Plan 10)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users can photograph an exercise machine/movement and get it identified against the exercise library (spec §36), and can generate a consistent AI illustration for their own exercises via a confirm-gated `propose_exercise_image` action that never replaces an existing image without an explicit apply call (spec §37), with every generated artifact audited in `AiGeneratedAsset` and job telemetry in `AiJob` (spec §7.7, §67).

**Architecture:** Two new audited entities (`AiGeneratedAsset`, `AiJob`) land in FitMate.DB. `ExerciseRecognitionService` (FitMate.Services/Ai/Vision) validates the upload through the existing `IImageProcessor` pipeline, stages it in a private `ai-temp/{userId}/` blob path, calls the neutral `IAiCompletionProvider` with image content, and matches the detected name against exercises + `ExerciseAlias` rows. Image generation runs at **confirm time** inside `GenerateExerciseImageActionExecutor` (an `IAiActionExecutor` from Plan 06's registry) using a versioned prompt template (`exercise-image-v1`), uploads a preview under `exercises/{id}/ai-preview/`, and a separate `POST api/ai/actions/{id}/apply-image` endpoint pushes the preview through the existing `ExerciseService.UploadImageAsync` pipeline to actually replace the image.

**Tech Stack:** .NET 9, EF Core + Npgsql (Sqlite in tests), SixLabors.ImageSharp, Azure Blob Storage via existing `IBlobStorageService`, OpenAI adapter confined to FitMate.Integrations (roadmap D6), xUnit, React + TypeScript with Reinforced.Typings generated types.

## Global Constraints

- **Contract note (applied 2026-07-27 during cross-plan review):** the authoritative signatures are `IAiToolHandler.ExecuteAsync(...) : Task<AiToolExecutionResult>` (spec §12), `IAiActionExecutor.ExecuteAsync(...) : Task<AiActionExecutionResult>` (spec §84, Plan 06) and `IUsageService.ReserveAsync(...) : Task<UsageReservationModel>` (Plan 04). Signature lines below were corrected to match; where a method body still ends in `return JsonSerializer.Serialize(...)` or `return AiActionJson.Serialize(...)`, wrap that value instead of returning it raw — `new AiToolExecutionResult { Success = true, RequiresConfirmation = true, AiActionId = action.Id, Data = <the anonymous object> }` for tools, and the `AiActionExecutionResult { CreatedEntityId, CreatedEntityName }` shape for executors. Use `reservation.Id` (not the reservation itself) when calling `CommitAsync`/`ReleaseAsync`, and `context.AiRunId` (not `context.RunId`).

- **Dependencies:** Plans 03 (`ExerciseAlias`, exercise metadata), 04 (`IEntitlementService`, `IUsageService`, `SubscriptionFeature`), 05 (`FitMate.Integrations`, `IAiCompletionProvider`, `AiProviderMessage`, `AiJsonSerializer`, `IAiToolHandler`, `AiRun`), 06 (`AiAction`, `AiActionType`, `AiActionStatus`, `IAiActionExecutor`, confirm endpoint) must be merged first. This plan writes concrete best-guess code against those contracts; every such step carries a "verify against `<file>`" note — resolve each note against the merged code before running the step.
- Follow repo conventions (roadmap D4): services take `(request, long userId)` with **no CancellationToken**; the only exception is `FitMate.Integrations` provider interfaces and `IAiToolHandler`/`IAiActionExecutor`, which DO take `CancellationToken`.
- Provider neutrality (roadmap D6): **no OpenAI SDK types outside `server/FitMate.Integrations`**. Services consume only `IAiCompletionProvider` / `IAiImageProvider` and their neutral models.
- Controllers extend `BaseApiController(ILogger<BaseApiController>, AppDbContext, IUserService)` and return `this.ReturnJson(...)` / `this.ReturnJsonError(...)`.
- DTOs live in `server/FitMate.Core/JsonModels/Ai/` — they are auto-exported to `client/src/types/backend.ts` by namespace scan (no registration file). After DTO changes: `dotnet build server/FitMate.Web/FitMate.Web.csproj` then `cd client && npm run process-types`. **Never write TS interfaces by hand for API models.**
- All `PayloadJson`/`ResultJson`/`MetadataJson` written by this plan use `new JsonSerializerOptions(JsonSerializerDefaults.Web)` (camelCase) so the frontend can `JSON.parse` action results directly.
- `AppDbContext.SaveChangesAsync()` stamps `DateCreated`/`DateModified` — never set them manually.
- Entitlement/usage ordering: `RequireFeatureAsync` before any storage writes; `ReserveAsync` immediately before the provider call; `CommitAsync` on success, `ReleaseAsync` on provider/parse failure. Limit errors surface with the spec §49 envelope (`code: "subscription_limit_reached"`, HTTP 403/429) produced by Plan 04 — this plan only propagates them.
- Recognition uploads: jpeg/png/webp only, ≤ 10 MB (`RecognitionUploadConstraints`, deliberately different from the 8 MB `UploadConstraints` used for manual exercise photos). Decompression-bomb guard = re-encode through the existing `ImageSharpImageProcessor` (max edge 1200px) before anything touches a provider.
- All commands run from repo root `c:\Users\damian\Documents\Github\FitMate`. Backend: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter <Name>`, `dotnet build server/FitMate.sln`. Frontend: `cd client`, `npm run lint`, `npx tsc -b --noEmit`.

## File Structure

```
server/FitMate.DB/
├── Enums/AiGeneratedAssetType.cs, AiJobType.cs, AiJobStatus.cs        (Task 1)
├── Entities/AiGeneratedAsset.cs, AiJob.cs                             (Task 1)
├── Configurations/AiGeneratedAssetConfiguration.cs,
│                  AiJobConfiguration.cs                               (Task 1)
├── AppDbContext.cs (modify: 2 DbSets)                                 (Task 1)
└── Migrations/xxx_AddAiGeneratedAssetsAndJobs.cs (generated)          (Task 1)

server/FitMate.Integrations/Ai/
├── AiProviderMessage.cs (modify: add Images — Plan 05 file)           (Task 2)
├── AiProviderImage.cs                                                 (Task 2)
├── IAiImageProvider.cs (AiImageRequest, AiImageResult)                (Task 2)
└── OpenAi/OpenAiImageProvider.cs                                      (Task 2)

server/FitMate.Core/JsonModels/Ai/
├── ExerciseRecognitionResult.cs, ExerciseRecognitionCandidateModel.cs (Task 3)
├── ProposeExerciseImageRequest.cs, ExerciseImageProposalModel.cs      (Task 3)
└── GenerateExerciseImageResult.cs                                     (Task 3)

server/FitMate.Services/Ai/
├── PromptHasher.cs                                                    (Task 3)
├── Prompts/AiPromptTemplates.cs,
│           exercise-recognition-v1.txt, exercise-image-v1.txt         (Task 3)
├── Vision/IExerciseCandidateMatcher.cs, ExerciseCandidateMatcher.cs   (Task 4)
├── Vision/RecognitionUploadConstraints.cs, ExerciseRecognitionInput.cs,
│          IExerciseRecognitionService.cs, ExerciseRecognitionService.cs (Task 5)
├── Images/ExerciseImageAuthorization.cs, GenerateExerciseImagePayload.cs,
│          IAiExerciseImageService.cs, AiExerciseImageService.cs       (Tasks 7–8)
├── Actions/GenerateExerciseImageActionExecutor.cs                     (Task 7)
└── Tools/ProposeExerciseImageToolHandler.cs                           (Task 7)

server/FitMate.Web/
├── Controllers/AiVisionController.cs                                  (Task 6)
├── Controllers/AiExerciseImageController.cs                           (Task 8)
├── Controllers/AiActionController.cs (modify — Plan 06 file)          (Task 8)
└── Program.cs (modify: DI)                                            (Tasks 6, 8)

server/FitMate.Tests/
├── TestInfrastructure/FakeAiImageProvider.cs                          (Task 2)
├── TestInfrastructure/FakeAiCompletionProvider.cs (only if Plan 05
│   did not create one), FakeEntitlementService.cs, FakeUsageService.cs
│   (only if Plan 04 did not create them)                              (Task 5)
├── TestInfrastructure/FakeBlobStorageService.cs (modify: in-memory
│   blob content so DownloadAsync round-trips)                         (Task 7)
├── Unit/Services/AiPromptTemplateTests.cs                             (Task 3)
├── Unit/Services/ExerciseCandidateMatcherTests.cs                     (Task 4)
├── Unit/Services/ExerciseRecognitionServiceTests.cs                   (Task 5)
├── Unit/Services/GenerateExerciseImageActionExecutorTests.cs          (Task 7)
└── Unit/Services/AiExerciseImageServiceTests.cs                       (Tasks 7–8)

client/src/
├── lib/subscriptionErrors.ts                                          (Task 9)
├── services/aiVisionService.ts                                        (Task 9)
├── types/index.ts (modify: alias exports)                             (Task 9)
├── shared/components/IdentifyExerciseModal.tsx                        (Task 9)
├── shared/components/index.ts (modify)                                (Tasks 9–10)
├── components/workout/ExercisePickerModal.tsx (modify)                (Task 9)
├── pages/Profile/hooks/useMyExercisesPage.ts (modify)                 (Tasks 9–10)
├── pages/Profile/MyExercises.tsx (modify)                             (Tasks 9–10)
├── hooks/useExerciseImageGeneration.ts                                (Task 10)
└── shared/components/ExerciseImageProposalCard.tsx                    (Task 10)
```

---

### Task 1: AiGeneratedAsset + AiJob entities, enums, configs, migration

**Files:**
- Create: `server/FitMate.DB/Enums/AiGeneratedAssetType.cs`, `AiJobType.cs`, `AiJobStatus.cs`
- Create: `server/FitMate.DB/Entities/AiGeneratedAsset.cs`, `AiJob.cs`
- Create: `server/FitMate.DB/Configurations/AiGeneratedAssetConfiguration.cs`, `AiJobConfiguration.cs`
- Modify: `server/FitMate.DB/AppDbContext.cs` (2 DbSets)
- Test: existing `server/FitMate.Tests/Unit/Database/AppDbContextTests.cs` must still pass (`EnsureCreated` exercises the new model)

**Interfaces:**
- Consumes: `BaseEntity`, `User`, `Exercise`, `AiRun` (Plan 05).
- Produces: the two entities + three enums exactly as below; Tasks 5, 7, 8 and Plan 11 (retry/cleanup jobs) use these property names.

- [ ] **Step 1: Write the enums** (one file each, namespace `FitMate.DB.Enums`)

```csharp
namespace FitMate.DB.Enums;

public enum AiGeneratedAssetType
{
    ExerciseImage = 1,
    RecognitionUpload = 2,
}

public enum AiJobType
{
    ExerciseImageGeneration = 1,
}

public enum AiJobStatus
{
    Pending = 1,
    Running = 2,
    Completed = 3,
    Failed = 4,
}
```

- [ ] **Step 2: Write the entities**

`server/FitMate.DB/Entities/AiGeneratedAsset.cs`:

```csharp
using FitMate.DB.Entities.Base;
using FitMate.DB.Enums;

namespace FitMate.DB.Entities;

public class AiGeneratedAsset : BaseEntity
{
    public long UserId { get; set; }
    public long? ExerciseId { get; set; }
    public long? AiRunId { get; set; }
    public AiGeneratedAssetType Type { get; set; }
    public string Provider { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public string PromptVersion { get; set; } = string.Empty;
    public string PromptHash { get; set; } = string.Empty;   // SHA256 hex of the full rendered prompt
    public string BlobPath { get; set; } = string.Empty;
    public string? MetadataJson { get; set; }

    public User User { get; set; } = null!;
    public Exercise? Exercise { get; set; }
    public AiRun? AiRun { get; set; }
}
```

> Verify the `AiRun` navigation compiles against Plan 05's entity (`server/FitMate.DB/Entities/AiRun.cs`) at execution time; if Plan 05 named it differently, use the actual type.

`server/FitMate.DB/Entities/AiJob.cs` (spec §67 — v1 generates synchronously; the executor records rows here so Plan 11's retry job has data):

```csharp
using FitMate.DB.Entities.Base;
using FitMate.DB.Enums;

namespace FitMate.DB.Entities;

public class AiJob : BaseEntity
{
    public long UserId { get; set; }
    public long? AiRunId { get; set; }
    public AiJobType JobType { get; set; }
    public AiJobStatus Status { get; set; }
    public string PayloadJson { get; set; } = "{}";
    public string? ResultJson { get; set; }
    public int AttemptCount { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? ErrorMessage { get; set; }

    public User User { get; set; } = null!;
    public AiRun? AiRun { get; set; }
}
```

- [ ] **Step 3: Write the configurations** (same style as `ProgramPlanConfiguration` from Plan 01)

`AiGeneratedAssetConfiguration.cs`:

```csharp
using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

public class AiGeneratedAssetConfiguration : IEntityTypeConfiguration<AiGeneratedAsset>
{
    public void Configure(EntityTypeBuilder<AiGeneratedAsset> builder)
    {
        builder.Property(x => x.Provider).HasMaxLength(100).IsRequired();
        builder.Property(x => x.Model).HasMaxLength(200).IsRequired();
        builder.Property(x => x.PromptVersion).HasMaxLength(100).IsRequired();
        builder.Property(x => x.PromptHash).HasMaxLength(64).IsRequired();
        builder.Property(x => x.BlobPath).HasMaxLength(1000).IsRequired();

        builder.HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.Exercise)
            .WithMany()
            .HasForeignKey(x => x.ExerciseId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(x => x.AiRun)
            .WithMany()
            .HasForeignKey(x => x.AiRunId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(x => x.UserId);
        builder.HasIndex(x => x.ExerciseId);
        builder.HasIndex(x => new { x.Type, x.DateCreated });
    }
}
```

`AiJobConfiguration.cs`:

```csharp
using FitMate.DB.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FitMate.DB.Configurations;

public class AiJobConfiguration : IEntityTypeConfiguration<AiJob>
{
    public void Configure(EntityTypeBuilder<AiJob> builder)
    {
        builder.Property(x => x.PayloadJson).IsRequired();
        builder.Property(x => x.ErrorMessage).HasMaxLength(2000);

        builder.HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.AiRun)
            .WithMany()
            .HasForeignKey(x => x.AiRunId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(x => new { x.Status, x.JobType });
        builder.HasIndex(x => x.UserId);
    }
}
```

In `AppDbContext.cs` add after the last AI DbSet Plan 05/06 added (or after `PersonalRecords` if ordering is unclear):

```csharp
    public DbSet<AiGeneratedAsset> AiGeneratedAssets => Set<AiGeneratedAsset>();
    public DbSet<AiJob> AiJobs => Set<AiJob>();
```

(Configurations are picked up automatically — `OnModelCreating` calls `ApplyConfigurationsFromAssembly`.)

- [ ] **Step 4: Build and run existing tests**

Run: `dotnet build server/FitMate.sln` then `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter AppDbContextTests`
Expected: build OK, tests PASS.

- [ ] **Step 5: Add migration**

Run: `dotnet ef migrations add AddAiGeneratedAssetsAndJobs --project server/FitMate.DB --startup-project server/FitMate.Web`
Expected: migration adds `AiGeneratedAssets` and `AiJobs` tables only — inspect the generated file; no drops or alters of existing tables.

- [ ] **Step 6: Commit**

```bash
git add server/FitMate.DB docs/superpowers/plans
git commit -m "feat(ai-vision): add AiGeneratedAsset and AiJob entities with migration"
```

---

### Task 2: Neutral image provider + vision image content (FitMate.Integrations)

**Files:**
- Modify: `server/FitMate.Integrations/Ai/AiProviderMessage.cs` (Plan 05 file — add image content)
- Create: `server/FitMate.Integrations/Ai/AiProviderImage.cs`, `server/FitMate.Integrations/Ai/IAiImageProvider.cs`, `server/FitMate.Integrations/Ai/OpenAi/OpenAiImageProvider.cs`
- Create: `server/FitMate.Tests/TestInfrastructure/FakeAiImageProvider.cs`
- Modify: the DI registration site Plan 05 used for `IAiCompletionProvider` (an `AddAiIntegrations` extension or `server/FitMate.Web/Program.cs` ~line 250)

**Interfaces:**
- Consumes: Plan 05's neutral message model and OpenAI client/settings wiring.
- Produces (Tasks 5 and 7 depend on these exact names):

```csharp
namespace FitMate.Integrations.Ai;

public sealed class AiProviderImage
{
    public byte[] Content { get; set; } = [];
    public string ContentType { get; set; } = "image/jpeg";
}

public interface IAiImageProvider
{
    Task<AiImageResult> GenerateAsync(AiImageRequest request, CancellationToken cancellationToken);
}

public sealed class AiImageRequest
{
    public string Prompt { get; set; } = string.Empty;
    public string Size { get; set; } = "1024x1024";
}

public sealed class AiImageResult
{
    public byte[] Content { get; set; } = [];
    public string ContentType { get; set; } = "image/png";
    public string Provider { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
}
```

> Verify namespace and file layout against the actual FitMate.Integrations project structure Plan 05 created (e.g. `FitMate.Integrations.Ai.Models`) and follow it. If Plan 05 already created `IAiImageProvider`, skip creating it and reconcile property names instead.

- [ ] **Step 1: Add image content to the neutral message model**

In `AiProviderMessage.cs` (Plan 05) add:

```csharp
    public List<AiProviderImage> Images { get; set; } = [];
```

and create `AiProviderImage.cs` as above. Then extend Plan 05's OpenAI **completion** adapter so user messages with `Images` emit image parts — inside the message-mapping code:

```csharp
// Where Plan 05 builds ChatMessage content parts from AiProviderMessage:
foreach (var image in message.Images)
{
    parts.Add(ChatMessageContentPart.CreateImagePart(
        BinaryData.FromBytes(image.Content), image.ContentType));
}
```

> Verify against Plan 05's `OpenAiCompletionProvider` mapping code at execution time — reuse its exact part-building pattern; only the image part line is new. This file lives in FitMate.Integrations, so OpenAI types are allowed here.

- [ ] **Step 2: Implement `OpenAiImageProvider`**

```csharp
using OpenAI.Images;

namespace FitMate.Integrations.Ai.OpenAi;

public class OpenAiImageProvider : IAiImageProvider
{
    private const string ProviderName = "openai";
    private const string ModelName = "gpt-image-1";

    private readonly string apiKey;

    public OpenAiImageProvider(FitMate.Core.Settings.ApplicationSettings settings)
    {
        apiKey = settings.OpenAiApiKey;
    }

    public async Task<AiImageResult> GenerateAsync(AiImageRequest request, CancellationToken cancellationToken)
    {
        var client = new ImageClient(ModelName, apiKey);
        var options = new ImageGenerationOptions
        {
            Size = GeneratedImageSize.W1024xH1024,
        };

        GeneratedImage image = await client.GenerateImageAsync(request.Prompt, options, cancellationToken);

        return new AiImageResult
        {
            Content = image.ImageBytes.ToArray(),
            ContentType = "image/png",
            Provider = ProviderName,
            Model = ModelName,
        };
    }
}
```

> Verify: (a) how Plan 05 reads the OpenAI API key (`ApplicationSettings.OpenAiApiKey` is the best guess — use the actual settings property/DI pattern its `OpenAiCompletionProvider` uses, including any shared `OpenAIClient` instance); (b) the pinned OpenAI SDK's image API surface — `gpt-image-1` returns base64 bytes by default; adjust `ImageGenerationOptions` members to what the SDK exposes.

- [ ] **Step 3: Register DI + write the fake**

Add next to Plan 05's `IAiCompletionProvider` registration:

```csharp
builder.Services.AddScoped<IAiImageProvider, OpenAiImageProvider>();
```

`server/FitMate.Tests/TestInfrastructure/FakeAiImageProvider.cs`:

```csharp
using FitMate.Integrations.Ai;

namespace FitMate.Tests.TestInfrastructure;

public sealed class FakeAiImageProvider : IAiImageProvider
{
    public int CallCount { get; private set; }
    public Exception? Exception { get; set; }
    public string? LastPrompt { get; private set; }

    public AiImageResult Result { get; set; } = new()
    {
        Content = [1, 2, 3, 4],
        ContentType = "image/png",
        Provider = "fake",
        Model = "fake-image-model",
    };

    public Task<AiImageResult> GenerateAsync(AiImageRequest request, CancellationToken cancellationToken)
    {
        CallCount++;
        LastPrompt = request.Prompt;
        if (Exception != null)
        {
            throw Exception;
        }

        return Task.FromResult(Result);
    }
}
```

- [ ] **Step 4: Build**

Run: `dotnet build server/FitMate.sln`
Expected: OK.

- [ ] **Step 5: Commit**

```bash
git add server/FitMate.Integrations server/FitMate.Tests server/FitMate.Web
git commit -m "feat(ai-images): neutral IAiImageProvider, OpenAI adapter, vision image content"
```

---

### Task 3: DTOs, prompt templates, prompt hasher

**Files:**
- Create: `server/FitMate.Core/JsonModels/Ai/ExerciseRecognitionResult.cs`, `ExerciseRecognitionCandidateModel.cs`, `ProposeExerciseImageRequest.cs`, `ExerciseImageProposalModel.cs`, `GenerateExerciseImageResult.cs`
- Create: `server/FitMate.Services/Ai/PromptHasher.cs`, `server/FitMate.Services/Ai/Prompts/AiPromptTemplates.cs`, `Ai/Prompts/exercise-recognition-v1.txt`, `Ai/Prompts/exercise-image-v1.txt`
- Modify: `server/FitMate.Services/FitMate.Services.csproj` (embed the templates)
- Test: `server/FitMate.Tests/Unit/Services/AiPromptTemplateTests.cs`

**Interfaces:**
- Consumes: nothing new.
- Produces: the five DTOs (auto-exported to `backend.ts` — the Reinforced.Typings config scans all of `FitMate.Core.JsonModels`, no registration needed), `AiPromptTemplates.Load(string name)` / `Render(string name, IReadOnlyDictionary<string, string?> values)`, `PromptHasher.Sha256(string prompt)`. Tasks 5, 7, 8, 9, 10 use these names.

> If Plan 05 already shipped a prompt-template loader or a SHA256 prompt hasher (check `server/FitMate.Services/Ai/`), reuse it and only add the two template files — do not create a second mechanism.

- [ ] **Step 1: Write the DTOs** (namespace `FitMate.Core.JsonModels.Ai`, one class per file)

```csharp
namespace FitMate.Core.JsonModels.Ai;

public class ExerciseRecognitionResult
{
    public string DetectedExerciseName { get; set; } = string.Empty;
    public decimal Confidence { get; set; }               // 0..1
    public string? Equipment { get; set; }
    public string? MovementPattern { get; set; }
    public List<ExerciseRecognitionCandidateModel> Candidates { get; set; } = [];
    public string? Notes { get; set; }
}

public class ExerciseRecognitionCandidateModel
{
    public long ExerciseId { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal MatchScore { get; set; }               // 0..1
}

public class ProposeExerciseImageRequest
{
    public long ExerciseId { get; set; }
    public string? StyleNotes { get; set; }
}

public class ExerciseImageProposalModel
{
    public long ActionId { get; set; }
    public bool ReplacesExistingImage { get; set; }
}

public class GenerateExerciseImageResult
{
    public long AssetId { get; set; }
    public string PreviewBlobPath { get; set; } = string.Empty;
    public string PreviewUrl { get; set; } = string.Empty;
    public bool ReplacesExistingImage { get; set; }
}
```

- [ ] **Step 2: Write the prompt templates**

`server/FitMate.Services/Ai/Prompts/exercise-recognition-v1.txt`:

```text
You are an exercise recognition assistant for a fitness app. Look at the provided photo of a
gym machine, free-weight setup, or a person performing a movement and identify the exercise.

Return ONLY a JSON object with exactly these fields and no other text:
{
  "detectedExerciseName": "common English name of the exercise, or an empty string if unrecognizable",
  "confidence": 0.0,
  "equipment": "primary equipment visible (e.g. Barbell, Dumbbell, Cable, Machine, Bodyweight) or null",
  "movementPattern": "one of Squat, Hinge, Lunge, HorizontalPush, VerticalPush, HorizontalPull, VerticalPull, Carry, Core, Isolation, or null",
  "notes": "one short sentence with anything useful you noticed, or null"
}

confidence is a number between 0 and 1. Do not wrap the JSON in markdown fences.
```

`server/FitMate.Services/Ai/Prompts/exercise-image-v1.txt` (the CONSISTENT visual style contract — every generated exercise image uses this template so the library looks uniform):

```text
Create a clean instructional fitness illustration of the exercise "{{ExerciseName}}".
Equipment: {{Equipment}}. Movement pattern: {{MovementPattern}}.
{{StyleNotes}}
Style requirements: flat vector illustration, single athlete shown mid-movement at the most
recognizable point of the exercise, consistent minimal geometric style, soft two-tone shading,
neutral light background, no text, no logos, no watermarks, centered composition, 1:1 aspect ratio.
```

In `FitMate.Services.csproj` add:

```xml
  <ItemGroup>
    <EmbeddedResource Include="Ai\Prompts\*.txt" />
  </ItemGroup>
```

- [ ] **Step 3: Write the loader and hasher**

`server/FitMate.Services/Ai/Prompts/AiPromptTemplates.cs`:

```csharp
namespace FitMate.Services.Ai.Prompts;

public static class AiPromptTemplates
{
    public static string Load(string name)
    {
        var assembly = typeof(AiPromptTemplates).Assembly;
        var resourceName = $"FitMate.Services.Ai.Prompts.{name}.txt";
        using var stream = assembly.GetManifestResourceStream(resourceName)
            ?? throw new InvalidOperationException($"Prompt template '{name}' not found.");
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }

    public static string Render(string name, IReadOnlyDictionary<string, string?> values)
    {
        var template = Load(name);
        foreach (var (key, value) in values)
        {
            template = template.Replace("{{" + key + "}}", value ?? string.Empty);
        }

        return template;
    }
}
```

`server/FitMate.Services/Ai/PromptHasher.cs`:

```csharp
using System.Security.Cryptography;
using System.Text;

namespace FitMate.Services.Ai;

public static class PromptHasher
{
    /// SHA256 of the full rendered prompt, lowercase hex — stored on AiGeneratedAsset.PromptHash.
    public static string Sha256(string prompt)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(prompt));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
```

- [ ] **Step 4: Write tests** (`AiPromptTemplateTests.cs`)

```csharp
using FitMate.Services.Ai;
using FitMate.Services.Ai.Prompts;

namespace FitMate.Tests.Unit.Services;

public class AiPromptTemplateTests
{
    [Fact]
    public void ExerciseImageTemplate_RendersSubstitutions()
    {
        var prompt = AiPromptTemplates.Render("exercise-image-v1", new Dictionary<string, string?>
        {
            ["ExerciseName"] = "Barbell Back Squat",
            ["Equipment"] = "Barbell",
            ["MovementPattern"] = "Squat",
            ["StyleNotes"] = string.Empty,
        });

        Assert.Contains("Barbell Back Squat", prompt);
        Assert.Contains("flat vector illustration", prompt);
        Assert.DoesNotContain("{{", prompt);
    }

    [Fact]
    public void RecognitionTemplate_LoadsAndDescribesJsonShape()
    {
        var prompt = AiPromptTemplates.Load("exercise-recognition-v1");

        Assert.Contains("detectedExerciseName", prompt);
        Assert.Contains("confidence", prompt);
    }

    [Fact]
    public void PromptHasher_IsDeterministicLowercaseSha256Hex()
    {
        var first = PromptHasher.Sha256("hello");

        Assert.Equal(first, PromptHasher.Sha256("hello"));
        Assert.Equal("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824", first);
    }
}
```

- [ ] **Step 5: Run tests**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter AiPromptTemplateTests`
Expected: PASS (3 tests). If the resource lookup fails, the embedded resource id differs — folder separators become dots; align `resourceName` with the actual id.

- [ ] **Step 6: Commit**

```bash
git add server/FitMate.Core server/FitMate.Services server/FitMate.Tests
git commit -m "feat(ai-vision): recognition/image DTOs, versioned prompt templates, prompt hasher"
```

---

### Task 4: Exercise candidate matcher (alias-aware, TDD)

**Files:**
- Create: `server/FitMate.Services/Ai/Vision/IExerciseCandidateMatcher.cs`, `ExerciseCandidateMatcher.cs`
- Test: `server/FitMate.Tests/Unit/Services/ExerciseCandidateMatcherTests.cs`

**Interfaces:**
- Consumes: `Exercise`, `ExerciseAlias` (Plan 03), `ExerciseRecognitionCandidateModel` (Task 3).
- Produces:

```csharp
using FitMate.Core.JsonModels.Ai;

namespace FitMate.Services.Ai.Vision;

public interface IExerciseCandidateMatcher
{
    /// Matches a detected exercise name against exercises visible to the user
    /// (public + own private) and their aliases. Top 5, score descending, min score 0.4.
    Task<IReadOnlyList<ExerciseRecognitionCandidateModel>> FindCandidatesAsync(string detectedName, long userId);
}
```

> Verify against Plan 03 before coding: the `ExerciseAlias` entity's property names (assumed `ExerciseId`, `Alias`, plus a possible `NormalizedAlias`), the `AppDbContext.ExerciseAliases` DbSet name, and whether Plan 03 shipped a name normalizer (e.g. `ExerciseNameNormalizer.Normalize`). If a normalizer exists, call it instead of the local `Normalize` below and delete the local one.

- [ ] **Step 1: Write failing tests**

```csharp
using FitMate.DB.Entities;
using FitMate.Services.Ai.Vision;
using FitMate.Tests.TestInfrastructure;

namespace FitMate.Tests.Unit.Services;

public class ExerciseCandidateMatcherTests
{
    private static async Task<long> SeedExerciseAsync(
        SqliteTestDatabase db, long? userId, string name, bool isPublic, string? alias = null)
    {
        await using var context = db.CreateContext();
        var exercise = new Exercise
        {
            UserId = userId,
            IsPublic = isPublic,
            Name = name,
            Slug = name.ToLowerInvariant().Replace(' ', '-'),
            PrimaryMuscleGroupId = SqliteTestDatabase.BackId,
        };
        context.Exercises.Add(exercise);
        await context.SaveChangesAsync();

        if (alias != null)
        {
            context.ExerciseAliases.Add(new ExerciseAlias { ExerciseId = exercise.Id, Alias = alias });
            await context.SaveChangesAsync();
        }

        return exercise.Id;
    }

    [Fact]
    public async Task ExactAliasMatch_ReturnsCandidateWithScore1()
    {
        using var db = new SqliteTestDatabase();
        var exerciseId = await SeedExerciseAsync(db, SqliteTestDatabase.UserId, "Romanian Deadlift", isPublic: false, alias: "RDL");
        await using var context = db.CreateContext();
        var matcher = new ExerciseCandidateMatcher(context);

        var candidates = await matcher.FindCandidatesAsync("rdl", SqliteTestDatabase.UserId);

        var candidate = Assert.Single(candidates);
        Assert.Equal(exerciseId, candidate.ExerciseId);
        Assert.Equal("Romanian Deadlift", candidate.Name);
        Assert.Equal(1m, candidate.MatchScore);
    }

    [Fact]
    public async Task OtherUsersPrivateExercise_IsNotACandidate()
    {
        using var db = new SqliteTestDatabase();
        await SeedExerciseAsync(db, SqliteTestDatabase.OtherUserId, "Secret Squat", isPublic: false);
        await using var context = db.CreateContext();
        var matcher = new ExerciseCandidateMatcher(context);

        var candidates = await matcher.FindCandidatesAsync("Secret Squat", SqliteTestDatabase.UserId);

        Assert.Empty(candidates);
    }

    [Fact]
    public async Task PartialMatch_ScoresBelowExact_AndOrdersDescending()
    {
        using var db = new SqliteTestDatabase();
        var exact = await SeedExerciseAsync(db, null, "Barbell Back Squat", isPublic: true);
        var partial = await SeedExerciseAsync(db, null, "Barbell Back Squat Pause", isPublic: true);
        await SeedExerciseAsync(db, null, "Seated Cable Row", isPublic: true);
        await using var context = db.CreateContext();
        var matcher = new ExerciseCandidateMatcher(context);

        var candidates = await matcher.FindCandidatesAsync("Barbell Back Squat", SqliteTestDatabase.UserId);

        Assert.Equal(2, candidates.Count);
        Assert.Equal(exact, candidates[0].ExerciseId);
        Assert.Equal(1m, candidates[0].MatchScore);
        Assert.Equal(partial, candidates[1].ExerciseId);
        Assert.True(candidates[1].MatchScore < 1m && candidates[1].MatchScore >= 0.4m);
    }

    [Fact]
    public async Task ReturnsAtMostFiveCandidates()
    {
        using var db = new SqliteTestDatabase();
        for (var i = 1; i <= 7; i++)
        {
            await SeedExerciseAsync(db, null, $"Squat Variation {i}", isPublic: true);
        }
        await using var context = db.CreateContext();
        var matcher = new ExerciseCandidateMatcher(context);

        var candidates = await matcher.FindCandidatesAsync("Squat", SqliteTestDatabase.UserId);

        Assert.Equal(5, candidates.Count);
    }

    [Fact]
    public async Task EmptyDetectedName_ReturnsEmpty()
    {
        using var db = new SqliteTestDatabase();
        await using var context = db.CreateContext();
        var matcher = new ExerciseCandidateMatcher(context);

        Assert.Empty(await matcher.FindCandidatesAsync("   ", SqliteTestDatabase.UserId));
    }
}
```

- [ ] **Step 2: Run tests — expect FAIL** (`ExerciseCandidateMatcher` missing)

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter ExerciseCandidateMatcherTests`

- [ ] **Step 3: Implement**

```csharp
using FitMate.Core.JsonModels.Ai;
using FitMate.DB;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.Ai.Vision;

public class ExerciseCandidateMatcher : IExerciseCandidateMatcher
{
    private const int MaxCandidates = 5;
    private const decimal MinScore = 0.4m;

    private readonly AppDbContext dbContext;

    public ExerciseCandidateMatcher(AppDbContext dbContext)
    {
        this.dbContext = dbContext;
    }

    public async Task<IReadOnlyList<ExerciseRecognitionCandidateModel>> FindCandidatesAsync(string detectedName, long userId)
    {
        var normalizedDetected = Normalize(detectedName);
        if (normalizedDetected.Length == 0)
        {
            return [];
        }

        var exercises = await dbContext.Exercises
            .AsNoTracking()
            .Where(x => x.IsPublic || x.UserId == userId)
            .Select(x => new { x.Id, x.Name })
            .ToListAsync();

        var aliases = await dbContext.ExerciseAliases
            .AsNoTracking()
            .Where(a => a.Exercise.IsPublic || a.Exercise.UserId == userId)
            .Select(a => new { a.ExerciseId, a.Alias })
            .ToListAsync();

        var displayNames = exercises.ToDictionary(x => x.Id, x => x.Name);

        var scored = exercises
            .Select(x => (x.Id, Score: Score(normalizedDetected, Normalize(x.Name))))
            .Concat(aliases.Select(a => (Id: a.ExerciseId, Score: Score(normalizedDetected, Normalize(a.Alias)))));

        return scored
            .Where(s => s.Score >= MinScore)
            .GroupBy(s => s.Id)
            .Select(g => new ExerciseRecognitionCandidateModel
            {
                ExerciseId = g.Key,
                Name = displayNames.TryGetValue(g.Key, out var name) ? name : string.Empty,
                MatchScore = g.Max(s => s.Score),
            })
            .OrderByDescending(c => c.MatchScore)
            .ThenBy(c => c.Name)
            .Take(MaxCandidates)
            .ToList();
    }

    internal static string Normalize(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var chars = value.Trim().ToLowerInvariant()
            .Select(c => char.IsLetterOrDigit(c) ? c : ' ')
            .ToArray();
        return string.Join(' ', new string(chars).Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }

    private static decimal Score(string detected, string candidate)
    {
        if (candidate.Length == 0)
        {
            return 0m;
        }

        if (candidate == detected)
        {
            return 1m;
        }

        if (candidate.StartsWith(detected, StringComparison.Ordinal)
            || detected.StartsWith(candidate, StringComparison.Ordinal))
        {
            return 0.85m;
        }

        if (candidate.Contains(detected, StringComparison.Ordinal)
            || detected.Contains(candidate, StringComparison.Ordinal))
        {
            return 0.7m;
        }

        var detectedTokens = detected.Split(' ').ToHashSet();
        var candidateTokens = candidate.Split(' ').ToHashSet();
        var union = detectedTokens.Union(candidateTokens).Count();
        if (union == 0)
        {
            return 0m;
        }

        return Math.Round((decimal)detectedTokens.Intersect(candidateTokens).Count() / union, 2);
    }
}
```

- [ ] **Step 4: Run tests — expect PASS (5 tests)**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter ExerciseCandidateMatcherTests`

- [ ] **Step 5: Commit**

```bash
git add server/FitMate.Services server/FitMate.Tests
git commit -m "feat(ai-vision): alias-aware exercise candidate matcher"
```

---

### Task 5: ExerciseRecognitionService (TDD)

**Files:**
- Create: `server/FitMate.Services/Ai/Vision/RecognitionUploadConstraints.cs`, `ExerciseRecognitionInput.cs`, `IExerciseRecognitionService.cs`, `ExerciseRecognitionService.cs`
- Create (only if Plan 04/05 did not already provide equivalents in TestInfrastructure — check first): `server/FitMate.Tests/TestInfrastructure/FakeEntitlementService.cs`, `FakeUsageService.cs`, `FakeAiCompletionProvider.cs`
- Test: `server/FitMate.Tests/Unit/Services/ExerciseRecognitionServiceTests.cs`

**Interfaces:**
- Consumes: `IEntitlementService` / `IUsageService` (Plan 04), `IAiCompletionProvider` / `AiCompletionRequest` / `AiCompletionResult` / `AiProviderMessage` / `AiJsonSerializer` (Plan 05), `IImageProcessor`, `IBlobStorageService`, Task 3 DTOs, Task 4 matcher.
- Produces (Task 6's controller depends on these exact names):

```csharp
namespace FitMate.Services.Ai.Vision;

public static class RecognitionUploadConstraints
{
    public const long MaxBytes = 10 * 1024 * 1024;

    public static readonly IReadOnlySet<string> AllowedContentTypes = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
    };
}

/// Service-level input (holds the upload stream — deliberately NOT a JsonModel).
public sealed class ExerciseRecognitionInput
{
    public required Stream Content { get; init; }
    public string FileName { get; init; } = string.Empty;
    public string ContentType { get; init; } = string.Empty;
    public long Length { get; init; }
    public string? Description { get; init; }
    public string? EquipmentContext { get; init; }
}

public interface IExerciseRecognitionService
{
    Task<ExerciseRecognitionResult> RecognizeAsync(ExerciseRecognitionInput input, long userId);
}
```

> Verify these Plan 04/05 contracts before coding and adjust member names to the merged code: `IUsageService.ReserveAsync` return type (assumed `Task<long>` reservation id), `AiCompletionRequest.Messages`, `AiProviderMessage.Role`/`Content` (Role assumed to be `AiMessageRole` from FitMate.DB.Enums; may be a string), `AiCompletionResult.Content`/`Provider`/`Model`, and `AiJsonSerializer.Deserialize<T>` (Plan 05's fence-tolerant parser — if it does not exist, create it in `server/FitMate.Services/Ai/AiJsonSerializer.cs` stripping ``` fences before `JsonSerializer.Deserialize` with `JsonSerializerDefaults.Web`).

- [ ] **Step 1: Write the fakes** (skip any that Plan 04/05 tests already created — reuse those instead)

`FakeEntitlementService.cs` (implement any extra `IEntitlementService` members from Plan 04 with `throw new NotSupportedException()` bodies):

```csharp
using FitMate.Core.Exceptions;
using FitMate.DB.Enums;

namespace FitMate.Tests.TestInfrastructure;

public sealed class FakeEntitlementService : IEntitlementService
{
    public HashSet<SubscriptionFeature> DeniedFeatures { get; } = [];
    public List<SubscriptionFeature> RequiredFeatures { get; } = [];

    public Task RequireFeatureAsync(long userId, SubscriptionFeature feature)
    {
        RequiredFeatures.Add(feature);
        return DeniedFeatures.Contains(feature)
            ? throw new FitMateException("subscription_limit_reached")
            : Task.CompletedTask;
    }

    // Implement GetAvailabilityAsync / GetAllAsync with NotSupportedException bodies
    // matching the actual interface signatures from Plan 04.
}
```

`FakeUsageService.cs`:

```csharp
using FitMate.DB.Enums;

namespace FitMate.Tests.TestInfrastructure;

public sealed class FakeUsageService : IUsageService
{
    private long nextReservationId = 1;

    public List<long> Reserved { get; } = [];
    public List<long> Committed { get; } = [];
    public List<long> Released { get; } = [];
    public Exception? ReserveException { get; set; }

    public Task<UsageReservationModel> ReserveAsync(long userId, SubscriptionFeature feature, int quantity)
    {
        if (ReserveException != null)
        {
            throw ReserveException;
        }

        var id = nextReservationId++;
        Reserved.Add(id);
        return Task.FromResult(id);
    }

    public Task CommitAsync(long reservationId)
    {
        Committed.Add(reservationId);
        return Task.CompletedTask;
    }

    public Task ReleaseAsync(long reservationId)
    {
        Released.Add(reservationId);
        return Task.CompletedTask;
    }
}
```

`FakeAiCompletionProvider.cs` (only if Plan 05's test suite has none):

```csharp
using FitMate.Integrations.Ai;

namespace FitMate.Tests.TestInfrastructure;

public sealed class FakeAiCompletionProvider : IAiCompletionProvider
{
    public string ResponseContent { get; set; } = "{}";
    public Exception? Exception { get; set; }
    public List<AiCompletionRequest> Requests { get; } = [];

    public Task<AiCompletionResult> CompleteAsync(AiCompletionRequest request, CancellationToken cancellationToken)
    {
        Requests.Add(request);
        if (Exception != null)
        {
            throw Exception;
        }

        return Task.FromResult(new AiCompletionResult
        {
            Content = ResponseContent,
            Provider = "fake",
            Model = "fake-vision-model",
        });
    }
}
```

- [ ] **Step 2: Write failing tests** (`ExerciseRecognitionServiceTests.cs`)

```csharp
using System.Text.Json;
using FitMate.Core.Exceptions;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.Ai.Vision;
using FitMate.Tests.TestInfrastructure;

namespace FitMate.Tests.Unit.Services;

public class ExerciseRecognitionServiceTests
{
    private sealed class Harness : IDisposable
    {
        public SqliteTestDatabase Db { get; } = new();
        public FakeEntitlementService Entitlements { get; } = new();
        public FakeUsageService Usage { get; } = new();
        public FakeAiCompletionProvider Provider { get; } = new();
        public FakeBlobStorageService Blobs { get; } = new();
        public FakeImageProcessor ImageProcessor { get; } = new();
        public AppDbContext Context { get; }
        public ExerciseRecognitionService Service { get; }

        public Harness()
        {
            Context = Db.CreateContext();
            Service = new ExerciseRecognitionService(
                Context, Entitlements, Usage, Provider, ImageProcessor, Blobs,
                new ExerciseCandidateMatcher(Context));
        }

        public void Dispose()
        {
            Context.Dispose();
            Db.Dispose();
        }
    }

    private static ExerciseRecognitionInput Input(string contentType = "image/jpeg", long length = 1024) => new()
    {
        Content = new MemoryStream([1, 2, 3]),
        FileName = "squat.jpg",
        ContentType = contentType,
        Length = length,
    };

    private static string VisionJson(string name, decimal confidence = 0.9m) =>
        JsonSerializer.Serialize(new
        {
            detectedExerciseName = name,
            confidence,
            equipment = "Barbell",
            movementPattern = "Squat",
            notes = "Depth looks good.",
        });

    [Fact]
    public async Task Recognize_UnsupportedContentType_Throws_NoSideEffects()
    {
        using var h = new Harness();

        await Assert.ThrowsAsync<FitMateException>(() =>
            h.Service.RecognizeAsync(Input(contentType: "image/gif"), SqliteTestDatabase.UserId));

        Assert.Empty(h.Blobs.UploadedPaths);
        Assert.Empty(h.Provider.Requests);
        Assert.Empty(h.Usage.Reserved);
    }

    [Fact]
    public async Task Recognize_TooLarge_Throws()
    {
        using var h = new Harness();

        await Assert.ThrowsAsync<FitMateException>(() =>
            h.Service.RecognizeAsync(Input(length: RecognitionUploadConstraints.MaxBytes + 1), SqliteTestDatabase.UserId));

        Assert.Empty(h.Blobs.UploadedPaths);
    }

    [Fact]
    public async Task Recognize_FeatureDenied_Throws_BeforeAnyUpload()
    {
        using var h = new Harness();
        h.Entitlements.DeniedFeatures.Add(SubscriptionFeature.AiExerciseRecognition);

        await Assert.ThrowsAsync<FitMateException>(() =>
            h.Service.RecognizeAsync(Input(), SqliteTestDatabase.UserId));

        Assert.Empty(h.Blobs.UploadedPaths);
        Assert.Empty(h.Provider.Requests);
    }

    [Fact]
    public async Task Recognize_Success_CommitsUsage_RecordsTempAsset_DeletesTempBlob()
    {
        using var h = new Harness();
        h.Provider.ResponseContent = VisionJson("Barbell Back Squat");

        var result = await h.Service.RecognizeAsync(Input(), SqliteTestDatabase.UserId);

        Assert.Equal("Barbell Back Squat", result.DetectedExerciseName);
        Assert.Equal(0.9m, result.Confidence);
        Assert.Single(h.Usage.Committed);
        Assert.Empty(h.Usage.Released);

        var uploaded = Assert.Single(h.Blobs.UploadedPaths);
        Assert.StartsWith($"ai-temp/{SqliteTestDatabase.UserId}/", uploaded);
        Assert.Contains(uploaded, h.Blobs.DeletedPaths);   // v1: best-effort delete after response

        await using var context = h.Db.CreateContext();
        var asset = Assert.Single(context.AiGeneratedAssets.ToList());
        Assert.Equal(AiGeneratedAssetType.RecognitionUpload, asset.Type);
        Assert.Equal(uploaded, asset.BlobPath);
        Assert.Equal("exercise-recognition-v1", asset.PromptVersion);
        Assert.Equal(64, asset.PromptHash.Length);
    }

    [Fact]
    public async Task Recognize_ProviderFailure_ReleasesReservation_NoAssetRecorded()
    {
        using var h = new Harness();
        h.Provider.Exception = new InvalidOperationException("provider down");

        await Assert.ThrowsAnyAsync<Exception>(() =>
            h.Service.RecognizeAsync(Input(), SqliteTestDatabase.UserId));

        Assert.Single(h.Usage.Released);
        Assert.Empty(h.Usage.Committed);
        await using var context = h.Db.CreateContext();
        Assert.Empty(context.AiGeneratedAssets.ToList());
    }

    [Fact]
    public async Task Recognize_MatchesCandidateViaAlias()
    {
        using var h = new Harness();
        long exerciseId;
        await using (var context = h.Db.CreateContext())
        {
            var exercise = new Exercise
            {
                UserId = SqliteTestDatabase.UserId,
                IsPublic = false,
                Name = "Romanian Deadlift",
                Slug = "romanian-deadlift",
                PrimaryMuscleGroupId = SqliteTestDatabase.BackId,
            };
            context.Exercises.Add(exercise);
            await context.SaveChangesAsync();
            context.ExerciseAliases.Add(new ExerciseAlias { ExerciseId = exercise.Id, Alias = "RDL" });
            await context.SaveChangesAsync();
            exerciseId = exercise.Id;
        }

        h.Provider.ResponseContent = VisionJson("RDL");

        var result = await h.Service.RecognizeAsync(Input(), SqliteTestDatabase.UserId);

        var candidate = Assert.Single(result.Candidates);
        Assert.Equal(exerciseId, candidate.ExerciseId);
        Assert.Equal(1m, candidate.MatchScore);
    }
}
```

> If Plan 03's `ExerciseAlias` requires more fields (e.g. `NormalizedAlias`), set them in the seed helper the same way Plan 03's own tests do.

- [ ] **Step 3: Run tests — expect FAIL** (`ExerciseRecognitionService` missing)

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter ExerciseRecognitionServiceTests`

- [ ] **Step 4: Implement `ExerciseRecognitionService`**

```csharp
using System.Text.Json;
using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.Ai;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Integrations.Ai;
using FitMate.Services.Ai.Prompts;
using FitMate.Services.Storage.Blobs;
using FitMate.Services.Storage.Imaging;

namespace FitMate.Services.Ai.Vision;

public class ExerciseRecognitionService : IExerciseRecognitionService
{
    public const string PromptVersion = "exercise-recognition-v1";
    private const string TempFolder = "ai-temp";

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly AppDbContext dbContext;
    private readonly IEntitlementService entitlementService;
    private readonly IUsageService usageService;
    private readonly IAiCompletionProvider completionProvider;
    private readonly IImageProcessor imageProcessor;
    private readonly IBlobStorageService blobStorage;
    private readonly IExerciseCandidateMatcher candidateMatcher;

    public ExerciseRecognitionService(
        AppDbContext dbContext,
        IEntitlementService entitlementService,
        IUsageService usageService,
        IAiCompletionProvider completionProvider,
        IImageProcessor imageProcessor,
        IBlobStorageService blobStorage,
        IExerciseCandidateMatcher candidateMatcher)
    {
        this.dbContext = dbContext;
        this.entitlementService = entitlementService;
        this.usageService = usageService;
        this.completionProvider = completionProvider;
        this.imageProcessor = imageProcessor;
        this.blobStorage = blobStorage;
        this.candidateMatcher = candidateMatcher;
    }

    public async Task<ExerciseRecognitionResult> RecognizeAsync(ExerciseRecognitionInput input, long userId)
    {
        if (!RecognitionUploadConstraints.AllowedContentTypes.Contains(input.ContentType))
        {
            throw new FitMateException("Unsupported file type. Upload a JPEG, PNG, or WebP image.");
        }

        if (input.Length > RecognitionUploadConstraints.MaxBytes)
        {
            throw new FitMateException("File too large. Maximum size is 10 MB.");
        }

        // Gate before any storage side effects (cheap failure; deliberate reorder of spec §36's list).
        await entitlementService.RequireFeatureAsync(userId, SubscriptionFeature.AiExerciseRecognition);

        // Re-encodes via ImageSharp: rejects non-images and caps dimensions — the decompression-bomb guard.
        var processed = await imageProcessor.ProcessAsync(input.Content)
            ?? throw new FitMateException("The uploaded file is not a valid image.");

        var blobPath = $"{TempFolder}/{userId}/{Guid.NewGuid():N}.{processed.Extension}";
        await blobStorage.UploadAsync(processed.Content, blobPath, processed.ContentType);

        var prompt = BuildPrompt(input.Description, input.EquipmentContext);
        var reservationId = await usageService.ReserveAsync(userId, SubscriptionFeature.AiExerciseRecognition, 1);

        AiCompletionResult completion;
        ExerciseVisionResponse vision;
        try
        {
            processed.Content.Position = 0;
            using var imageBuffer = new MemoryStream();
            await processed.Content.CopyToAsync(imageBuffer);

            var request = new AiCompletionRequest
            {
                Messages =
                [
                    new AiProviderMessage { Role = AiMessageRole.System, Content = prompt },
                    new AiProviderMessage
                    {
                        Role = AiMessageRole.User,
                        Content = "Identify the exercise in this image.",
                        Images =
                        [
                            new AiProviderImage
                            {
                                Content = imageBuffer.ToArray(),
                                ContentType = processed.ContentType,
                            },
                        ],
                    },
                ],
            };

            completion = await completionProvider.CompleteAsync(request, CancellationToken.None);
            vision = AiJsonSerializer.Deserialize<ExerciseVisionResponse>(completion.Content)
                ?? throw new FitMateException("The AI response could not be parsed.");
        }
        catch
        {
            await usageService.ReleaseAsync(reservationId);
            await TryDeleteAsync(blobPath);
            throw;
        }

        await usageService.CommitAsync(reservationId);

        var candidates = await candidateMatcher.FindCandidatesAsync(vision.DetectedExerciseName ?? string.Empty, userId);

        dbContext.AiGeneratedAssets.Add(new AiGeneratedAsset
        {
            UserId = userId,
            Type = AiGeneratedAssetType.RecognitionUpload,
            Provider = completion.Provider,
            Model = completion.Model,
            PromptVersion = PromptVersion,
            PromptHash = PromptHasher.Sha256(prompt),
            BlobPath = blobPath,
            MetadataJson = JsonSerializer.Serialize(
                new { fileName = input.FileName, contentType = input.ContentType, sizeBytes = input.Length },
                JsonOptions),
        });
        await dbContext.SaveChangesAsync();

        // v1 temp-blob lifecycle: best-effort delete right away; Plan 11's retention job
        // (TemporaryUploadRetentionHours) sweeps any ai-temp/ leftovers.
        await TryDeleteAsync(blobPath);

        return new ExerciseRecognitionResult
        {
            DetectedExerciseName = vision.DetectedExerciseName ?? string.Empty,
            Confidence = Math.Clamp(vision.Confidence, 0m, 1m),
            Equipment = vision.Equipment,
            MovementPattern = vision.MovementPattern,
            Notes = vision.Notes,
            Candidates = candidates.ToList(),
        };
    }

    private static string BuildPrompt(string? description, string? equipmentContext)
    {
        var prompt = AiPromptTemplates.Load(PromptVersion);
        if (!string.IsNullOrWhiteSpace(description))
        {
            prompt += $"\nUser description of the exercise: {description.Trim()}";
        }

        if (!string.IsNullOrWhiteSpace(equipmentContext))
        {
            prompt += $"\nEquipment the user has available: {equipmentContext.Trim()}";
        }

        return prompt;
    }

    private async Task TryDeleteAsync(string blobPath)
    {
        try
        {
            await blobStorage.DeleteAsync(blobPath);
        }
        catch
        {
            // Best-effort only — Plan 11's cleanup job is the backstop.
        }
    }

    private sealed record ExerciseVisionResponse(
        string? DetectedExerciseName,
        decimal Confidence,
        string? Equipment,
        string? MovementPattern,
        string? Notes);
}
```

- [ ] **Step 5: Run tests — expect PASS (6 tests)**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter ExerciseRecognitionServiceTests`

- [ ] **Step 6: Commit**

```bash
git add server/FitMate.Services server/FitMate.Tests
git commit -m "feat(ai-vision): exercise recognition service with entitlement, usage and temp-blob flow"
```

---

### Task 6: Recognition endpoint, DI, type export

**Files:**
- Create: `server/FitMate.Web/Controllers/AiVisionController.cs`
- Modify: `server/FitMate.Web/Program.cs` (2 DI lines)

**Interfaces:**
- Consumes: `IExerciseRecognitionService`, `IExerciseCandidateMatcher`.
- Produces the HTTP surface Task 9's frontend consumes:

```
POST /api/ai/exercise-recognition   multipart form: file, description?, equipmentContext?
                                    → ExerciseRecognitionResult
```

- [ ] **Step 1: Write the controller** (attribute routing lets several controllers share the `api/ai` prefix — Plan 05's conversation controller keeps its own routes)

```csharp
using FitMate.DB;
using FitMate.Services.Ai.Vision;
using FitMate.Services.Users;
using FitMate.Web.Controllers.Base;
using FitMate.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FitMate.Web.Controllers;

[Authorize]
[Route("api/ai")]
public class AiVisionController : BaseApiController
{
    private readonly IExerciseRecognitionService recognitionService;

    public AiVisionController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService,
        IExerciseRecognitionService recognitionService)
        : base(logger, dbContext, userService)
    {
        this.recognitionService = recognitionService;
    }

    [HttpPost("exercise-recognition")]
    [RequestSizeLimit(RecognitionUploadConstraints.MaxBytes + 524288)]   // + slack for multipart framing
    public async Task<ActionResult> RecognizeExercise(
        [FromForm] IFormFile? file,
        [FromForm] string? description,
        [FromForm] string? equipmentContext)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        if (file == null || file.Length == 0)
        {
            return this.ReturnJsonError("No image uploaded.");
        }

        await using var stream = file.OpenReadStream();
        var input = new ExerciseRecognitionInput
        {
            Content = stream,
            FileName = file.FileName,
            ContentType = file.ContentType,
            Length = file.Length,
            Description = description,
            EquipmentContext = equipmentContext,
        };

        var result = await recognitionService.RecognizeAsync(input, userId.Value);
        return this.ReturnJson(result);
    }
}
```

- [ ] **Step 2: Register DI** — in `Program.cs`, after the AI service registrations Plans 05/06 added:

```csharp
builder.Services.AddScoped<IExerciseCandidateMatcher, ExerciseCandidateMatcher>();
builder.Services.AddScoped<IExerciseRecognitionService, ExerciseRecognitionService>();
```

- [ ] **Step 3: Build + regenerate types**

Run: `dotnet build server/FitMate.Web/FitMate.Web.csproj`
Then: `cd client && npm run process-types && npx tsc -b --noEmit`
Expected: `client/src/types/backend.ts` now contains `ExerciseRecognitionResult`, `ExerciseRecognitionCandidateModel`, `ExerciseImageProposalModel`, `GenerateExerciseImageResult` under `JsonModels.Ai`; tsc clean.

- [ ] **Step 4: Run full backend suite**

Run: `dotnet test server/FitMate.sln`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/FitMate.Web client/src/types
git commit -m "feat(ai-vision): exercise-recognition endpoint, DI and generated types"
```

---

### Task 7: propose_exercise_image tool + GenerateExerciseImageActionExecutor (TDD)

**Files:**
- Create: `server/FitMate.Services/Ai/Images/ExerciseImageAuthorization.cs`, `GenerateExerciseImagePayload.cs`, `IAiExerciseImageService.cs`, `AiExerciseImageService.cs` (Propose half — Apply lands in Task 8)
- Create: `server/FitMate.Services/Ai/Actions/GenerateExerciseImageActionExecutor.cs`, `server/FitMate.Services/Ai/Tools/ProposeExerciseImageToolHandler.cs`
- Modify: `server/FitMate.Tests/TestInfrastructure/FakeBlobStorageService.cs` (in-memory blob content)
- Test: `server/FitMate.Tests/Unit/Services/GenerateExerciseImageActionExecutorTests.cs`, `AiExerciseImageServiceTests.cs` (Propose tests)

**Interfaces:**
- Consumes: `AiAction`/`AiActionType`/`AiActionStatus`/`IAiActionExecutor`/`IAiToolHandler`/`AiToolContext` (Plans 05/06), `IAiImageProvider` (Task 2), `AiPromptTemplates`/`PromptHasher` (Task 3), `IEntitlementService`/`IUsageService` (Plan 04), `IImageProcessor`, `IBlobStorageService`, `IUserService`.
- Produces:

```csharp
namespace FitMate.Services.Ai.Images;

/// Serialized into AiAction.PayloadJson (camelCase).
public sealed class GenerateExerciseImagePayload
{
    public long ExerciseId { get; set; }
    public string? StyleNotes { get; set; }
}

public interface IAiExerciseImageService
{
    Task<ExerciseImageProposalModel> ProposeAsync(
        ProposeExerciseImageRequest request, long userId, long? conversationId = null, long? aiRunId = null);
    Task<ExerciseModel> ApplyAsync(long actionId, long userId);   // implemented in Task 8
}
```

Tool name (allow-list): `propose_exercise_image`. Executor handles `AiActionType.GenerateExerciseImage`.

> Verify before coding: (a) `AiActionType.GenerateExerciseImage` exists (spec §7 prints it; Plan 06 should have created it — add the member if missing); (b) `AiActionStatus` member names (assumed `PendingConfirmation` / `Executed`); (c) `IAiActionExecutor.ExecuteAsync` return type (assumed `Task<string>` returning the ResultJson Plan 06 persists — mirror whatever Plan 06's other executors return); (d) `IAiToolHandler.Definition`'s type (if it is a neutral definition model rather than a JSON string, translate the schema below into that model); (e) `AiToolContext` member names (assumed `UserId`, `ConversationId`, `AiRunId`); (f) required `AiAction` fields beyond `UserId`/`ActionType`/`Status`/`PayloadJson` (e.g. `ExpiresAt` — populate them the way Plan 06's other proposal tools do); (g) Plan 03's exercise metadata columns (assumed nullable enums `Exercise.Equipment` / `Exercise.MovementPattern` — if names differ, fix `BuildPrompt` and the executor test's expected-prompt helper together).

- [ ] **Step 1: Extend `FakeBlobStorageService` so DownloadAsync round-trips** (backward compatible — existing tests keep passing because previously-unknown paths still return null)

```csharp
    public Dictionary<string, byte[]> Blobs { get; } = [];

    public Task<string> UploadAsync(Stream content, string path, string contentType)
    {
        UploadedPaths.Add(path);
        if (content.CanSeek)
        {
            content.Position = 0;
        }

        using var memory = new MemoryStream();
        content.CopyTo(memory);
        Blobs[path] = memory.ToArray();
        return Task.FromResult(path);
    }

    public Task<Stream?> DownloadAsync(string path)
        => Task.FromResult<Stream?>(Blobs.TryGetValue(path, out var bytes) ? new MemoryStream(bytes) : null);
```

Run `dotnet test server/FitMate.Tests/FitMate.Tests.csproj` after this edit — the existing suite must stay green.

- [ ] **Step 2: Write failing tests**

`AiExerciseImageServiceTests.cs` (Propose half):

```csharp
using System.Text.Json;
using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.Ai;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.Ai.Images;
using FitMate.Tests.TestInfrastructure;

namespace FitMate.Tests.Unit.Services;

public class AiExerciseImageServiceTests
{
    // Harness: SqliteTestDatabase + context + FakeUserService + FakeBlobStorageService
    // + the real ExerciseService (constructed exactly like in ExerciseServiceTests) — copy that
    // construction, it needs MemoryCache, FakeImageProcessor and FakePhotoUrlResolver.

    private static async Task<long> SeedExerciseAsync(SqliteTestDatabase db, long? userId, string name)
    {
        await using var context = db.CreateContext();
        var exercise = new Exercise
        {
            UserId = userId,
            IsPublic = userId == null,
            Name = name,
            Slug = name.ToLowerInvariant().Replace(' ', '-'),
            PrimaryMuscleGroupId = SqliteTestDatabase.ChestId,
        };
        context.Exercises.Add(exercise);
        await context.SaveChangesAsync();
        return exercise.Id;
    }

    [Fact]
    public async Task Propose_OwnPersonalExercise_CreatesPendingConfirmationAction()
    {
        using var db = new SqliteTestDatabase();
        var exerciseId = await SeedExerciseAsync(db, SqliteTestDatabase.UserId, "My Press");
        var service = CreateService(db, FakeUserService.ForUser(SqliteTestDatabase.UserId));

        var proposal = await service.ProposeAsync(
            new ProposeExerciseImageRequest { ExerciseId = exerciseId }, SqliteTestDatabase.UserId);

        await using var context = db.CreateContext();
        var action = Assert.Single(context.AiActions.ToList());
        Assert.Equal(proposal.ActionId, action.Id);
        Assert.Equal(AiActionType.GenerateExerciseImage, action.ActionType);
        Assert.Equal(AiActionStatus.PendingConfirmation, action.Status);
        var payload = JsonSerializer.Deserialize<GenerateExerciseImagePayload>(
            action.PayloadJson, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        Assert.Equal(exerciseId, payload!.ExerciseId);
        Assert.False(proposal.ReplacesExistingImage);
    }

    [Fact]
    public async Task Propose_OtherUsersExercise_Throws()
    {
        using var db = new SqliteTestDatabase();
        var exerciseId = await SeedExerciseAsync(db, SqliteTestDatabase.OtherUserId, "Not Yours");
        var service = CreateService(db, FakeUserService.ForUser(SqliteTestDatabase.UserId));

        await Assert.ThrowsAsync<FitMateException>(() => service.ProposeAsync(
            new ProposeExerciseImageRequest { ExerciseId = exerciseId }, SqliteTestDatabase.UserId));
    }

    [Fact]
    public async Task Propose_GlobalExercise_NonAdmin_Throws()
    {
        using var db = new SqliteTestDatabase();
        var exerciseId = await SeedExerciseAsync(db, null, "Global Squat");
        var service = CreateService(db, FakeUserService.ForUser(SqliteTestDatabase.UserId));

        await Assert.ThrowsAsync<FitMateException>(() => service.ProposeAsync(
            new ProposeExerciseImageRequest { ExerciseId = exerciseId }, SqliteTestDatabase.UserId));
    }

    [Fact]
    public async Task Propose_GlobalExercise_Admin_CreatesAction()
    {
        using var db = new SqliteTestDatabase();
        var exerciseId = await SeedExerciseAsync(db, null, "Global Squat");
        var service = CreateService(db, FakeUserService.ForAdmin(SqliteTestDatabase.AdminUserId));

        var proposal = await service.ProposeAsync(
            new ProposeExerciseImageRequest { ExerciseId = exerciseId }, SqliteTestDatabase.AdminUserId);

        Assert.True(proposal.ActionId > 0);
    }
}
```

`GenerateExerciseImageActionExecutorTests.cs`:

```csharp
using System.Text.Json;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Core.JsonModels.Ai;
using FitMate.Services.Ai;
using FitMate.Services.Ai.Actions;
using FitMate.Services.Ai.Images;
using FitMate.Services.Ai.Prompts;
using FitMate.Tests.TestInfrastructure;

namespace FitMate.Tests.Unit.Services;

public class GenerateExerciseImageActionExecutorTests
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    private sealed class Harness : IDisposable
    {
        public SqliteTestDatabase Db { get; } = new();
        public FakeEntitlementService Entitlements { get; } = new();
        public FakeUsageService Usage { get; } = new();
        public FakeAiImageProvider ImageProvider { get; } = new();
        public FakeBlobStorageService Blobs { get; } = new();
        public FakeImageProcessor ImageProcessor { get; } = new();
        public FakeUserService UserService { get; } = FakeUserService.ForUser(SqliteTestDatabase.UserId);
        public AppDbContext Context { get; }
        public GenerateExerciseImageActionExecutor Executor { get; }

        public Harness()
        {
            Context = Db.CreateContext();
            Executor = new GenerateExerciseImageActionExecutor(
                Context, UserService, Entitlements, Usage, ImageProvider, ImageProcessor, Blobs);
        }

        public void Dispose()
        {
            Context.Dispose();
            Db.Dispose();
        }
    }

    private static async Task<(long ExerciseId, AiAction Action)> SeedAsync(Harness h)
    {
        var exercise = new Exercise
        {
            UserId = SqliteTestDatabase.UserId,
            IsPublic = false,
            Name = "My Press",
            Slug = "my-press",
            PrimaryMuscleGroupId = SqliteTestDatabase.ChestId,
        };
        h.Context.Exercises.Add(exercise);
        await h.Context.SaveChangesAsync();

        var action = new AiAction
        {
            UserId = SqliteTestDatabase.UserId,
            ActionType = AiActionType.GenerateExerciseImage,
            Status = AiActionStatus.PendingConfirmation,
            PayloadJson = JsonSerializer.Serialize(
                new GenerateExerciseImagePayload { ExerciseId = exercise.Id }, Web),
        };
        h.Context.AiActions.Add(action);
        await h.Context.SaveChangesAsync();
        return (exercise.Id, action);
    }

    [Fact]
    public async Task Execute_GeneratesPreview_RecordsAssetWithPromptHash_DoesNotTouchExerciseImage()
    {
        using var h = new Harness();
        var (exerciseId, action) = await SeedAsync(h);

        var resultJson = await h.Executor.ExecuteAsync(action, SqliteTestDatabase.UserId, CancellationToken.None);
        var result = JsonSerializer.Deserialize<GenerateExerciseImageResult>(resultJson, Web)!;

        Assert.StartsWith($"exercises/{exerciseId}/ai-preview/", result.PreviewBlobPath);
        Assert.Contains(result.PreviewBlobPath, h.Blobs.UploadedPaths);
        Assert.Single(h.Usage.Committed);

        var asset = Assert.Single(h.Context.AiGeneratedAssets.ToList());
        Assert.Equal(AiGeneratedAssetType.ExerciseImage, asset.Type);
        Assert.Equal(exerciseId, asset.ExerciseId);
        Assert.Equal("fake-image-model", asset.Model);
        Assert.Equal(PromptHasher.Sha256(h.ImageProvider.LastPrompt!), asset.PromptHash);
        Assert.Equal("exercise-image-v1", asset.PromptVersion);

        var exercise = h.Context.Exercises.Single(x => x.Id == exerciseId);
        Assert.Null(exercise.ImageUrl);   // NOT replaced until apply-image

        var job = Assert.Single(h.Context.AiJobs.ToList());
        Assert.Equal(AiJobStatus.Completed, job.Status);
        Assert.Equal(AiJobType.ExerciseImageGeneration, job.JobType);
    }

    [Fact]
    public async Task Execute_ProviderFailure_ReleasesReservation_MarksJobFailed()
    {
        using var h = new Harness();
        var (_, action) = await SeedAsync(h);
        h.ImageProvider.Exception = new InvalidOperationException("image provider down");

        await Assert.ThrowsAnyAsync<Exception>(() =>
            h.Executor.ExecuteAsync(action, SqliteTestDatabase.UserId, CancellationToken.None));

        Assert.Single(h.Usage.Released);
        Assert.Empty(h.Usage.Committed);
        var job = Assert.Single(h.Context.AiJobs.ToList());
        Assert.Equal(AiJobStatus.Failed, job.Status);
        Assert.Contains("image provider down", job.ErrorMessage);
        Assert.Empty(h.Context.AiGeneratedAssets.ToList());
    }

    [Fact]
    public async Task Execute_Twice_IsIdempotent_ProviderCalledOnce()
    {
        using var h = new Harness();
        var (_, action) = await SeedAsync(h);

        var first = await h.Executor.ExecuteAsync(action, SqliteTestDatabase.UserId, CancellationToken.None);
        var second = await h.Executor.ExecuteAsync(action, SqliteTestDatabase.UserId, CancellationToken.None);

        Assert.Equal(first, second);
        Assert.Equal(1, h.ImageProvider.CallCount);
        Assert.Single(h.Usage.Reserved);
    }

    [Fact]
    public async Task Execute_ExerciseOwnedByAnotherUser_Throws()
    {
        using var h = new Harness();
        var (_, action) = await SeedAsync(h);

        await Assert.ThrowsAnyAsync<Exception>(() =>
            h.Executor.ExecuteAsync(action, SqliteTestDatabase.OtherUserId, CancellationToken.None));

        Assert.Equal(0, h.ImageProvider.CallCount);
    }
}
```

- [ ] **Step 3: Run tests — expect FAIL** (types missing)

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter "GenerateExerciseImageActionExecutorTests|AiExerciseImageServiceTests"`

- [ ] **Step 4: Implement authorization helper, service (Propose), executor, tool handler**

`ExerciseImageAuthorization.cs`:

```csharp
using FitMate.Core.Exceptions;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.Services.Users;
using Microsoft.EntityFrameworkCore;

namespace FitMate.Services.Ai.Images;

public static class ExerciseImageAuthorization
{
    /// Personal exercises: owner only. Global exercises (UserId == null): admin only (spec §37).
    public static async Task<Exercise> LoadAuthorizedExerciseAsync(
        AppDbContext dbContext, IUserService userService, long exerciseId, long userId)
    {
        var exercise = await dbContext.Exercises.FirstOrDefaultAsync(x => x.Id == exerciseId)
            ?? throw new FitMateException("Exercise not found.");

        if (exercise.UserId == null)
        {
            if (!userService.LoggedInUserIsAdmin)
            {
                throw new FitMateException("Only admins can generate images for global exercises.");
            }

            return exercise;
        }

        if (exercise.UserId != userId)
        {
            throw new FitMateException("You can only generate images for your own exercises.");
        }

        return exercise;
    }
}
```

`AiExerciseImageService.cs` (Propose half; `ApplyAsync` throws `NotImplementedException` until Task 8 — Task 8 replaces it the same day):

```csharp
using System.Text.Json;
using FitMate.Core.JsonModels.Ai;
using FitMate.Core.JsonModels.Exercises;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Services.Users;

namespace FitMate.Services.Ai.Images;

public class AiExerciseImageService : IAiExerciseImageService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly AppDbContext dbContext;
    private readonly IUserService userService;

    public AiExerciseImageService(AppDbContext dbContext, IUserService userService)
    {
        this.dbContext = dbContext;
        this.userService = userService;
    }

    public async Task<ExerciseImageProposalModel> ProposeAsync(
        ProposeExerciseImageRequest request, long userId, long? conversationId = null, long? aiRunId = null)
    {
        var exercise = await ExerciseImageAuthorization.LoadAuthorizedExerciseAsync(
            dbContext, userService, request.ExerciseId, userId);

        var action = new AiAction
        {
            UserId = userId,
            ActionType = AiActionType.GenerateExerciseImage,
            Status = AiActionStatus.PendingConfirmation,
            PayloadJson = JsonSerializer.Serialize(
                new GenerateExerciseImagePayload { ExerciseId = exercise.Id, StyleNotes = request.StyleNotes },
                JsonOptions),
            // Verify: set ConversationId/AiRunId/ExpiresAt etc. exactly like Plan 06's other
            // proposal tools populate AiAction (see e.g. ProposeExerciseToolHandler).
        };
        dbContext.AiActions.Add(action);
        await dbContext.SaveChangesAsync();

        return new ExerciseImageProposalModel
        {
            ActionId = action.Id,
            ReplacesExistingImage = !string.IsNullOrEmpty(exercise.ImageUrl),
        };
    }

    public Task<ExerciseModel> ApplyAsync(long actionId, long userId)
        => throw new NotImplementedException("Implemented in Task 8.");
}
```

`GenerateExerciseImageActionExecutor.cs` (generation happens HERE, at confirm time, because it costs money — spec §37):

```csharp
using System.Text.Json;
using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.Ai;
using FitMate.DB;
using FitMate.DB.Entities;
using FitMate.DB.Enums;
using FitMate.Integrations.Ai;
using FitMate.Services.Ai.Images;
using FitMate.Services.Ai.Prompts;
using FitMate.Services.Storage.Blobs;
using FitMate.Services.Storage.Imaging;
using FitMate.Services.Users;

namespace FitMate.Services.Ai.Actions;

public class GenerateExerciseImageActionExecutor : IAiActionExecutor
{
    public const string PromptVersion = "exercise-image-v1";
    private const string PreviewFolder = "ai-preview";

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly AppDbContext dbContext;
    private readonly IUserService userService;
    private readonly IEntitlementService entitlementService;
    private readonly IUsageService usageService;
    private readonly IAiImageProvider imageProvider;
    private readonly IImageProcessor imageProcessor;
    private readonly IBlobStorageService blobStorage;

    public GenerateExerciseImageActionExecutor(
        AppDbContext dbContext,
        IUserService userService,
        IEntitlementService entitlementService,
        IUsageService usageService,
        IAiImageProvider imageProvider,
        IImageProcessor imageProcessor,
        IBlobStorageService blobStorage)
    {
        this.dbContext = dbContext;
        this.userService = userService;
        this.entitlementService = entitlementService;
        this.usageService = usageService;
        this.imageProvider = imageProvider;
        this.imageProcessor = imageProcessor;
        this.blobStorage = blobStorage;
    }

    public AiActionType ActionType => AiActionType.GenerateExerciseImage;

    public async Task<AiActionExecutionResult> ExecuteAsync(AiAction action, long userId, CancellationToken cancellationToken)
    {
        // Double-confirm idempotency: a second confirm returns the stored result, no regeneration.
        if (!string.IsNullOrEmpty(action.ResultJson))
        {
            return action.ResultJson;
        }

        var payload = JsonSerializer.Deserialize<GenerateExerciseImagePayload>(action.PayloadJson, JsonOptions)
            ?? throw new FitMateException("Invalid image generation payload.");

        var exercise = await ExerciseImageAuthorization.LoadAuthorizedExerciseAsync(
            dbContext, userService, payload.ExerciseId, userId);

        await entitlementService.RequireFeatureAsync(userId, SubscriptionFeature.AiImageGeneration);
        var reservationId = await usageService.ReserveAsync(userId, SubscriptionFeature.AiImageGeneration, 1);

        var job = new AiJob
        {
            UserId = userId,
            AiRunId = action.AiRunId,
            JobType = AiJobType.ExerciseImageGeneration,
            Status = AiJobStatus.Running,
            PayloadJson = action.PayloadJson,
            AttemptCount = 1,
            StartedAt = DateTime.UtcNow,
        };
        dbContext.AiJobs.Add(job);
        await dbContext.SaveChangesAsync();

        var prompt = BuildPrompt(exercise, payload.StyleNotes);

        try
        {
            var generated = await imageProvider.GenerateAsync(
                new AiImageRequest { Prompt = prompt }, cancellationToken);

            using var raw = new MemoryStream(generated.Content);
            var processed = await imageProcessor.ProcessAsync(raw)
                ?? throw new FitMateException("The generated image could not be processed.");

            var previewBlobPath =
                $"{StorageModule.Exercises.ToFolder()}/{exercise.Id}/{PreviewFolder}/{Guid.NewGuid():N}.{processed.Extension}";
            await blobStorage.UploadAsync(processed.Content, previewBlobPath, processed.ContentType);

            var asset = new AiGeneratedAsset
            {
                UserId = userId,
                ExerciseId = exercise.Id,
                AiRunId = action.AiRunId,
                Type = AiGeneratedAssetType.ExerciseImage,
                Provider = generated.Provider,
                Model = generated.Model,
                PromptVersion = PromptVersion,
                PromptHash = PromptHasher.Sha256(prompt),
                BlobPath = previewBlobPath,
                MetadataJson = JsonSerializer.Serialize(new { styleNotes = payload.StyleNotes }, JsonOptions),
            };
            dbContext.AiGeneratedAssets.Add(asset);
            await dbContext.SaveChangesAsync();

            var result = new GenerateExerciseImageResult
            {
                AssetId = asset.Id,
                PreviewBlobPath = previewBlobPath,
                PreviewUrl = await blobStorage.GetReadUrlAsync(previewBlobPath),
                ReplacesExistingImage = !string.IsNullOrEmpty(exercise.ImageUrl),
            };
            var resultJson = JsonSerializer.Serialize(result, JsonOptions);

            action.ResultJson = resultJson;   // defensive: idempotency holds even if Plan 06 also sets it
            job.Status = AiJobStatus.Completed;
            job.ResultJson = resultJson;
            job.CompletedAt = DateTime.UtcNow;
            await usageService.CommitAsync(reservationId);
            await dbContext.SaveChangesAsync();

            return resultJson;
        }
        catch (Exception exception)
        {
            await usageService.ReleaseAsync(reservationId);
            job.Status = AiJobStatus.Failed;
            job.ErrorMessage = exception.Message;
            job.CompletedAt = DateTime.UtcNow;
            await dbContext.SaveChangesAsync();
            throw;
        }
    }

    private static string BuildPrompt(Exercise exercise, string? styleNotes) =>
        AiPromptTemplates.Render(PromptVersion, new Dictionary<string, string?>
        {
            ["ExerciseName"] = exercise.Name,
            ["Equipment"] = exercise.Equipment?.ToString() ?? "no equipment specified",
            ["MovementPattern"] = exercise.MovementPattern?.ToString() ?? "not specified",
            ["StyleNotes"] = string.IsNullOrWhiteSpace(styleNotes)
                ? string.Empty
                : $"Additional style notes: {styleNotes.Trim()}",
        });
}
```

> Verify `Exercise.Equipment` / `Exercise.MovementPattern` against Plan 03's entity (see the Task 7 verify list, item g). If Plan 03 stores metadata elsewhere, substitute those columns; the fallback strings stay.

`ProposeExerciseImageToolHandler.cs`:

```csharp
using System.Text.Json;
using FitMate.Core.Exceptions;
using FitMate.Core.JsonModels.Ai;
using FitMate.Services.Ai.Images;

namespace FitMate.Services.Ai.Tools;

public class ProposeExerciseImageToolHandler : IAiToolHandler
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly IAiExerciseImageService exerciseImageService;

    public ProposeExerciseImageToolHandler(IAiExerciseImageService exerciseImageService)
    {
        this.exerciseImageService = exerciseImageService;
    }

    public string Name => "propose_exercise_image";

    // Verify Definition's type against IAiToolHandler (Plan 05). If it is a neutral definition
    // model instead of a JSON string, translate this schema into that model 1:1.
    public string Definition => """
    {
      "name": "propose_exercise_image",
      "description": "Propose generating a consistent illustration image for an exercise the user owns (or a global exercise if the user is an admin). Generation only happens after the user explicitly confirms, and an existing image is only replaced after a second explicit apply step.",
      "parameters": {
        "type": "object",
        "properties": {
          "exerciseId": { "type": "integer", "description": "Id of the exercise to illustrate." },
          "styleNotes": { "type": "string", "description": "Optional user style hints, e.g. 'show dumbbell variation'." }
        },
        "required": ["exerciseId"]
      }
    }
    """;

    public bool IsAvailable(AiToolContext context) => true;

    public async Task<AiToolExecutionResult> ExecuteAsync(string argumentsJson, AiToolContext context, CancellationToken cancellationToken)
    {
        var args = AiJsonSerializer.Deserialize<ProposeExerciseImageRequest>(argumentsJson)
            ?? throw new FitMateException("Invalid propose_exercise_image arguments.");

        var proposal = await exerciseImageService.ProposeAsync(
            args, context.UserId, context.ConversationId, context.AiRunId);

        return JsonSerializer.Serialize(new
        {
            actionId = proposal.ActionId,
            status = "pending_confirmation",
            replacesExistingImage = proposal.ReplacesExistingImage,
            message = "Image generation proposed. The user must confirm before the image is generated.",
        }, JsonOptions);
    }
}
```

- [ ] **Step 5: Run tests — expect PASS (8 tests across the two files)**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter "GenerateExerciseImageActionExecutorTests|AiExerciseImageServiceTests"`

- [ ] **Step 6: Commit**

```bash
git add server/FitMate.Services server/FitMate.Tests
git commit -m "feat(ai-images): propose_exercise_image tool and confirm-time generation executor"
```

---

### Task 8: apply-image endpoint + service, controllers, DI (TDD)

**Files:**
- Modify: `server/FitMate.Services/Ai/Images/AiExerciseImageService.cs` (implement `ApplyAsync`)
- Create: `server/FitMate.Web/Controllers/AiExerciseImageController.cs`
- Modify: `server/FitMate.Web/Controllers/AiActionController.cs` (Plan 06 file — add `apply-image` action; verify the actual controller file name for route `api/ai/actions`)
- Modify: `server/FitMate.Web/Program.cs` (DI)
- Test: `server/FitMate.Tests/Unit/Services/AiExerciseImageServiceTests.cs` (Apply tests appended)

**Interfaces:**
- Consumes: Task 7 types, `IExerciseService.UploadImageAsync` (existing pipeline: prefix delete → resize → final blob → `ImageUrl` file name → cache invalidation), `IBlobStorageService.DownloadAsync`, `IPhotoUrlResolver`.
- Produces the HTTP surface Tasks 9–10 consume:

```
POST /api/ai/exercise-image/proposals      body: ProposeExerciseImageRequest → ExerciseImageProposalModel
POST /api/ai/actions/{id}/apply-image      → ExerciseModel   (sets the generated preview as the exercise image)
```

**v1 design note (documented deviation from spec §37's sketch):** the executor never touches `Exercise.ImageUrl`. The preview lives at `exercises/{id}/ai-preview/{guid}` until the user explicitly calls `apply-image`, which downloads the preview and pushes it through the exact `ExerciseService.UploadImageAsync` pipeline a manual photo upload uses — so replacement, old-blob cleanup (prefix delete also sweeps the preview copy), resizing and cache invalidation all reuse existing code. Apply is required even when the exercise has no image yet (uniform UX). Discard is client-side; un-applied previews are swept by the next image upload or Plan 11's cleanup job.

- [ ] **Step 1: Write failing Apply tests** (append to `AiExerciseImageServiceTests.cs`; the harness now needs the executor from Task 7 to produce a real preview first)

```csharp
    // Every component shares ONE AppDbContext instance so tracked entities stay consistent
    // between ExerciseService, the executor and the service under test.
    private sealed class ApplyHarness : IDisposable
    {
        private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

        public SqliteTestDatabase Db { get; } = new();
        public AppDbContext Context { get; }
        public FakeUserService UserService { get; } = FakeUserService.ForUser(SqliteTestDatabase.UserId);
        public FakeBlobStorageService Blobs { get; } = new();
        public FakeImageProcessor ImageProcessor { get; } = new();
        public FakeEntitlementService Entitlements { get; } = new();
        public FakeUsageService Usage { get; } = new();
        public FakeAiImageProvider ImageProvider { get; } = new();
        public GenerateExerciseImageActionExecutor Executor { get; }
        public AiExerciseImageService Service { get; }

        public ApplyHarness()
        {
            Context = Db.CreateContext();
            var exerciseService = new ExerciseService(
                Context,
                new MemoryCache(new MemoryCacheOptions()),
                UserService,
                Blobs,
                ImageProcessor,
                new FakePhotoUrlResolver());
            Executor = new GenerateExerciseImageActionExecutor(
                Context, UserService, Entitlements, Usage, ImageProvider, ImageProcessor, Blobs);
            Service = new AiExerciseImageService(
                Context, UserService, exerciseService, Blobs, new FakePhotoUrlResolver());
        }

        public async Task<(long ExerciseId, AiAction Action)> SeedPendingActionAsync()
        {
            var exercise = new Exercise
            {
                UserId = SqliteTestDatabase.UserId,
                IsPublic = false,
                Name = "My Press",
                Slug = "my-press",
                PrimaryMuscleGroupId = SqliteTestDatabase.ChestId,
            };
            Context.Exercises.Add(exercise);
            await Context.SaveChangesAsync();

            var action = new AiAction
            {
                UserId = SqliteTestDatabase.UserId,
                ActionType = AiActionType.GenerateExerciseImage,
                Status = AiActionStatus.PendingConfirmation,
                PayloadJson = JsonSerializer.Serialize(
                    new GenerateExerciseImagePayload { ExerciseId = exercise.Id }, Web),
            };
            Context.AiActions.Add(action);
            await Context.SaveChangesAsync();
            return (exercise.Id, action);
        }

        public async Task<(long ExerciseId, AiAction Action)> SeedExecutedActionAsync()
        {
            var (exerciseId, action) = await SeedPendingActionAsync();
            await Executor.ExecuteAsync(action, SqliteTestDatabase.UserId, CancellationToken.None);
            return (exerciseId, action);
        }

        public void Dispose()
        {
            Context.Dispose();
            Db.Dispose();
        }
    }

    // Verify FakeImageProcessor's single shared ProcessedImage stream survives two ProcessAsync calls
    // (executor + apply) — the fake's MemoryStream is seekable and FakeBlobStorageService.UploadAsync
    // rewinds it, so it does; if the fake changed, give each call a fresh stream.

    [Fact]
    public async Task Apply_AfterExecute_ReplacesExerciseImage_AndMarksAssetApplied()
    {
        using var h = new ApplyHarness();
        var (exerciseId, action) = await h.SeedExecutedActionAsync();   // seeds exercise + action, runs executor

        Assert.Null(h.Context.Exercises.Single(x => x.Id == exerciseId).ImageUrl);   // precondition

        var model = await h.Service.ApplyAsync(action.Id, SqliteTestDatabase.UserId);

        var exercise = h.Context.Exercises.Single(x => x.Id == exerciseId);
        Assert.False(string.IsNullOrEmpty(exercise.ImageUrl));
        Assert.Equal(exercise.ImageUrl, Path.GetFileName(exercise.ImageUrl));   // bare file name convention
        var asset = h.Context.AiGeneratedAssets.Single();
        Assert.Contains("appliedAt", asset.MetadataJson);
        Assert.Equal($"exercises/{exerciseId}/{exercise.ImageUrl}", asset.BlobPath);
    }

    [Fact]
    public async Task Apply_Twice_IsIdempotent_NoSecondUpload()
    {
        using var h = new ApplyHarness();
        var (exerciseId, action) = await h.SeedExecutedActionAsync();

        await h.Service.ApplyAsync(action.Id, SqliteTestDatabase.UserId);
        var uploadsAfterFirst = h.Blobs.UploadedPaths.Count;
        var imageUrlAfterFirst = h.Context.Exercises.Single(x => x.Id == exerciseId).ImageUrl;

        var model = await h.Service.ApplyAsync(action.Id, SqliteTestDatabase.UserId);

        Assert.Equal(uploadsAfterFirst, h.Blobs.UploadedPaths.Count);
        Assert.Equal(imageUrlAfterFirst, h.Context.Exercises.Single(x => x.Id == exerciseId).ImageUrl);
        Assert.NotNull(model);
    }

    [Fact]
    public async Task Apply_BeforeExecution_Throws()
    {
        using var h = new ApplyHarness();
        var (_, action) = await h.SeedPendingActionAsync();   // no executor run — ResultJson null

        await Assert.ThrowsAsync<FitMateException>(() =>
            h.Service.ApplyAsync(action.Id, SqliteTestDatabase.UserId));
    }

    [Fact]
    public async Task Apply_OtherUsersAction_Throws()
    {
        using var h = new ApplyHarness();
        var (_, action) = await h.SeedExecutedActionAsync();

        await Assert.ThrowsAsync<FitMateException>(() =>
            h.Service.ApplyAsync(action.Id, SqliteTestDatabase.OtherUserId));
    }
```

Add the usings the harness needs: `FitMate.DB`, `FitMate.Services.Ai.Actions`, `FitMate.Services.Exercises`, `Microsoft.Extensions.Caching.Memory`. `SeedExecutedActionAsync` runs the real executor, which uploads the preview into the fake's in-memory `Blobs` dictionary — that is what `ApplyAsync` later downloads.

- [ ] **Step 2: Run — expect FAIL** (`ApplyAsync` throws NotImplementedException)

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter AiExerciseImageServiceTests`

- [ ] **Step 3: Implement `ApplyAsync`** (replace the placeholder in `AiExerciseImageService`; extend the constructor with `IExerciseService exerciseService, IBlobStorageService blobStorage, IPhotoUrlResolver photoUrlResolver`)

```csharp
    public async Task<ExerciseModel> ApplyAsync(long actionId, long userId)
    {
        var action = await dbContext.AiActions.FirstOrDefaultAsync(a => a.Id == actionId && a.UserId == userId)
            ?? throw new FitMateException("Action not found.");

        if (action.ActionType != AiActionType.GenerateExerciseImage)
        {
            throw new FitMateException("This action has no image to apply.");
        }

        if (string.IsNullOrEmpty(action.ResultJson))
        {
            throw new FitMateException("The image has not been generated yet. Confirm the action first.");
        }

        var result = JsonSerializer.Deserialize<GenerateExerciseImageResult>(action.ResultJson, JsonOptions)
            ?? throw new FitMateException("Invalid action result.");

        var asset = await dbContext.AiGeneratedAssets
                .FirstOrDefaultAsync(a => a.Id == result.AssetId && a.UserId == userId)
            ?? throw new FitMateException("Generated image not found.");

        var exercise = await ExerciseImageAuthorization.LoadAuthorizedExerciseAsync(
            dbContext, userService, asset.ExerciseId!.Value, userId);

        // Idempotency: a repeated apply returns the current state without re-uploading.
        if (asset.MetadataJson?.Contains("\"appliedAt\"", StringComparison.Ordinal) == true)
        {
            return await BuildModelAsync(exercise);
        }

        var previewBlobPath = asset.BlobPath;
        var preview = await blobStorage.DownloadAsync(previewBlobPath)
            ?? throw new FitMateException("The preview image is no longer available. Generate a new one.");

        ExerciseModel updated;
        await using (preview)
        {
            // Reuse the standard pipeline: prefix delete (removes old image AND the preview copy),
            // re-encode, upload to exercises/{id}/, set ImageUrl to the bare file name, cache bust.
            updated = await exerciseService.UploadImageAsync(exercise.Id, preview, "ai-illustration");
        }

        asset.BlobPath = $"{StorageModule.Exercises.ToFolder()}/{exercise.Id}/{exercise.ImageUrl}";
        asset.MetadataJson = JsonSerializer.Serialize(new { appliedAt = DateTime.UtcNow }, JsonOptions);
        await dbContext.SaveChangesAsync();

        // The preview copy is gone if prefix delete ran; delete explicitly for the no-previous-image case.
        try
        {
            await blobStorage.DeleteAsync(previewBlobPath);
        }
        catch
        {
            // Best-effort; Plan 11's cleanup job sweeps leftovers.
        }

        return updated;
    }

    private async Task<ExerciseModel> BuildModelAsync(Exercise exercise) => new()
    {
        Id = exercise.Id,
        UserId = exercise.UserId,
        IsPublic = exercise.IsPublic,
        Name = exercise.Name,
        Slug = exercise.Slug,
        Description = exercise.Description,
        ImageUrl = await photoUrlResolver.ResolveAsync(
            BlobPathBuilder.Compose(StorageModule.Exercises, exercise.Id, exercise.ImageUrl)),
        VideoUrl = exercise.VideoUrl,
        PrimaryMuscleGroupId = exercise.PrimaryMuscleGroupId,
        SecondaryMuscleGroupId = exercise.SecondaryMuscleGroupId,
        DateCreated = exercise.DateCreated,
        DateModified = exercise.DateModified,
    };
```

Add usings: `FitMate.Services.Exercises`, `FitMate.Services.Storage.Blobs`, `FitMate.Services.Storage.Urls`, `Microsoft.EntityFrameworkCore`.

Note: `ExerciseService.UploadImageAsync` authorizes via `IUserService.LoggedInUserId` — the apply endpoint runs in the caller's HTTP context, so this holds; in tests `FakeUserService.ForUser(...)` supplies it.

- [ ] **Step 4: Run — expect PASS (8 tests in the file)**

Run: `dotnet test server/FitMate.Tests/FitMate.Tests.csproj --filter AiExerciseImageServiceTests`

- [ ] **Step 5: Controllers + DI**

`AiExerciseImageController.cs`:

```csharp
using FitMate.Core.JsonModels.Ai;
using FitMate.DB;
using FitMate.Services.Ai.Images;
using FitMate.Services.Users;
using FitMate.Web.Controllers.Base;
using FitMate.Web.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FitMate.Web.Controllers;

[Authorize]
[Route("api/ai/exercise-image")]
public class AiExerciseImageController : BaseApiController
{
    private readonly IAiExerciseImageService exerciseImageService;

    public AiExerciseImageController(
        ILogger<BaseApiController> logger,
        AppDbContext dbContext,
        IUserService userService,
        IAiExerciseImageService exerciseImageService)
        : base(logger, dbContext, userService)
    {
        this.exerciseImageService = exerciseImageService;
    }

    [HttpPost("proposals")]
    public async Task<ActionResult> Propose([FromBody] ProposeExerciseImageRequest request)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var proposal = await exerciseImageService.ProposeAsync(request, userId.Value);
        return this.ReturnJson(proposal);
    }
}
```

In Plan 06's `api/ai/actions` controller add (inject `IAiExerciseImageService`; verify the file name and ctor pattern of that controller at execution time):

```csharp
    [HttpPost("{id}/apply-image")]
    public async Task<ActionResult> ApplyImage(long id)
    {
        var userId = UserService.LoggedInUserId;
        if (!userId.HasValue)
        {
            return this.ReturnJsonError("Unauthorized.");
        }

        var model = await aiExerciseImageService.ApplyAsync(id, userId.Value);
        return this.ReturnJson(model);
    }
```

In `Program.cs` (next to Plans 05/06 AI registrations — match their pattern for multi-registration of tool handlers/executors):

```csharp
builder.Services.AddScoped<IAiExerciseImageService, AiExerciseImageService>();
builder.Services.AddScoped<IAiActionExecutor, GenerateExerciseImageActionExecutor>();
builder.Services.AddScoped<IAiToolHandler, ProposeExerciseImageToolHandler>();
```

- [ ] **Step 6: Build, regenerate types, full suite**

Run: `dotnet build server/FitMate.Web/FitMate.Web.csproj`
Then: `cd client && npm run process-types && npx tsc -b --noEmit`
Then: `dotnet test server/FitMate.sln`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add server/FitMate.Services server/FitMate.Web server/FitMate.Tests client/src/types
git commit -m "feat(ai-images): apply-image endpoint reusing the exercise upload pipeline"
```

---

### Task 9: Frontend — "Identify from photo" flow

**Files:**
- Create: `client/src/lib/subscriptionErrors.ts`, `client/src/services/aiVisionService.ts`, `client/src/shared/components/IdentifyExerciseModal.tsx`
- Modify: `client/src/types/index.ts` (alias exports), `client/src/shared/components/index.ts` (export the modal), `client/src/pages/Profile/hooks/useMyExercisesPage.ts`, `client/src/pages/Profile/MyExercises.tsx`, `client/src/components/workout/ExercisePickerModal.tsx`

**Interfaces:**
- Consumes: generated types (`JsonModels.Ai.*` from Task 6/8 builds), `api` axios instance, `unwrap`, existing `AddExerciseModal` prefill mechanism (`ExerciseFormValues`).
- Produces: `aiVisionService.recognizeExercise/proposeExerciseImage/confirmAction/applyExerciseImage`, `IdentifyExerciseModal`, `getSubscriptionLimitMessage` — Task 10 reuses all three.

- [ ] **Step 1: Type aliases** — append to `client/src/types/index.ts` (alphabetical position, matching the existing style):

```ts
export type ExerciseImageProposal = JsonModels.Ai.ExerciseImageProposalModel;
export type ExerciseRecognitionCandidate = JsonModels.Ai.ExerciseRecognitionCandidateModel;
export type ExerciseRecognitionResult = JsonModels.Ai.ExerciseRecognitionResult;
export type GenerateExerciseImageResult = JsonModels.Ai.GenerateExerciseImageResult;
```

> Plan 06 should already export an `AiAction` alias (e.g. `export type AiAction = JsonModels.Ai.AiActionModel;`) — verify and add it only if missing.

- [ ] **Step 2: Limit-error helper** — `client/src/lib/subscriptionErrors.ts`:

```ts
import { AxiosError } from "axios";

type SubscriptionLimitPayload = {
  code?: string;
  feature?: string;
  limit?: number;
  used?: number;
  reserved?: number;
  resetsAt?: string;
  upgradeAvailable?: boolean;
};

// Spec §49 envelope produced by Plan 04: HTTP 403 (feature not in plan) / 429 (quota exhausted).
export function getSubscriptionLimitMessage(error: unknown): string | null {
  if (!(error instanceof AxiosError)) {
    return null;
  }

  const status = error.response?.status;
  if (status !== 403 && status !== 429) {
    return null;
  }

  const payload = error.response?.data as SubscriptionLimitPayload | undefined;
  if (payload?.code !== "subscription_limit_reached") {
    return null;
  }

  return status === 403
    ? "This AI feature is not included in your current plan. Upgrade to use it."
    : "You have reached your AI usage limit for this period. Upgrade for more, or wait for the reset.";
}
```

> Verify the payload nesting against Plan 04's actual limit-error response (the `code` field may sit at the top level or under an `error` key) and adjust the cast accordingly.

- [ ] **Step 3: Service** — `client/src/services/aiVisionService.ts`:

```ts
import api from "@/lib/api";
import type {
  AiAction,
  Exercise,
  ExerciseImageProposal,
  ExerciseRecognitionResult,
  JsonData,
} from "@/types";

export const aiVisionService = {
  async recognizeExercise(file: File, description?: string, equipmentContext?: string) {
    const form = new FormData();
    form.append("file", file);
    if (description) {
      form.append("description", description);
    }
    if (equipmentContext) {
      form.append("equipmentContext", equipmentContext);
    }

    return api.post<JsonData<ExerciseRecognitionResult>>("ai/exercise-recognition", form);
  },

  async proposeExerciseImage(exerciseId: number, styleNotes?: string) {
    return api.post<JsonData<ExerciseImageProposal>>("ai/exercise-image/proposals", {
      exerciseId,
      styleNotes,
    });
  },

  // Plan 06's confirm endpoint runs the GenerateExerciseImage executor synchronously.
  // Verify: if Plan 06 already ships an aiActionService with confirm/reject, re-export and use it
  // instead of duplicating the call here.
  async confirmAction(actionId: number) {
    return api.post<JsonData<AiAction>>(`ai/actions/${actionId}/confirm`);
  },

  async applyExerciseImage(actionId: number) {
    return api.post<JsonData<Exercise>>(`ai/actions/${actionId}/apply-image`);
  },
};
```

- [ ] **Step 4: `IdentifyExerciseModal`** — `client/src/shared/components/IdentifyExerciseModal.tsx` (export it from `shared/components/index.ts` alongside the existing modals):

```tsx
import { useEffect, useMemo, useState } from "react";
import { unwrap } from "@/lib/unwrap";
import { getSubscriptionLimitMessage } from "@/lib/subscriptionErrors";
import { aiVisionService } from "@/services/aiVisionService";
import type { ExerciseRecognitionResult } from "@/types";
import { Modal } from "./Modal";

type IdentifyExerciseModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelectExercise: (exerciseId: number) => void;
  /** Omit to hide the "Create new exercise" path (e.g. inside the workout picker). */
  onCreateFromDetection?: (result: ExerciseRecognitionResult) => void;
};

export function IdentifyExerciseModal({
  isOpen,
  onClose,
  onSelectExercise,
  onCreateFromDetection,
}: IdentifyExerciseModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<ExerciseRecognitionResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setDescription("");
      setResult(null);
      setError(null);
    }
  }, [isOpen]);

  const analyze = async () => {
    if (!file || isAnalyzing) {
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    try {
      const response = await aiVisionService.recognizeExercise(
        file,
        description.trim() || undefined,
      );
      setResult(unwrap(response.data, "Could not identify the exercise."));
    } catch (analyzeError) {
      setError(
        getSubscriptionLimitMessage(analyzeError) ??
          (analyzeError instanceof Error ? analyzeError.message : "Could not identify the exercise."),
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Identify from photo" maxWidth="2xl">
      <div className="space-y-4 p-5">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="block w-full text-sm text-secondary"
        />

        {previewUrl && (
          <img
            src={previewUrl}
            alt="Selected exercise"
            className="max-h-64 w-full rounded-xl object-contain"
          />
        )}

        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Optional: describe the machine or movement"
          rows={2}
          className="liquid-pill w-full rounded-xl p-3 text-sm text-foreground"
        />

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="button"
          disabled={!file || isAnalyzing}
          onClick={analyze}
          className="w-full rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isAnalyzing ? "Analyzing..." : "Identify exercise"}
        </button>

        {result && (
          <div className="space-y-3">
            <p className="text-sm text-secondary">
              Detected: <span className="font-semibold text-foreground">{result.detectedExerciseName || "Unknown"}</span>
              {" "}({Math.round(result.confidence * 100)}% confident)
            </p>

            {result.candidates.length > 0 && (
              <ul className="space-y-2">
                {result.candidates.map((candidate) => (
                  <li key={candidate.exerciseId}>
                    <button
                      type="button"
                      onClick={() => onSelectExercise(candidate.exerciseId)}
                      className="liquid-pill flex w-full items-center justify-between rounded-xl px-4 py-2 text-left text-sm"
                    >
                      <span className="font-medium text-foreground">{candidate.name}</span>
                      <span className="text-xs text-tertiary">
                        {Math.round(candidate.matchScore * 100)}% match
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {onCreateFromDetection && (
              <button
                type="button"
                onClick={() => onCreateFromDetection(result)}
                className="liquid-pill w-full rounded-full px-4 py-2 text-sm font-semibold text-secondary"
              >
                Create new private exercise from this
              </button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
```

> Verify `Modal`'s prop names (`isOpen`/`onClose`/`title`/`maxWidth`) against `client/src/shared/components/Modal.tsx` and the button/utility class names against neighboring components (`liquid-pill`, `text-tertiary` are in use in `ExercisePickerModal`) — align, don't invent new styles.

- [ ] **Step 5: Wire into My Exercises** — in `useMyExercisesPage.ts` add state + actions (concrete additions; keep existing code untouched):

```ts
  const [isIdentifyOpen, setIsIdentifyOpen] = useState(false);

  const openIdentify = useCallback(() => setIsIdentifyOpen(true), []);
  const closeIdentify = useCallback(() => setIsIdentifyOpen(false), []);

  const createFromDetection = useCallback((result: ExerciseRecognitionResult) => {
    setIsIdentifyOpen(false);
    setEditingId(null);
    setFormValues({
      ...emptyExerciseFormValues,
      name: result.detectedExerciseName,
      description: result.notes ?? "",
      isPublic: false,   // spec §36: prefilled create flow makes a PRIVATE exercise
    });
    setEditorError(null);
    setIsEditorOpen(true);
  }, []);

  const selectRecognizedExercise = useCallback(
    (exerciseId: number) => {
      setIsIdentifyOpen(false);
      const match = exercises.find((item) => item.id === exerciseId);
      if (match) {
        openEdit(match);
      } else {
        setSearchInput("");
        reload();
      }
    },
    [exercises, openEdit, reload],
  );
```

Expose `isIdentifyOpen` in `state` and `openIdentify`, `closeIdentify`, `createFromDetection`, `selectRecognizedExercise` in `actions` (add them to both `useMemo` dependency lists). Import `ExerciseRecognitionResult` from `@/types`.

In `MyExercises.tsx`: add an "Identify from photo" button next to the existing "create" button (mirror its styling) calling `actions.openIdentify`, and render at the end:

```tsx
      <IdentifyExerciseModal
        isOpen={state.isIdentifyOpen}
        onClose={actions.closeIdentify}
        onSelectExercise={actions.selectRecognizedExercise}
        onCreateFromDetection={actions.createFromDetection}
      />
```

> Verify the exact insertion points in `MyExercises.tsx` at execution time — put the button in the same toolbar as the create button and the modal next to the existing `AddExerciseModal` render.

- [ ] **Step 6: Wire into the exercise picker** — in `ExercisePickerModal.tsx` add:

```tsx
  const [isIdentifyOpen, setIsIdentifyOpen] = useState(false);
```

a trigger button in the filter/header area:

```tsx
        <button
          type="button"
          onClick={() => setIsIdentifyOpen(true)}
          className="liquid-pill px-3 py-1 text-xs font-semibold text-secondary hover:text-foreground"
        >
          Identify from photo
        </button>
```

and after the main modal markup:

```tsx
      <IdentifyExerciseModal
        isOpen={isIdentifyOpen}
        onClose={() => setIsIdentifyOpen(false)}
        onSelectExercise={(exerciseId) => {
          setIsIdentifyOpen(false);
          handleSelect(exerciseId);
        }}
      />
```

(`handleSelect` already calls `onSelect` + `onClose`; no `onCreateFromDetection` here — candidates only.)

- [ ] **Step 7: Lint + typecheck**

Run: `cd client && npm run lint && npx tsc -b --noEmit`
Expected: clean. Fix any errors before finishing.

- [ ] **Step 8: Commit**

```bash
git add client/src
git commit -m "feat(ai-vision): identify-from-photo flow in My Exercises and exercise picker"
```

---

### Task 10: Frontend — ExerciseImageProposalCard + "Generate illustration"

**Files:**
- Create: `client/src/hooks/useExerciseImageGeneration.ts`, `client/src/shared/components/ExerciseImageProposalCard.tsx`
- Modify: `client/src/shared/components/index.ts`, `client/src/pages/Profile/hooks/useMyExercisesPage.ts`, `client/src/pages/Profile/MyExercises.tsx`
- Modify (verify file): Plan 06's AI chat action-card registry — register the card for `GenerateExerciseImage` actions

**Interfaces:**
- Consumes: `aiVisionService`, `getSubscriptionLimitMessage`, `GenerateExerciseImageResult` type (Task 9).
- Produces: `ExerciseImageProposalCard` (also consumed by Plan 06's chat action rendering), `useExerciseImageGeneration`.

- [ ] **Step 1: Generation hook** — `client/src/hooks/useExerciseImageGeneration.ts`:

```ts
import { useCallback, useState } from "react";
import { unwrap } from "@/lib/unwrap";
import { getSubscriptionLimitMessage } from "@/lib/subscriptionErrors";
import { aiVisionService } from "@/services/aiVisionService";
import type { GenerateExerciseImageResult } from "@/types";

type PreviewState = {
  actionId: number;
  exerciseId: number;
  preview: GenerateExerciseImageResult;
};

export function useExerciseImageGeneration(onApplied: () => void) {
  const [generatingExerciseId, setGeneratingExerciseId] = useState<number | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (exerciseId: number, styleNotes?: string) => {
    setGeneratingExerciseId(exerciseId);
    setError(null);
    try {
      const proposal = unwrap(
        (await aiVisionService.proposeExerciseImage(exerciseId, styleNotes)).data,
        "Could not start image generation.",
      );
      // Confirm runs the generation (costs one AiImageGeneration credit).
      const action = unwrap(
        (await aiVisionService.confirmAction(proposal.actionId)).data,
        "Image generation failed.",
      );
      // resultJson is camelCase (JsonSerializerDefaults.Web on the server).
      // Verify the property name (resultJson) against the generated AiActionModel type.
      const preview = JSON.parse(action.resultJson ?? "null") as GenerateExerciseImageResult | null;
      if (!preview) {
        throw new Error("Image generation returned no preview.");
      }
      setPreviewState({ actionId: proposal.actionId, exerciseId, preview });
    } catch (generationError) {
      setError(
        getSubscriptionLimitMessage(generationError) ??
          (generationError instanceof Error ? generationError.message : "Image generation failed."),
      );
    } finally {
      setGeneratingExerciseId(null);
    }
  }, []);

  const apply = useCallback(async () => {
    if (!previewState) {
      return;
    }

    setIsApplying(true);
    setError(null);
    try {
      unwrap(
        (await aiVisionService.applyExerciseImage(previewState.actionId)).data,
        "Could not apply the image.",
      );
      setPreviewState(null);
      onApplied();
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "Could not apply the image.");
    } finally {
      setIsApplying(false);
    }
  }, [onApplied, previewState]);

  const discard = useCallback(() => {
    // v1: discard is client-side only. The un-applied preview blob is swept by the next image
    // upload for that exercise or by Plan 11's cleanup job.
    setPreviewState(null);
    setError(null);
  }, []);

  return { generatingExerciseId, isApplying, previewState, error, generate, apply, discard };
}
```

- [ ] **Step 2: The card** — `client/src/shared/components/ExerciseImageProposalCard.tsx` (export from `shared/components/index.ts`):

```tsx
type ExerciseImageProposalCardProps = {
  exerciseName: string;
  previewUrl: string;
  replacesExistingImage: boolean;
  isApplying: boolean;
  error: string | null;
  onApply: () => void;
  onDiscard: () => void;
};

export function ExerciseImageProposalCard({
  exerciseName,
  previewUrl,
  replacesExistingImage,
  isApplying,
  error,
  onApply,
  onDiscard,
}: ExerciseImageProposalCardProps) {
  return (
    <div className="space-y-3 rounded-2xl border border-white/10 p-4">
      <p className="text-sm font-semibold text-foreground">
        Generated illustration for {exerciseName}
      </p>

      <img
        src={previewUrl}
        alt={`Generated illustration for ${exerciseName}`}
        className="max-h-72 w-full rounded-xl bg-white object-contain"
      />

      {replacesExistingImage && (
        <p className="text-xs text-tertiary">
          Applying will replace the current exercise image.
        </p>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={isApplying}
          onClick={onApply}
          className="flex-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isApplying ? "Applying..." : "Apply"}
        </button>
        <button
          type="button"
          disabled={isApplying}
          onClick={onDiscard}
          className="liquid-pill flex-1 rounded-full px-4 py-2 text-sm font-semibold text-secondary"
        >
          Discard
        </button>
      </div>
    </div>
  );
}
```

> Match container/button classes to the shared card styles in use (check `WorkoutPrimitives.tsx` and neighboring components) — keep this file free of new one-off styles.

- [ ] **Step 3: "Generate illustration" on own exercises** — in `useMyExercisesPage.ts`:

```ts
  const imageGeneration = useExerciseImageGeneration(() => {
    invalidateExerciseLookupCache();
    reload();
  });
```

Expose `imageGeneration` from the hook's return value (add to `state`/`actions` or return it as a third member — keep it one object: `return { state, actions, imageGeneration };`).

In `MyExercises.tsx`, add a per-row action "Generate illustration" for exercises owned by the user (same menu/button group as Edit/Delete/Image):

```tsx
        <button
          type="button"
          disabled={imageGeneration.generatingExerciseId === exercise.id}
          onClick={() => imageGeneration.generate(exercise.id)}
          className="text-xs font-semibold text-primary disabled:opacity-50"
        >
          {imageGeneration.generatingExerciseId === exercise.id ? "Generating..." : "Generate illustration"}
        </button>
```

and render the preview card (plus the limit-error message when generation was blocked) near the top of the list:

```tsx
      {imageGeneration.error && !imageGeneration.previewState && (
        <p className="text-sm text-red-500">{imageGeneration.error}</p>
      )}

      {imageGeneration.previewState && (
        <ExerciseImageProposalCard
          exerciseName={
            state.exercises.find((item) => item.id === imageGeneration.previewState?.exerciseId)?.name ?? "exercise"
          }
          previewUrl={imageGeneration.previewState.preview.previewUrl}
          replacesExistingImage={imageGeneration.previewState.preview.replacesExistingImage}
          isApplying={imageGeneration.isApplying}
          error={imageGeneration.error}
          onApply={imageGeneration.apply}
          onDiscard={imageGeneration.discard}
        />
      )}
```

> Verify the row-action insertion point against the actual `MyExercises.tsx` markup at execution time.

- [ ] **Step 4: Register the card for chat actions** — in Plan 06's action-card registry (the component that switches on `actionType` to render proposal cards in the AI chat), render `ExerciseImageProposalCard` for `GenerateExerciseImage` actions whose `resultJson` is set, parsing it as `GenerateExerciseImageResult` and wiring Apply to `aiVisionService.applyExerciseImage(action.id)`. Verify the registry file (expected under the AI chat page Plan 06 created) and follow its existing per-action-type pattern exactly.

- [ ] **Step 5: Lint + typecheck + full backend suite**

Run: `cd client && npm run lint && npx tsc -b --noEmit`
Then: `dotnet test server/FitMate.sln`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add client/src
git commit -m "feat(ai-images): generate-illustration flow with preview card and apply/discard"
```

---

## Acceptance criteria (Plan 10 done)

- **Recognition (spec §36):** `POST /api/ai/exercise-recognition` accepts multipart jpeg/png/webp ≤ 10 MB, rejects bad type/size before any side effects, re-encodes through `ImageSharpImageProcessor` (bomb guard), stages the processed image under `ai-temp/{userId}/{guid}`, gates on `SubscriptionFeature.AiExerciseRecognition`, reserves → calls the vision provider through neutral `IAiCompletionProvider` with image content → commits on success / releases on failure, parses fenced-or-plain JSON tolerantly, and returns `ExerciseRecognitionResult` with alias-matched candidates (top 5, scored). An `AiGeneratedAsset` (`RecognitionUpload`) row records provider, model, prompt version, SHA256 prompt hash and blob path; the temp blob is best-effort deleted after the response (Plan 11's retention job is the backstop).
- **Image generation (spec §37):** `propose_exercise_image` (tool + `POST /api/ai/exercise-image/proposals`) creates a `GenerateExerciseImage` `AiAction` in `PendingConfirmation`; ownership enforced — personal exercises by owner only, global exercises by admins only, both at proposal AND execution time. Generation happens only at confirm time inside `GenerateExerciseImageActionExecutor`: entitlement + reservation on `AiImageGeneration`, consistent `exercise-image-v1` prompt template with name/equipment/movement substitutions, image processed through the existing pipeline, preview uploaded under `exercises/{id}/ai-preview/`, `AiGeneratedAsset` (`ExerciseImage`) recorded with prompt hash + model, `AiJob` row recorded (Completed/Failed), usage committed on success / released on failure. The exercise image is **not** changed by generation.
- **Explicit apply:** `POST /api/ai/actions/{id}/apply-image` is the only way the generated image becomes the exercise image — it reuses `ExerciseService.UploadImageAsync` (replacement, cleanup, cache invalidation). Repeat apply calls and repeat confirms are idempotent (no second generation, no second upload).
- **Entities:** migration `AddAiGeneratedAssetsAndJobs` creates `AiGeneratedAssets` + `AiJobs` exactly per spec §7.7/§67 shapes; v1 uses `AiJob` as a synchronous audit record for Plan 11's retry job.
- **Frontend:** "Identify from photo" in My Exercises and the exercise picker (upload → candidates → select existing OR prefill the private create-exercise form with detected metadata); "Generate illustration" button on own exercises; `ExerciseImageProposalCard` with preview + Apply/Discard; subscription-limit errors render a friendly upgrade message (spec §49 envelope).
- **Tests:** fake `IAiImageProvider` + fake vision responses cover: upload validation (type/size), entitlement gate, alias-matched candidates, usage commit/release on both flows, temp-blob asset recording, non-owner rejected, admin-only for global, confirm-time generation storing prompt hash, apply-only replacement, double-confirm and double-apply idempotency.
- **Quality gates:** `dotnet build server/FitMate.sln`, `dotnet test server/FitMate.sln`, `cd client && npm run lint && npx tsc -b --noEmit` all green; generated `backend.ts` contains the new `JsonModels.Ai` types; no OpenAI SDK reference outside `server/FitMate.Integrations` (roadmap D6).
