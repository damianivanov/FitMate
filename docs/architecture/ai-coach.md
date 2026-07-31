# AI coach

The coach is a bounded tool loop. The model can read the user's training data through an explicit
allow-list of tools, and it can *propose* changes — but it can never write domain data directly. Every
write goes through a proposal the user confirms in the UI.

Two invariants drive the whole design:

1. **The model cannot write.** Proposal tools create an `AIAction` row and stop. A matching executor
   does the writing only after the user confirms.
2. **The loop cannot run away.** Iterations, total tool calls, wall-clock time and conversation
   history are all capped, and the quota reserved up front is either committed exactly once or
   released exactly once.

---

## Layout

```
FitMate.Integrations/AI/
  Abstractions/      IAICompletionProvider, IAIImageProvider
  Models/            AICompletionRequest/Response, AIProviderMessage, AIProviderToolCall, AIProviderUsage
  OpenAI/            OpenAICompletionProvider, OpenAIImageProvider, options, DI extension
  Serialization/     AIJsonSerializer — one shared JSON configuration

FitMate.Services/AI/
  AIOrchestrator          the loop (the file to read first)
  AIConversationService   conversations and messages, ownership, history window
  AIRunService            per-run audit row: tokens, cost, status, tool-call count
  AIContextBuilder        system prompt + replayed history → provider messages
  AIPromptBuilder         the system prompt and its version stamp
  AIModelRouter           config name → model id
  AICostCalculator        token counts → money, via AIModelPricing
  AIRedactionService      strips secrets before anything is persisted
  Tools/                  registry, context, definitions, handlers
  Unsupported/            "FitMate can't do that yet" backlog

FitMate.Services/AIActions/
  AIActionService         pending → confirm/reject state machine
  Executors/              one executor per AIActionType — the only code that writes
  AIProposalValidator, ProgramPlanProposalValidator
```

---

## The message flow

`POST /api/ai/conversations/{id}/messages` → `AIController.SendMessage` → `AIOrchestrator.SendAsync`.
That one method is the spine of the feature ([AIOrchestrator.cs](../../server/FitMate.Services/AI/AIOrchestrator.cs)):

```
 1  RequireFeatureAsync(userId, AIChat)          plan gate      → 403 if the plan lacks AI chat
 2  ReserveAsync(userId, AIChat, 1)              quota gate     → 429 if the monthly limit is spent
 3  AddUserMessageAsync(conversationId, ...)     ownership check happens here, before any run row
 4  runService.StartAsync(...)                   audit row opens: provider, model, prompt version
 5  contextBuilder.BuildAsync(...)               system prompt + last N user/assistant messages
 6  toolRegistry.GetDefinitions(toolContext)     only tools available to THIS user
 ─────────────────────────────────────────────── loop, at most MaximumToolIterations (6)
 7      completionProvider.CompleteAsync(...)    the only network call, under a 90s CTS
 8      runService.AddUsageAsync(...)            tokens accumulate per iteration, not just at the end
 9      no tool calls?  → persist assistant message, CompleteAsync(run), CommitAsync(reservation), RETURN
10      too many tool calls? → MarkLimitExceeded, ReleaseAsync(reservation), throw
11      for each tool call: toolRegistry.ExecuteAsync(...)
12          persist the call and its result as AIMessage rows (audit)
13          append both to `messages` so the model sees the result next iteration
 ───────────────────────────────────────────────
14  fell out of the loop → MarkLimitExceeded, ReleaseAsync(reservation), throw
```

Order matters in steps 1–2: the plan gate runs before the quota gate, and both run before any
provider call, so a user without the feature never costs money. Steps 9/10/14 are the only exits, and
each one finalises the reservation exactly once. The `catch` at the bottom releases the reservation
for any other failure, so a provider outage does not silently consume a user's quota.

### Limits

All from `AIOptions` (`appsettings.json`, section `AI`):

| Setting | Default | Enforced in |
|---|---|---|
| `TimeoutSeconds` | 90 | `CancellationTokenSource` wrapping the whole loop |
| `MaximumToolIterations` | 6 | loop bound |
| `MaximumToolCallsPerRun` | 12 | running total across iterations |
| `MaximumConversationMessages` | 30 | history window in `AIContextBuilder` |
| `StoreRawProviderPayload` | false | whether raw provider JSON is kept on the run |

### Context assembly

`AIContextBuilder` is deliberately thin: system prompt, then the last N user/assistant messages.
**Tool traffic is persisted but never replayed from history** — tool calls and results are appended to
the in-memory `messages` list during the run that produced them, and dropped afterwards. Without this
the context would grow without bound and the model would re-read stale tool output on later turns.

There is no training-data snapshot in the prompt. The model pulls what it needs through the read-only
tools, which keeps the prompt small and means every data access is logged as a tool execution.

---

## Tools

`AIToolRegistry` is the allow-list. Registration in `AIToolServiceCollectionExtensions` is explicit
rather than assembly-scanned, so **adding a handler class cannot widen what the AI can do by
accident** — it must also be named in that file.

