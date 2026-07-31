# Admin user grid — change a user's subscription

Let an admin see and change a user's plan from the user grid, without going to the Subscription
admin page first.

## Why this is mostly wiring

The capability already exists end to end:

- `POST /api/admin/subscriptions/{userId}/override` and `DELETE .../override`, both `[AdminGuard]`
- `adminService.subscriptions.assignOverride(userId, payload)` / `.removeOverride(userId)`
- `AssignOverrideModal` in `AdminPanel/SubscriptionAdmin/components/`

What is missing is that the user grid's `AdminUserModel` carries no plan data, so the grid can
neither show a plan nor tell the modal what the user is currently on.

Admin-only needs no new work: both controllers carry `[AdminGuard]`, and the grid lives inside the
admin panel.

## The one real design decision

The resolution rule — **active override → active subscription → Free** — already exists twice:

| Where | Shape |
|---|---|
| `EntitlementService.ResolvePlanAsync` | single user, memory-cached, runtime enforcement |
| `AdminSubscriptionService.ListAsync` | batch over a page, admin reads |

A third copy inside `AdminUserService` is where they would drift. Instead, extract the batch form:

```csharp
// FitMate.Services/Subscriptions/IEffectivePlanResolver.cs
Task<IReadOnlyDictionary<long, ResolvedPlan>> ResolveManyAsync(IReadOnlyCollection<long> userIds);

// ResolvedPlan: EffectivePlanCode, EffectivePlanName, Source, ActiveOverrideId
```

It absorbs the existing `LoadActiveOverridesAsync`, `GetFreePlanAsync` and `Resolve` from
`AdminSubscriptionService`, which then consumes the resolver rather than keeping its own copy. Net
effect: one batch implementation feeding two call sites.

`EntitlementService` is deliberately left alone. It has different obligations — per-user caching and
the entitlement rows themselves — and folding the two would couple runtime enforcement to an admin
read path.

### Performance

`ResolveManyAsync` issues two set-based queries (active overrides, active subscriptions) plus the
Free-plan lookup, for the whole page at once. Resolving per user through `EntitlementService` would
be an N+1 across a 50-row page, which is why the batch resolver exists rather than a loop.

## Backend changes

**`AdminUserModel`** gains:

| Field | Purpose |
|---|---|
| `EffectivePlanCode` | filtering / display |
| `EffectivePlanName` | the Plan column |
| `Source` (`EntitlementSource`) | distinguishes override from subscription from Free |
| `HasActiveOverride` | enables the remove action |

**`AdminUserService.ListAsync`** resolves plans for the page's user ids and maps them onto the
models. **`AdminUserService.UpdateAsync`** resolves for the single updated user, so the row the
client patches back does not lose its plan fields.

No new endpoints.

## Frontend changes

**Share the modal.** `AssignOverrideModal` is typed to `UserSubscriptionAdminModel`, which the user
grid does not have. Narrow its props to the minimum it actually uses:

```ts
{ userId: number; email: string | null; currentPlanName: string }
```

and move it to `AdminPanel/components/` so both pages use one modal instead of a copy.

**`UserGrid/columns.tsx`** gains a **Plan** column (plan name, with an "override" marker when
`Source === AdminOverride`) and two row actions: assign a plan, and remove the override — the latter
disabled unless `HasActiveOverride`.

**`useUserGridPage.ts`** loads the plan list for the modal, calls assign/remove, and reloads the grid
afterwards.

## Testing

Unit, on the resolver — this is the logic worth pinning because it now feeds two call sites:

- an active override wins over an active subscription
- an active subscription wins over Free
- no override and no subscription resolves to Free
- **a deactivated plan resolves to Free**, not to the deactivated plan

Unit, on `AdminUserService.ListAsync`: a page containing an overridden user, a subscribed user and a
plain user returns the right plan fields for each.

Integration: the admin user list carries plan data, and the override endpoints stay admin-only.

## Out of scope

Editing `UserSubscription` rows directly. Nothing writes them — Stripe (plan 09) was never built — so
plan overrides are the only mechanism that takes effect, which is what the Subscription admin page
already does. Adding subscription-row editing would create state no other code path produces.
