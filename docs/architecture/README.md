# FitMate architecture

Developer documentation for the modules added on `feat/ai-coach-subscriptions`: the AI coach,
subscriptions and entitlements, program plans, training profiles and exercise metadata, plus the
admin surfaces and hosting changes that support them.

These documents describe **what is in the code**, not what was planned. The implementation plans in
`docs/superpowers/plans/` record intent and have drifted in places (entity names are `AIConversation`,
not `AiConversation`; two planned tools were never built). Where the two disagree, the code wins and
this documentation follows the code.

| Document | Covers |
|---|---|
| [ai-coach.md](ai-coach.md) | Conversations, the orchestration loop, the tool allow-list, proposals and confirmation, unsupported requests |
| [subscriptions.md](subscriptions.md) | Plans, entitlements, the reserve→commit usage ledger, limit errors |
| [program-plans.md](program-plans.md) | Program plans, schedule generation, the day lifecycle, training profiles, exercise ownership |
| [admin-and-observability.md](admin-and-observability.md) | Admin dashboards, AI run auditing, cost tracking, the error grid |
| [operations.md](operations.md) | Hosting on Railway, logging, data protection, configuration, deployment |

---

## Project layout and dependency direction

Five server projects. Dependencies point strictly downward — nothing below references anything above.

```
FitMate.Web            ASP.NET Core host. Controllers, DI wiring, filters, migrations-on-start.
      │
      ▼
FitMate.Services       Business logic. One folder per domain, interface + implementation per service.
      │
      ├───────────────────────────┬───────────────────────────┐
      ▼                           ▼                           ▼
FitMate.Core            FitMate.Integrations          FitMate.DB
DTOs (JsonModels),      Vendor SDK adapters           EF Core: AppDbContext, entities,
exceptions, settings.   (OpenAI) + neutral models.    per-entity configurations,
      │                 NOTHING outside this          migrations, enums.
      │                 project references a
      ▼                 vendor SDK.                   (references nothing)
FitMate.DB
(DTOs use DB enums —
 EntitlementSource,
 SubscriptionStatus, …)
```

`FitMate.DB` and `FitMate.Integrations` are the roots — neither references another project. `Core`
sits on top of `DB` because the JSON models expose DB enums directly rather than mirroring them.

`FitMate.Tools` is a separate console app for one-off operational commands and is not part of the
request path. `FitMate.Tests` covers all of the above (386 tests).

**Provider neutrality is a hard rule.** `FitMate.Services` consumes only `IAICompletionProvider` /
`IAIImageProvider` and the neutral models in `FitMate.Integrations/AI/Models`. Swapping OpenAI for a
different vendor means writing one adapter and changing one DI line — no service or controller
changes. The fake provider the tests use plugs into the same seam.

---

## The shape of a request

Every endpoint follows the same path. Knowing it means you can find your way around any feature:

```
HTTP request
   │
   ▼
Controller  (FitMate.Web/Controllers)          extends BaseApiController
   │        [Authorize] by default; resolves the caller's id from the JWT
   ▼
Service     (FitMate.Services/<Domain>)        signature: (request, long userId)
   │        ALL ownership checks live here — never in the controller
   ▼
AppDbContext (FitMate.DB)                      SaveChanges(userId) stamps the audit columns
   │
   ▼
Response    CommonJsonModel<T> envelope        this.ReturnJson(...) / this.ReturnJsonError(...)
```

### Conventions that hold everywhere

- **Service methods take `(request, long userId)` and no `CancellationToken`.** The exception is
  `FitMate.Integrations` provider interfaces and AI tool handlers, which do take one because they
  make network calls inside a timeout.
- **Ownership is enforced in the service, always.** The pattern is a `RequireOwnedAsync(id, userId)`
  helper that throws if the row is not the caller's. Controllers never filter by user id themselves.
- **Every response is wrapped** in `CommonJsonModel<T>` (`{ error, data }`).
- **DTOs live in `FitMate.Core/JsonModels/<Feature>/`** and are exported to
  `client/src/types/backend.ts` by Reinforced.Typings during `dotnet build` of `FitMate.Web`, then
  split into per-model files by `npm run process-types` in `client/`. Never hand-write a TypeScript
  interface for a backend model — build the backend and let it generate.
- **Entities inherit `BaseEntity`** (`Id`, `DateCreated`, `DateModified`) or `BaseTrackUserEntity`
  (adds `CreatedById` / `ModifiedById`). Configuration goes in a per-entity
  `IEntityTypeConfiguration` class, never in `OnModelCreating`.
- **Rows that can be raced carry a `Version` concurrency token** — usage buckets, AI actions. See
  [subscriptions.md](subscriptions.md) for why.

### Error handling

`LogApiErrorAttribute` is registered globally as an exception filter and maps exceptions to status
codes. This is the single place HTTP status codes are decided:

| Exception | Status | Persisted to `Errors`? |
|---|---|---|
| `SubscriptionLimitExceededException` | 429 | No — logged at Warning |
| `SubscriptionFeatureDisabledException` | 403 | No — logged at Warning |
| `FitMateException` (expected business failure) | 400 | No — logged at Warning |
| Anything else | 500 | **Yes**, with full stack trace |

The distinction matters: `FitMateException` is for failures the user caused and can fix ("Suggestion
not found"), so it must not pollute the error grid. Anything uncaught is a bug and is recorded.

Model-validation 400s never reach the filter — they short-circuit in
`InvalidModelStateResponseFactory`, which logs them at Warning under the category
`FitMate.Web.ModelValidation` so they still land in the error grid.

---

## What is not built

The roadmap has eleven plans; plans 01–08 shipped. Three did not, and their absence shows up as
loose ends you may notice in the code:

- **Stripe billing (plan 09).** `PlanPrice.StripePriceId` and `UserSubscription` exist and are read
  by the entitlement resolver, but nothing writes them — no checkout, no webhook, no
  `BillingCustomer`. Paid plans are reachable today only through an admin override.
- **Vision and image generation (plan 10).** `AIActionType.GenerateExerciseImage` is declared but has
  no executor and no `propose_exercise_image` tool. `IAIImageProvider` and `OpenAIImageProvider`
  exist and are wired, but nothing calls them.
- **Background jobs (plan 11).** Everything that would be a job runs at the request boundary instead:
  missed-day marking, the rolling-horizon top-up, reservation expiry, and AI action expiry all happen
  lazily when a relevant endpoint is hit. This is deliberate for now and noted in each place, but it
  means a user who never opens the app never gets their days marked missed.

Two tools named in the roadmap were never implemented: `get_training_snapshot` and
`propose_exercise_image`. There is no `ITrainingSnapshotService`; `AIContextBuilder` assembles context
from conversation history only, and the model pulls training data through the read-only tools instead.
