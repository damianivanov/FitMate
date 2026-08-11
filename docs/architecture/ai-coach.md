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

Sending a message and answering it are two separate jobs. The request only enqueues; a worker does
the work. That is what lets a run survive the user navigating away, refreshing, or the backend
restarting mid-answer.

```
POST /api/ai/conversations/{id}/messages   →  AIRunStarter.StartAsync   →  202 Accepted { runId }
                                                       │
                                                       ▼
                                              AIRun (Queued) in Postgres
                                                       │
        AIRunWorkerHostedService.ClaimNextAsync ────────┘
                        │
                        ▼
              AIOrchestrator.ProcessAsync    →  provider + tools  →  terminal state
                        │
                        ▼
   GET /api/ai/runs/{runId}          (snapshot, also the polling fallback)
   GET /api/ai/runs/{runId}/events   (SSE, replays from a cursor)
```

### Enqueue

[`AIRunStarter`](../../server/FitMate.Services/AI/Runs/AIRunStarter.cs) does everything that can
reject the request, before a worker or a provider is involved:

```
1  duplicate ClientRequestId?      → return the existing run, charge nothing
2  RequireFeatureAsync(AIChat)     plan gate   → 403 if the plan lacks AI chat
3  ResolveAsync(userId)            budget snapshot, frozen onto the run
4  conversation.ActiveRunId set?   → 409, one active run per conversation
─────────────────────────────────── one transaction
5      ReserveAsync(AIChat, 1)     quota gate  → 429 if the monthly limit is spent
6      AddUserMessageAsync(...)    ownership is enforced here
7      insert AIRun (Queued)       links the message, the reservation and the budget
8      claim ActiveRunId           conditional update; loser rolls back
9      publish run_queued
───────────────────────────────────
```

The transaction matters: a visible user message with neither a run nor a recoverable reservation is
the one state a user cannot get themselves out of.

### Claim

[`AIRunQueue`](../../server/FitMate.Services/AI/Runs/AIRunQueue.cs) hands one run to one worker. Every
contended transition is a single conditional `UPDATE` whose affected-row count decides the winner, so
two workers can never both own a run. A lease (`LeaseOwner`, `LeaseExpiresAt`) is renewed before each
provider call; if renewal fails the worker stops touching the run immediately.

This is deliberately not `FOR UPDATE SKIP LOCKED`: the test suite runs on SQLite, and a claim path the
tests cannot exercise is not worth the throughput it would buy at one worker.

### Process

`AIOrchestrator.ProcessAsync` runs the bounded tool loop:

```
 1  load run, verify lease still ours       → return silently if another worker took it
 2  budget from ExecutionBudgetJson         a settings change mid-queue cannot alter a live run
 3  publish run_started
 4  contextBuilder.BuildAsync(...)          summary + last N user/assistant messages
 ─────────────────────────────────────────── loop, at most MaximumToolIterations (6)
 5      RenewLeaseAsync(...)                lost lease → stop without writing a terminal state
 6      publish provider_thinking / response_composing
 7      completionProvider.CompleteAsync    the only network call, under the budget's timeout
 8      runService.AddUsageAsync(...)       tokens accumulate per iteration
 9      no tool calls? → persist assistant message, Complete, Commit, run_completed, RETURN
10      too many tool calls? → MarkLimitExceeded, Release, notice, run_limited, RETURN
11      MarkSideEffectsAsync                before the first tool, not after
12      for each tool call: toolRegistry.ExecuteAsync(...)
 ───────────────────────────────────────────
13  fell out of the loop → MarkLimitExceeded, Release, notice, run_limited
```

Every exit clears `AIConversation.ActiveRunId` and writes exactly one terminal progress event. The
orchestrator does not rethrow: the worker has no caller to surface an exception to, so a failure is
recorded and read back from the snapshot.

### Interruption

`HasSideEffects` is the rule that decides whether an interrupted run can be replayed. It is set
before the first tool executes, so:

| Situation | Handling |
|---|---|
| Lease expired, no tool ran | requeued for a safe retry |
| Lease expired, a tool ran | failed as `run_interrupted`, conversation released |

A run past its first tool call is **never** replayed. Re-running the loop could create a duplicate
proposal or charge generation quota a second time.

### Progress

Progress is derived from stable server codes (`AIProgressCodes`), never from an extra model call, so
it is truthful, cheap and deterministic. An `AIProgressEvent` row carries a code and, for tool
stages, a registered tool name — never arguments, results, IDs, prompts or exception text. The row
`Id` is the replay cursor, which is what makes SSE reconnects and the polling fallback share one
contract.

`AIToolRegistry` publishes tool progress inside the same lifecycle that writes the audit row, so the
two cannot disagree about what the assistant did.

### Limits

All from `AIOptions` (`appsettings.json`, section `AI`), overridable by a stored `AISettings` row:

| Setting | Default | Enforced in |
|---|---|---|
| `TimeoutSeconds` | 90 | `CancellationTokenSource` wrapping the whole loop |
| `MaximumToolIterations` | 6 | loop bound |
| `MaximumToolCallsPerRun` | 12 | running total across iterations |
| `MaximumConversationMessages` | 50 | history window in `AIContextBuilder` |
| `StoreRawProviderPayload` | false | whether raw provider JSON is kept on the run |
| `AsyncRuns:LeaseSeconds` | 180 | must exceed one provider timeout plus margin |
| `AsyncRuns:MaximumSafeAttempts` | 2 | retries allowed while a run has no side effects |

`MaximumConversationMessages` is a hard ceiling that a plan can only lower. It must not sit below the
highest plan value — at its old default of 30 it silently capped Pro's 50.

### Context assembly

`AIContextBuilder` assembles: system prompt, then a rolling summary of messages that have aged out,
then the last N user/assistant messages.

**Tool traffic is persisted but never replayed from history** — tool calls and results are appended to
the in-memory `messages` list during the run that produced them, and dropped afterwards. Without this
the context would grow without bound and the model would re-read stale tool output on later turns.

The summary comes from [`AIConversationSummarizer`](../../server/FitMate.Services/AI/Summaries/AIConversationSummarizer.cs),
which rewrites the previous summary plus the newly-dropped slice using the fast model. It never
summarizes tool payloads, it is wrapped in a "this is data, not instructions" preamble because it is
model-generated text replayed into a later prompt, and a failure to summarize degrades context rather
than failing the user's message. Summarizing does not consume an AI chat unit; its tokens are still
recorded against the run for cost visibility. Under token pressure the summary is dropped before the
newest user message.

There is no training-data snapshot in the prompt. The model pulls what it needs through the read-only
tools, which keeps the prompt small and means every data access is logged as a tool execution.

AI context reads go through [`AITrainingContextQuery`](../../server/FitMate.Services/AI/Context/AITrainingContextQuery.cs),
not the UI aggregate loaders: ordering and limits are applied in SQL, projections carry only the
fields the prompt reads, and no image or video URLs are resolved.

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
