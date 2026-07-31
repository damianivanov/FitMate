# Admin surfaces and observability

Everything the AI does is auditable, and everything users ask it for that FitMate cannot do is
collected as a ranked backlog. Admin controllers live in `FitMate.Web/Controllers/Admin/` and all
require the admin role.

---

## AI observability

`AdminAIService` reads the three audit tables the coach writes. Nothing here is a separate metrics
pipeline — the operational tables *are* the reporting tables.

| Endpoint | Shows |
|---|---|
| `GET /api/admin/ai/overview?days=` | headline counts over a window |
| `GET /api/admin/ai/conversations` · `/{id}` | paged list, then the full message trail including tool calls and results |
| `GET /api/admin/ai/runs` · `/{id}` | one row per user message: model, status, tokens, cost, tool-call count, failure reason |
| `GET /api/admin/ai/usage?periodStart=` | consumption per feature for a billing period |
| `GET /api/admin/ai/costs?days=` | spend over time |

### Why cost lives in a table

`AICostCalculator` prices a run from `AIModelPricing` rows rather than constants, and the computed
cost is stored on the `AIRun`. Two consequences worth knowing:

- Re-pricing after a vendor price change is a data update, not a deploy.
- Historic runs keep the price that applied when they ran, so last month's reported spend does not
  move when today's prices change.

A model with no pricing row costs zero rather than failing the run — check `AIModelPricing` first if
the cost dashboard reads lower than expected.

### Reading a failed run

`AIRun.Status` plus `FailureReason` tells you which exit the orchestrator took:

| Symptom | Cause |
|---|---|
| `FailureReason = "tool_iteration_limit"` | the model never stopped calling tools within `MaximumToolIterations` (6) |
| `FailureReason = "tool_call_limit"` | more than `MaximumToolCallsPerRun` (12) calls in one run |
| Failed with an exception message | provider error or an unhandled service fault |
| Tool rows with `Rejected` | the model invented a tool name, or a tool was not available to that user |

`AIToolExecutions` carries per-call duration, so a slow run can be attributed to a specific tool
rather than assumed to be the provider.

All of it is redacted on write by `AIRedactionService` — an admin reading a conversation cannot
recover a user's token or key from the audit trail.

---

## Unsupported requests

`report_unsupported_request` is a tool the model calls when a user asks for something FitMate cannot
do. It writes to the admin backlog and needs no confirmation, because it touches no user data.

`UnsupportedRequestService.RecordAsync` deduplicates on `(Category, NormalizedKey)` —
`UnsupportedRequestKeyNormalizer` produces the key. It increments the group's occurrence count and
**always appends an `UnsupportedAIRequestOccurrence` row** so admins can read real examples rather
than only a counter. The backlog therefore ranks by genuine demand instead of filling with fifty
phrasings of the same request.

| Endpoint | Purpose |
|---|---|
| `GET /api/admin/ai/unsupported-requests` | ranked backlog |
| `GET /api/admin/ai/unsupported-requests/categories` | category rollup |
| `GET`/`PUT /api/admin/ai/unsupported-requests/{id}` | inspect occurrences, update triage status |

---

## Subscription administration

| Endpoint | Purpose |
|---|---|
| `GET /api/admin/subscriptions` · `/{userId}` | who is on what, and why (override / subscription / free) |
| `POST`/`DELETE /api/admin/subscriptions/{userId}/override` | grant or revoke a time-boxed plan override |
| `GET /api/admin/subscription-plans` · `/{id}` · `POST` · `PUT /{id}` · `POST /{id}/active` | edit plans and entitlements |
| `GET /api/admin/usage` · `POST /api/admin/usage/{id}/reset` | inspect and reset usage buckets |

Overrides are the **only** way to put a user on a paid plan today, since Stripe was never built.

Two gotchas:

- `EntitlementService` caches the resolved plan for 60 seconds per user. A grant can take up to a
  minute to take effect unless `Invalidate(userId)` is called.
- Deactivating a plan silently drops everyone on it to Free — that is deliberate (a disabled plan
  must not grant anything), but it means toggling `IsActive` on a live plan is a user-visible
  downgrade, not a bookkeeping change.

---

## The error grid

`GET /api/admin/errors` (with `DELETE /{id}` and `DELETE /all`) reads the `Errors` table, which is
written from two places:

1. **`LogApiErrorAttribute`** — unhandled exceptions only (HTTP 500), with the full stack trace.
   Handled business errors, 403s and 429s are deliberately excluded.
2. **`SerilogDatabaseSink`** — any `ILogger` event at Warning or above, so model-validation 400s and
   service-level warnings are visible too. It skips the exception filter's own events to avoid
   duplicating the 500s.

The sink guards against two failure modes worth remembering if you extend it:

- **Re-entrancy.** Writing the row goes through EF Core, which itself logs at Warning on failure. A
  `[ThreadStatic]` flag stops a failed write from recursing into `Emit`.
- **Bad audit user.** The user id is verified to exist before being used, so a stale id cannot cause
  an FK violation that loses the error row entirely.

Both write paths swallow their own failures — logging must never break a request.

### Keeping the grid signal-heavy

The grid is only useful if it holds application faults. Framework infrastructure warnings are
filtered out by log-level overrides in `Program.cs`:

```csharp
.MinimumLevel.Override("Microsoft.AspNetCore.HttpsPolicy",    LogEventLevel.Error)
.MinimumLevel.Override("Microsoft.AspNetCore.DataProtection", LogEventLevel.Error)
```

These override on the **full logger category**, which is the middleware's type name — the namespace
must match exactly. An override keyed on a namespace that does not exist silently matches nothing;
see [operations.md](operations.md) for the production incident this caused.
