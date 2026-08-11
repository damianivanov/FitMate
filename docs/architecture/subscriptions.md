# Subscriptions, entitlements and usage

Two questions, two services:

- **"Is this user allowed to do X?"** → `IEntitlementService`
- **"Have they got any left this month?"** → `IUsageService`

Anything metered asks both, in that order, before doing the work.

---

## Data model

```
Plan ──┬── PlanPrice        currency, amount, interval, StripePriceId   (written by nothing yet)
       └── PlanEntitlement  one row per SubscriptionFeature

User ──┬── UserSubscription  PlanId + status (Active/Trialing/…)
       ├── UserPlanOverride  admin-granted plan, time-boxed
       ├── UsageBucket       per user, per feature, per month: Used, Reserved, Version
       ├── UsageReservation  in-flight claim on quota, expires after 15 min
       └── UsageEntry        append-only ledger: Reservation / Commit / Release
```

`PlanEntitlement` carries three different kinds of cap, and which one applies depends on the feature:

| Column | Meaning | Example |
|---|---|---|
| `IsEnabled` | the feature exists on this plan at all | `AIProgramGeneration` is off on Free |
| `MonthlyLimit` | consumable per calendar month, tracked in a bucket | 10 AI chats/month |
| `HardLimit` | a standing ceiling, not consumed over time | max 1 active program |
| `MaximumPerRequest` | cap on a single reservation's quantity | — |

`BuildAvailability` collapses the first two into one number for the client: `MonthlyLimit ?? HardLimit`,
or `0` when the feature is disabled. `null` means unlimited.

---

## Resolving a plan

`EntitlementService.ResolvePlanAsync` — priority order, first match wins:

```
1. active UserPlanOverride   (IsActive, StartsAt <= now, EndsAt null or future)  → AdminOverride
2. active UserSubscription   (Active or Trialing)                                → Subscription
3. the seeded Free plan                                                          → FreePlan
```

Then a safety net: if the resolved plan is missing or `IsActive == false`, it falls back to Free.
**A deactivated plan must never grant more than Free** — otherwise switching a plan off in the admin
panel would silently promote everyone on it to unlimited.

The result is cached in `IMemoryCache` for 60 seconds per user. Call `Invalidate(userId)` after
changing a subscription or override; otherwise a grant takes up to a minute to appear. The window is
short deliberately — it absorbs the several entitlement lookups a single AI run makes without making
staleness a support problem.

Since nothing writes `UserSubscription` yet (Stripe was never built), in practice every user resolves
to **Free** unless an admin grants an override.

---

## Reserve → commit / release

Metered work must not consume quota until it succeeds, and must not let two parallel requests both
spend the last unit. `UsageService` does this with a three-step ledger:

```
ReserveAsync(userId, feature, qty)
   ├─ entitlement disabled?              → SubscriptionFeatureDisabledException  (403)
   ├─ qty > MaximumPerRequest?           → FitMateException                      (400)
   ├─ ExpireStaleReservationsAsync       reclaim anything abandoned > 15 min ago
   ├─ bucket.Used + bucket.Reserved + qty > limit?
   │                                     → SubscriptionLimitExceededException    (429)
   └─ bucket.Reserved += qty; bucket.Version++;  save
                                         → UsageReservation (Active) + UsageEntry (Reservation)

CommitAsync(id)     Reserved -= qty; Used += qty     + UsageEntry (Commit)
ReleaseAsync(id)    Reserved -= qty                  + UsageEntry (Release)
```

Three details that are easy to get wrong and are handled here:

- **The concurrency token does the real work.** `UsageBucket.Version` is a concurrency token, so two
  simultaneous reservations serialise. The loser catches `DbUpdateConcurrencyException`, clears the
  change tracker and **re-evaluates the limit against fresh numbers** — it does not just retry the
  write. Up to 3 attempts, then a retryable error. This is what stops both requests spending the last
  unit.
- **Creating the bucket is also a race.** `GetOrCreateBucketAsync` catches `DbUpdateException` on the
  insert and reloads the winner's row rather than failing the request.
- **Commit and release are idempotent.** `FinalizeAsync` returns silently if the reservation is not
  `Active`. The orchestrator's error path can therefore release a reservation that a success path
  already committed without double-counting.

Reservations expire lazily, at the start of the next `ReserveAsync` for the same user — there is no
sweeper job. A crashed run's quota is reclaimed the next time that user asks for something, not
before.

