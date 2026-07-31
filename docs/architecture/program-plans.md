# Program plans, training profiles and exercise metadata

The program module answers one question on the home screen: **"what am I training today?"**

The governing rule is that the answer is always read from persisted `ProgramPlanDay` rows. It is
never computed on the fly and never asked of the AI. Generation happens once, at activation; reading
is a lookup.

---

## Data model

```
ProgramPlan ──┬── ProgramPlanScheduleRule   the recipe: which weekday / rotation slot, which template
              └── ProgramPlanDay            the generated calendar: one row per scheduled date

UserTrainingProfile   goal, experience, availability, equipment — one per user
Exercise ─── ExerciseAlias                  normalised alternative names, for search and dedup
```

`ProgramPlanScheduleRule` is the pattern; `ProgramPlanDay` is the expansion of that pattern onto real
dates. Reshaping a plan rewrites rules and regenerates *future* days only.

### Enums

| Enum | Values |
|---|---|
| `ProgramPlanStatus` | Draft, Active, Paused, Completed, Cancelled |
| `ProgramScheduleType` | FixedWeekdays, Rotation, CustomCalendar |
| `ProgramPlanDayType` | Workout, Rest, OptionalWorkout, Recovery, Deload |
| `ProgramPlanDayStatus` | Scheduled, Started, Completed, Skipped, Missed, Rescheduled, Cancelled |

---

## Fixed-length vs open-ended

`ProgramPlan.EndDate` is nullable, and that single fact splits the module's behaviour:

|  | `EndDate` set | `EndDate` null |
|---|---|---|
| Meaning | "12-week program" | "keeps going" |
| Days generated at activation | all of them | rolling **28-day** horizon |
| Topped up later | no | yes, at the request boundary |
| Schedule types allowed | any | FixedWeekdays or Rotation only |
| Progress shows | completion %, adherence %, streak | adherence %, streak, completed count |

`CustomCalendar` requires an end date because there is no repeating pattern to project forward.
Open-ended plans have no denominator, so completion % is omitted rather than shown as a misleading
number.

The horizon constant is `ProgramPlanService.OpenEndedHorizonDays = 28`. `EnsureUpcomingDaysAsync`
tops it up: it finds the furthest generated day and generates from there to `referenceDate + 28`, so
it never regenerates existing rows. It runs from the today and calendar endpoints — plan 11 would
have moved it to a background job, but that was not built, **so a user who never opens the app never
gets more days generated.**

---

## Schedule generation

`ProgramPlanScheduleService.GenerateDays(plan, from, toInclusive)` — pure, no database, no clock.
That is what makes it easy to test and deterministic:

```csharp
FixedWeekdays: rule.DayOfWeek == date.DayOfWeek
               && (daysSinceStart / 7) % max(1, rule.WeekInterval) == 0   // every N weeks

Rotation:      rule.RotationDayIndex == (daysSinceStart % cycleLength) + 1
               // cycleLength = max RotationDayIndex across the rules — an A/B/C/rest
               // rotation is a 4-slot cycle that ignores weekdays entirely

CustomCalendar: returns [] — days are supplied explicitly, not projected
```

Rest rules are dropped rather than materialised: a rest day is the *absence* of a row, so the
calendar stays sparse. A rule that is both optional and a workout becomes `OptionalWorkout`, which
matters later — missing an optional day is forgiven (see below).

---

## Plan lifecycle

```
Draft ──activate──► Active ──pause──► Paused ──activate──► Active
                      │
                      ├──complete──► Completed
                      └──cancel────► Cancelled

Draft ──delete──► gone        (only drafts can be deleted)
```

`ActivateAsync` is the gate. It calls `RequireActivationEntitlementsAsync`, which checks
`ActiveProgramPlans` (how many active plans the plan allows) and `ProgramPlanDurationMonths` (for
fixed-length plans only), then generates the day rows — all of them, or the first 28 days for an
open-ended plan.

The one-active-plan rule from the original design is now an entitlement lookup rather than a
constant, and it lives in exactly one method so the limit is configurable per plan tier.

### Reshaping an active plan

`UpdateActiveScheduleAsync(planId, request, effectiveFrom, userId)` replaces the rules and regenerates
days from `effectiveFrom` — but **only days still in `Scheduled` status**. Completed, Started, Missed,
Skipped and Rescheduled days survive untouched.