Every attempt writes an `AIToolExecution` row (arguments, result, status, duration, error), redacted
before it is stored. A tool the registry does not know is recorded as `Rejected` and the failure is
handed back to the model rather than killing the run — the model can then apologise or try another
route. The same is true of a handler that throws.

### Read-only tools

Execute immediately, enforce ownership from `AIToolContext.UserId`, require no confirmation.

`get_training_profile` · `get_active_program` · `get_program_calendar` · `get_subscription_usage` ·
`search_exercises` · `get_recent_workouts` · `get_exercise_history` · `get_workout_templates`

### Proposal tools

Write nothing. They validate, look for duplicates, create a pending `AIAction`, and return
`requiresConfirmation: true` with the action id.

`propose_exercise` · `propose_workout` · `propose_workout_template` · `propose_program_plan` ·
`propose_program_update`

`ProposeExerciseToolHandler` shows the pattern worth copying: it forces `payload.IsGlobal = false`
before validating, so **the model cannot choose to create a global exercise** no matter what it sends —
only the admin-only endpoint does that. Scope decisions are never left to model output.

### Feedback tool

`report_unsupported_request` writes only to the admin backlog, so it needs no confirmation.
`UnsupportedRequestKeyNormalizer` collapses similar asks onto one row with an occurrence count, so the
backlog ranks by demand instead of filling with near-duplicates.

---

## Proposals: the confirmation flow

```
  model calls propose_*                    AIAction: PendingConfirmation, ExpiresAt = now + 24h
        │                                  ─ preview + validation summary stored as one jsonb blob
        ▼
  orchestrator returns the action with the assistant message
        │
        ▼
  user sees an ActionCard in the UI
        │
        ├── POST /api/ai/actions/{id}/confirm
        │        │
        │        ▼
        │   AIActionService.ConfirmAsync
        │     · Executed already?     → return the original result, do not run twice
        │     · Rejected/Expired?     → FitMateException
        │     · past ExpiresAt?       → mark Expired, throw
        │     · claim: Status = Executing, Version++  ← concurrency token decides parallel confirms
        │     · executor.ExecuteAsync(...)  ← the ONLY code that writes domain data
        │     · Executed + ResultJson, or Failed + FailureReason
        │
        └── POST /api/ai/actions/{id}/reject   → Rejected
```

The claim-then-execute split is the important part. Two taps on *Confirm* both load the row, but only
one wins the `Version` check; the loser reloads and either returns the winner's result or throws
`AIActionAlreadyExecutedException`. Without it, a double-tap creates two program plans.

Expiry is lazy — `ExpireIfDueAsync` runs on read and on confirm. There is no job (plan 11 was not
built), so an action expires the next time someone looks at it, not on a timer.

One executor per `AIActionType`, resolved from a dictionary built at construction:

| `AIActionType` | Executor | Writes |
|---|---|---|
| `CreatePersonalExercise` / `CreateGlobalExercise` | `CreateExerciseActionExecutors` | `Exercises` (+ aliases) |
| `CreateWorkout` / `CreateWorkoutTemplate` | `CreateWorkoutActionExecutors` | `Workouts` / `WorkoutTemplates` |
| `CreateProgramPlan` | `CreateProgramPlanActionExecutor` | `ProgramPlans` (+ rules, days) |
| `UpdateProgramPlan` | `UpdateProgramPlanActionExecutor` | reshapes an active plan |
| `GenerateExerciseImage` | **none** | declared but not implemented |

---

## Redaction

`AIRedactionService` runs over tool arguments, tool results and exception messages before they are
persisted. It is key-based first (`"password": …` is caught even when the value looks harmless), then
value-based: JWTs, `Bearer` headers, Stripe and OpenAI key shapes, connection-string fragments, blob
SAS signatures, cookies, long hex secrets.

It protects **the audit trail**, not the provider call — it runs on the way into the database, not on
the way out to OpenAI. Data sent to the model is controlled by which tools exist and what they return.

---

## Auditing

Three tables reconstruct any conversation:

- **`AIRuns`** — one per user message. Provider, model, prompt version, status, token counts, computed
  cost, tool-call count, failure reason. `AICostCalculator` prices tokens from `AIModelPricing` rows,
  so re-pricing history means updating a table, not a constant.
- **`AIToolExecutions`** — one per tool attempt, with duration and outcome.
- **`AIMessages`** — the conversation, including tool calls and results (audit only; not replayed).

The admin surfaces built on these are covered in
[admin-and-observability.md](admin-and-observability.md).

---

## Frontend

`client/src/pages/AICoach/` — `useAICoachPage.ts` holds the state; `ActionCard.tsx` renders a pending
proposal with its preview lines, warnings and duplicate candidates, and calls confirm/reject;
`ToolActivityIndicator.tsx` surfaces the `usedTools` the send response returns, so the user can see
that the coach looked at their history rather than guessing.

API access goes through `client/src/services/aiService.ts` using generated types only.