`UsageEntry` is append-only and never read by the enforcement path. It exists so a disputed bill can
be reconstructed after the fact.

---

## Consuming entitlements

Two shapes, depending on whether the thing is consumable.

**Metered** — reserve first, commit on success (`AIOrchestrator`):

```csharp
await entitlementService.RequireFeatureAsync(userId, SubscriptionFeature.AIChat);
var reservation = await usageService.ReserveAsync(userId, SubscriptionFeature.AIChat, 1);
try     { /* … work … */ await usageService.CommitAsync(reservation.Id); }
catch   { await usageService.ReleaseAsync(reservation.Id); throw; }
```

**Standing ceiling** — count what exists and compare (`ProgramPlanService.RequireActivationEntitlementsAsync`):

```csharp
var availability = await entitlementService.GetAvailabilityAsync(userId, SubscriptionFeature.ActiveProgramPlans);
// count the user's currently-active plans, compare against availability.Limit
```

No bucket, no reservation — the current row count *is* the usage. `ProgramPlanDurationMonths` is
checked the same way against the plan's requested length, and applies only to fixed-length plans.

---

## Seeded plans

`plans.json` in `FitMate.Web/SeedData/`, applied on startup by `SeedPlans` in `ApplicationBuilder`.
Blank cell = unlimited.

> **Editing a limit in `plans.json` does not change any existing database.** `SeedPlans` inserts a
> plan's entitlements only when that feature is not already present — it never updates one. The file
> therefore seeds a *new* database and is inert everywhere else. This has already bitten once: Free
> `AIChat` was raised from 10 to 25 in the seed file and the change never reached a single running
> environment, leaving the file, the docs and the database each claiming something different.
> To actually change a limit, edit `plans.json` **and** write a migration that updates the existing
> `PlanEntitlements` rows.

| Feature | Free | Plus | Pro |
|---|---|---|---|
| AIChat (monthly) | 10 | 100 | 500 |
| AIWorkoutGeneration (monthly) | 2 | 15 | 60 |
| AIProgramGeneration (monthly) | ✗ | 2 | 10 |
| AIExerciseRecognition (monthly) | ✗ | 10 | 50 |
| AIImageGeneration (monthly) | ✗ | 5 | 25 |
| AITrainingAnalysis (monthly) | 1 | 10 | 50 |
| ActiveProgramPlans (hard) | 1 | 3 | 10 |
| ProgramPlanDurationMonths (hard) | 1 | 6 | 12 |
| CustomWorkoutTemplates (hard) | 5 | 50 | — |
| ExerciseHistoryMonths (hard) | 1 | 12 | — |

The integration tests seed these exact values (`SqliteTestDatabase.SeedPlans`) because entitlement
resolution falls back to Free, so the Free row has to match production for the fallback to be
meaningful under test.

---

## Error contract

Both failures return a `SubscriptionLimitErrorModel` in the envelope's `data`, so the client can
render an upgrade prompt with real numbers instead of a generic message.

| Situation | Status | `code` | Payload |
|---|---|---|---|
| Feature not on the plan | **403** | `subscription_feature_disabled` | feature, `upgradeAvailable` |
| Monthly quota exhausted | **429** | `subscription_limit_reached` | feature, limit, used, reserved, `resetsAt`, `upgradeAvailable` |

Mapped centrally in `LogApiErrorAttribute`. Neither is written to the `Errors` table — they are
expected outcomes, not faults.

---

## API and frontend

| Route | Returns |
|---|---|
| `GET /api/subscriptions/me` | current plan, source (override / subscription / free) |
| `GET /api/subscriptions/plans` | public plans with prices, for the upgrade page |
| `GET /api/subscriptions/usage` | every feature's availability for the current period |
| `GET /api/admin/subscriptions`, `POST/DELETE /api/admin/subscriptions/{userId}/override` | admin grants |
| `GET /api/admin/subscription-plans`, `POST`, `PUT /{id}`, `POST /{id}/active` | plan editing |
| `GET /api/admin/usage`, `POST /api/admin/usage/{id}/reset` | inspect and reset buckets |

Frontend: `client/src/pages/Subscription/` (`UsageBar.tsx` renders used/reserved/limit) and the
admin plan editor under `client/src/pages/AdminPanel/`. Data access via
`client/src/services/subscriptionService.ts`.