Changing your program must never rewrite what you already did. This is also what the AI's
`propose_program_update` path goes through, so the coach cannot erase training history either.

---

## Day lifecycle

| Transition | Endpoint | Rule |
|---|---|---|
| Start a workout | `POST /api/program-plan-days/{id}/start` | plan must be Active; rest days and days without a template are rejected; creates the `Workout` and returns its id |
| Move to another date | `.../move` | target must be inside the plan range and free; day becomes `Rescheduled` |
| Skip | `.../skip` | deliberate, user-initiated |
| Restore | `.../restore` | only from Skipped or Missed; returns to `Scheduled` if the date is still in the future, otherwise `Rescheduled` |

`MarkMissedDaysAsync(userId, referenceDate)` marks days **strictly before** the reference date that
are still Scheduled or Rescheduled. An `OptionalWorkout` is skipped rather than missed — an optional
day you did not do is not a failure, and adherence should not punish it.

It runs lazily from the today and calendar endpoints, using the same reference date, so "today"
means the same thing to marking and to reading.

### Time zones

`ScheduledDate` is a `DateOnly`. The client sends its **local** date as `?date=2026-08-05`; the server
falls back to `DateOnly.FromDateTime(DateTime.UtcNow)` when it is absent. Without the client-supplied
date, a user training at 9pm UTC−5 would see tomorrow's workout.

---

## API

| Route | Purpose |
|---|---|
| `GET /api/program-plans` | list |
| `GET /api/program-plans/active` | the active plan |
| `GET /api/program-plans/active/today?date=` | **the home-screen call**: today's day + missed-day maintenance |
| `GET /api/program-plans/{id}` | detail |
| `GET /api/program-plans/{id}/calendar?year=&month=` | month grid |
| `GET /api/program-plans/{id}/progress?date=` | completion / adherence / streak |
| `POST`, `PUT /{id}` | create and update drafts |
| `POST /{id}/activate`, `/pause`, `/complete`, `/cancel` | lifecycle |
| `DELETE /{id}` | drafts only |
| `POST /api/program-plan-days/{id}/start` \| `/move` \| `/skip` \| `/restore` | day actions |

---

## Training profiles

`UserTrainingProfile` — one row per user: goal (`TrainingGoal`), experience
(`TrainingExperienceLevel`), weekly availability, session length, available equipment, weight unit.

Read by `get_training_profile` so the coach can size a program to what the user actually has, rather
than asking the same questions every conversation.

`GET`/`PUT /api/training-profile` · `TrainingProfileService` ·
`client/src/pages/Profile/TrainingProfile.tsx`.

---

## Exercise ownership and metadata

`Exercise` carries two fields that together define visibility:

```csharp
public long? UserId { get; set; }        // null = global catalogue entry
public bool IsPublic { get; set; }       // a personal exercise shared with everyone
```

The visibility predicate, used consistently in search and duplicate detection:

```csharp
x.UserId == null || x.UserId == userId || x.IsPublic
```

Only the admin endpoint creates global exercises (`UserId == null`). The AI cannot: proposal handlers
force `IsGlobal = false` before validating, so a model that asks for a global exercise gets a personal
one regardless.

Metadata (`ExerciseEquipment`, `ExerciseMovementPattern`, `ExerciseDifficulty`, `ExerciseCategory`) is
nullable throughout — the seeded catalogue predates it and was not backfilled. Treat it as a hint,
never as a required filter.

`ExerciseAlias` stores normalised alternative names via `ExerciseAliasNormalizer`. Aliases power
search and the duplicate-candidate check that warns a user before the coach creates a second "Bench
Press".

---

## Frontend

| Page | Role |
|---|---|
| `pages/Program/` | plan list, detail, progress card, schedule summary |
| `pages/ProgramBuilder/` | one editor per schedule type — `FixedWeekdaysEditor`, `RotationEditor`, `CustomCalendarEditor`; draft state in `utils/builderState.ts` |
| `pages/ProgramCalendar/` | month grid and per-day detail |
| `pages/Home/` | today card, driven by `active/today` |

Data access via `client/src/services/programPlanService.ts` and `trainingProfileService.ts`, using
generated types from `client/src/types/`.
