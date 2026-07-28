# Program Builder + Execution UX Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users build a program from their workout templates (fixed weekdays / rotation / custom calendar, fixed-length or open-ended), activate it from a confirmation card, see "what to train today" on the dashboard, and manage every scheduled day (start/move/skip/restore) from a monthly program calendar.

**Architecture:** Pure frontend layer over Plan 01's finished API (`api/program-plans`, `api/program-plan-days` — endpoint table in Plan 01 Task 10). One new service (`programPlanService`), three new page folders (`Program`, `ProgramBuilder`, `ProgramCalendar`) following the repo's `PageName.tsx + components/ + hooks/ + index.ts` convention, shared modals/hooks for the pieces used by more than one page (template picker, activate card, move-day modal, start-day hook), and a Today card injected into the existing `Workouts` dashboard. All API types come from the auto-generated `client/src/types/backend.ts` — zero handwritten API interfaces.

**Tech Stack:** React 19, react-router 7, TypeScript ~5.9, Tailwind v4 (`liquid-*` design classes), zustand (`activeWorkoutStore` for the mobile workout sheet), axios via `@/lib/api`, sonner toasts, react-icons/lu. No test framework exists in `client/package.json` — do NOT introduce one; verification is `npm run lint` + `npx tsc -b --noEmit` + the manual QA checklist in Task 11.

## Global Constraints

- **Generated types only** (global rule + roadmap D4): every request/response type and enum is imported from `@/types` (re-exports of generated `backend.ts` via `types/JsonModels/index.ts`). Never define an `interface`/`type`/`enum` for an API model in a service file. If a generated type is missing, fix the backend export (`dotnet build server/FitMate.Web/FitMate.Web.csproj` then `cd client && npm run process-types`) — never handwrite it.
- `DateOnly` crosses the wire as a plain `"yyyy-MM-dd"` **string** (see `server/FitMate.Web/Infrastructure/ReinforcedTypingsConfiguration.cs` lines 99–105). Never parse it with `new Date("yyyy-MM-dd")` directly (UTC-midnight shift) and never produce it with `toISOString()` (UTC date, wrong near midnight). Use the `dateOnly.ts` helpers from Task 1 everywhere.
- The client sends its **local date** to the today/progress endpoints (roadmap D2): `?date=` built from `new Date()` components, not UTC.
- `async/await` only — never `.then()/.catch()/.finally()` chains (repo memory rule).
- Follow existing page conventions: `useXxxPage` hook returning `{ state, actions }`, `AsyncSection` for load/error/empty, `PageHeader`/`PageBody` layout, `Modal`/`DeleteConfirmationModal`/`ActionMenu` from `@/shared/components`, `liquid-panel`/`liquid-primary-btn` styling, `unwrap()` for the `JsonData<T>` envelope, toasts via `sonner`.
- All authenticated routes are wrapped in `<AccessGate requireAuthenticated>` inside `client/src/routes.tsx`.
- Mobile behavior: opening/continuing a workout on mobile (`useIsMobileViewport()`) goes through `useActiveWorkoutStore` (workout sheet), not navigation — mirror `useWorkoutsPage.open` / `useStartWorkoutFromTemplate`.
- After EVERY task: from `client/` run `npm run lint` and `npx tsc -b --noEmit`; both must be clean before committing.
- npm commands run from `c:\Users\damian\Documents\Github\FitMate\client`; git commands from repo root.

## File Structure

```
client/src/
├── services/programPlanService.ts                                (Task 1)
├── shared/utils/dateOnly.ts                                      (Task 1)
├── shared/utils/monthGrid.ts                                     (Task 2)
├── shared/utils/programDisplay.ts                                (Task 2)
├── pages/Calendar/utils/calendar.ts (modify: re-export shared)   (Task 2)
├── shared/components/TemplatePickerModal.tsx                     (Task 3)
├── shared/components/index.ts (modify: Tasks 3, 7, 9)
├── pages/Program/
│   ├── Program.tsx, index.ts                                     (Task 4)
│   ├── hooks/useProgramPage.ts                                   (Task 4)
│   ├── components/ProgramProgressCard.tsx, PlanListItem.tsx      (Task 4)
│   ├── ProgramDetail.tsx, hooks/useProgramDetailPage.ts,
│   │   components/ScheduleSummary.tsx                            (Task 8)
├── components/navigation.ts (modify: sidebar entry)              (Task 4)
├── routes.tsx (modify: Tasks 4, 5, 6, 8, 9)
├── pages/ProgramBuilder/
│   ├── utils/builderState.ts                                     (Task 5, extended Task 6)
│   ├── hooks/useProgramBuilderPage.ts                            (Task 5, extended Tasks 6–7)
│   ├── components/ProgramMetadataPanel.tsx,
│   │   FixedWeekdaysEditor.tsx                                   (Task 5)
│   ├── components/RotationEditor.tsx, CustomCalendarEditor.tsx   (Task 6)
│   ├── ProgramBuilder.tsx, index.ts                              (Task 5)
├── shared/components/ActivateProgramModal.tsx                    (Task 7)
├── pages/ProgramCalendar/
│   ├── ProgramCalendar.tsx, index.ts                             (Task 9)
│   ├── hooks/useProgramCalendarPage.ts                           (Task 9)
│   ├── components/ProgramCalendarGrid.tsx, ProgramDayDetail.tsx  (Task 9)
├── shared/components/MoveProgramDayModal.tsx                     (Task 9)
├── shared/hooks/useStartProgramDay.ts                            (Task 9)
├── pages/Workouts/components/ProgramTodayCard.tsx                (Task 10)
├── pages/Workouts/hooks/useProgramToday.ts                       (Task 10)
└── pages/Workouts/Workouts.tsx (modify)                          (Task 10)
```

---

### Task 1: programPlanService + DateOnly helpers

**Files:**
- Create: `client/src/services/programPlanService.ts`
- Create: `client/src/shared/utils/dateOnly.ts`

**Interfaces:**
- Consumes generated types from `@/types`: `ProgramPlanModel`, `ProgramPlanDayModel`, `ProgramTodayModel`, `ProgramProgressModel`, `SaveProgramPlanRequest`, `MoveProgramDayRequest`, `JsonData` (Plan 01 Task 2 DTO names).
- Produces: `programPlanService` object literal (method names below are consumed by every later task) and `dateOnly.ts` exports `toDateOnlyString`, `todayDateOnlyString`, `parseDateOnly`, `formatDateOnly`, `formatDateOnlyLong`, `diffDaysInclusive`.

- [ ] **Step 1: Verify generated types exist**

Open `client/src/types/JsonModels/index.ts` and confirm it exports `ProgramPlanModel`, `ProgramPlanDayModel`, `ProgramTodayModel`, `ProgramProgressModel`, `SaveProgramPlanRequest`, `ProgramScheduleRuleRequest`, `CustomProgramDayRequest`, `MoveProgramDayRequest` and the enums `TrainingGoal`, `ProgramPlanStatus`, `ProgramScheduleType`, `ProgramPlanDayType`, `ProgramPlanDayStatus`, `DayOfWeek` (System.DayOfWeek is picked up by the enum scanner because `ProgramScheduleRuleModel.DayOfWeek` references it; members `Sunday = 0` … `Saturday = 6`).

If any are missing, regenerate (Plan 01 must be merged first):

```
dotnet build server/FitMate.Web/FitMate.Web.csproj
cd client && npm run process-types
```

If `DayOfWeek` still does not appear in `backend.ts` after a rebuild, fix `ReinforcedTypingsConfiguration.cs` on the backend (it is an enum reachable from an exported model, so the existing scanner should already emit it) — do NOT handwrite a TS enum.

- [ ] **Step 2: Write `client/src/shared/utils/dateOnly.ts`**

```ts
/**
 * Helpers for backend DateOnly values, which serialize as plain "yyyy-MM-dd" strings
 * (see ReinforcedTypingsConfiguration: DateOnly -> string).
 *
 * NEVER use `new Date("yyyy-MM-dd")` on these (parsed as UTC midnight — shifts a day in
 * negative-offset timezones) and NEVER build them with `toISOString()` (UTC date).
 */

export function toDateOnlyString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** The client's LOCAL calendar date — what the today/progress endpoints expect (roadmap D2). */
export function todayDateOnlyString(): string {
  return toDateOnlyString(new Date());
}

/** Parses "yyyy-MM-dd" into a LOCAL Date at midnight. */
export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year || 1970, (month || 1) - 1, day || 1);
}

const SHORT_FORMATTER = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
});

const LONG_FORMATTER = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

/** "Mon, 3 Aug" style label for a "yyyy-MM-dd" string. */
export function formatDateOnly(value: string): string {
  return SHORT_FORMATTER.format(parseDateOnly(value));
}

/** "Monday, August 3, 2026" style label for a "yyyy-MM-dd" string. */
export function formatDateOnlyLong(value: string): string {
  return LONG_FORMATTER.format(parseDateOnly(value));
}

/** Whole days from `from` to `to`, counting both ends. Negative when `to` < `from`. */
export function diffDaysInclusive(from: string, to: string): number {
  const millisPerDay = 86_400_000;
  const delta = parseDateOnly(to).getTime() - parseDateOnly(from).getTime();
  return Math.round(delta / millisPerDay) + 1;
}
```

- [ ] **Step 3: Write `client/src/services/programPlanService.ts`** (object-literal pattern copied from `workoutTemplateService.ts`; routes exactly as in Plan 01 Task 10's endpoint table)

```ts
import api from "@/lib/api";
import type {
  JsonData,
  MoveProgramDayRequest,
  ProgramPlanDayModel,
  ProgramPlanModel,
  ProgramProgressModel,
  ProgramTodayModel,
  SaveProgramPlanRequest,
} from "@/types";

export const programPlanService = {
  async list() {
    return api.get<JsonData<ProgramPlanModel[]>>("program-plans");
  },

  async getById(id: number) {
    return api.get<JsonData<ProgramPlanModel>>(`program-plans/${id}`);
  },

  async getActive() {
    return api.get<JsonData<ProgramPlanModel>>("program-plans/active");
  },

  /** `localDate` must be the client's local "yyyy-MM-dd" (todayDateOnlyString()). */
  async getToday(localDate: string) {
    return api.get<JsonData<ProgramTodayModel>>("program-plans/active/today", {
      params: { date: localDate },
    });
  },

  async getCalendar(id: number, year: number, month: number) {
    return api.get<JsonData<ProgramPlanDayModel[]>>(`program-plans/${id}/calendar`, {
      params: { year, month },
    });
  },

  async getProgress(id: number, localDate: string) {
    return api.get<JsonData<ProgramProgressModel>>(`program-plans/${id}/progress`, {
      params: { date: localDate },
    });
  },

  async create(payload: SaveProgramPlanRequest) {
    return api.post<JsonData<ProgramPlanModel>>("program-plans", payload);
  },

  async update(id: number, payload: SaveProgramPlanRequest) {
    return api.put<JsonData<ProgramPlanModel>>(`program-plans/${id}`, payload);
  },

  async activate(id: number) {
    return api.post<JsonData<ProgramPlanModel>>(`program-plans/${id}/activate`);
  },

  async pause(id: number) {
    return api.post<JsonData<boolean>>(`program-plans/${id}/pause`);
  },

  async complete(id: number) {
    return api.post<JsonData<boolean>>(`program-plans/${id}/complete`);
  },

  async cancel(id: number) {
    return api.post<JsonData<boolean>>(`program-plans/${id}/cancel`);
  },

  async remove(id: number) {
    return api.delete<JsonData<boolean>>(`program-plans/${id}`);
  },

  /** Returns the started (or already-started — idempotent) workout id. */
  async startDay(dayId: number) {
    return api.post<JsonData<number>>(`program-plan-days/${dayId}/start`);
  },

  async moveDay(dayId: number, payload: MoveProgramDayRequest) {
    return api.post<JsonData<ProgramPlanDayModel>>(`program-plan-days/${dayId}/move`, payload);
  },

  async skipDay(dayId: number) {
    return api.post<JsonData<ProgramPlanDayModel>>(`program-plan-days/${dayId}/skip`);
  },

  async restoreDay(dayId: number) {
    return api.post<JsonData<ProgramPlanDayModel>>(`program-plan-days/${dayId}/restore`);
  },
};
```

- [ ] **Step 4: Verify**

Run (from `client/`): `npm run lint` then `npx tsc -b --noEmit`
Expected: clean. If tsc reports a missing generated type, go back to Step 1 — do not work around it.

- [ ] **Step 5: Commit**

```bash
git add client/src/services client/src/shared/utils
git commit -m "feat(program-ui): programPlanService and DateOnly helpers"
```

---

### Task 2: Shared month grid + program display maps

Extract the generic month-matrix math out of the workout Calendar page so the program calendar (Task 9) reuses it, and centralize every enum→label/style map so Program, ProgramBuilder, ProgramCalendar and the Today card render statuses identically.

**Files:**
- Create: `client/src/shared/utils/monthGrid.ts` (moved from `pages/Calendar/utils/calendar.ts`)
- Modify: `client/src/pages/Calendar/utils/calendar.ts` (re-export the moved pieces; keep workout-specific functions)
- Create: `client/src/shared/utils/programDisplay.ts`

**Interfaces:**
- Produces: `buildMonthMatrix(year, month): CalendarCell[]`, `toDayKey(date: Date): string`, `WEEKDAY_LABELS`, `MONTH_LABELS`, `isFutureDate`, `type CalendarCell` (all previously private to the Calendar page — signatures unchanged so `CalendarGrid.tsx`/`useCalendarPage.ts`/`MonthPickerModal.tsx` compile untouched).
- Produces: `TRAINING_GOAL_LABELS`, `SCHEDULE_TYPE_LABELS`, `PLAN_STATUS_LABELS`, `DAY_STATUS_LABELS`, `DAY_TYPE_LABELS`, `WEEKDAY_NAMES`, `WEEKDAYS_MONDAY_FIRST`, `DAY_STATUS_CELL_CLASSES`, `PLAN_STATUS_BADGE_CLASSES`, `estimateTotalWorkouts`, `formatPlanDuration`.

- [ ] **Step 1: Create `client/src/shared/utils/monthGrid.ts`** — cut the following from `pages/Calendar/utils/calendar.ts` verbatim (they contain no workout-specific logic): `WEEKDAY_LABELS`, `MONTH_LABELS`, `DAYS_PER_WEEK`, `type CalendarCell`, `toDayKey` (make it exported), `buildMonthMatrix`, `startOfDay`, `isFutureDate`.

```ts
/** Generic Monday-first month grid shared by the workout calendar and program calendar. */

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAYS_PER_WEEK = 7;

export type CalendarCell = {
  date: Date;
  dayKey: string;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
};

export function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function buildMonthMatrix(year: number, month: number): CalendarCell[] {
  const firstOfMonth = new Date(year, month - 1, 1);
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const cellCount = Math.ceil((mondayOffset + daysInMonth) / DAYS_PER_WEEK) * DAYS_PER_WEEK;
  const start = new Date(year, month - 1, 1 - mondayOffset);
  const todayKey = toDayKey(new Date());

  const cells: CalendarCell[] = [];
  for (let index = 0; index < cellCount; index += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    const dayKey = toDayKey(date);
    cells.push({
      date,
      dayKey,
      dayOfMonth: date.getDate(),
      isCurrentMonth: date.getMonth() === month - 1 && date.getFullYear() === year,
      isToday: dayKey === todayKey,
    });
  }

  return cells;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isFutureDate(date: Date): boolean {
  return startOfDay(date).getTime() > startOfDay(new Date()).getTime();
}
```

- [ ] **Step 2: Slim `client/src/pages/Calendar/utils/calendar.ts`** — delete the moved code and add at the top:

```ts
export {
  WEEKDAY_LABELS,
  MONTH_LABELS,
  buildMonthMatrix,
  isFutureDate,
  toDayKey,
  type CalendarCell,
} from "@/shared/utils/monthGrid";
```

Keep `getWorkoutDayKey`, `groupWorkoutsByDay`, `formatMonthDuration`, `formatDayLabel`, `formatWorkoutTime`, `formatSelectedDayLabel`, `computeCurrentStreak` in place, importing `toDayKey`/`startOfDay` from `@/shared/utils/monthGrid` where they used the local copies (add `import { startOfDay, toDayKey } from "@/shared/utils/monthGrid";`). The existing Calendar page files (`CalendarGrid.tsx`, `useCalendarPage.ts`, `MonthPickerModal.tsx`) keep importing from `../utils/calendar` and must compile with **zero changes**.

- [ ] **Step 3: Create `client/src/shared/utils/programDisplay.ts`**

```ts
import {
  DayOfWeek,
  ProgramPlanDayStatus,
  ProgramPlanDayType,
  ProgramPlanStatus,
  ProgramScheduleType,
  TrainingGoal,
} from "@/types";
import type { ProgramPlanModel } from "@/types";
import { diffDaysInclusive, parseDateOnly } from "@/shared/utils/dateOnly";

export const TRAINING_GOAL_LABELS: Record<TrainingGoal, string> = {
  [TrainingGoal.GeneralFitness]: "General fitness",
  [TrainingGoal.Hypertrophy]: "Hypertrophy",
  [TrainingGoal.Strength]: "Strength",
  [TrainingGoal.FatLoss]: "Fat loss",
  [TrainingGoal.Endurance]: "Endurance",
  [TrainingGoal.Maintenance]: "Maintenance",
};

export const SCHEDULE_TYPE_LABELS: Record<ProgramScheduleType, string> = {
  [ProgramScheduleType.FixedWeekdays]: "Fixed weekdays",
  [ProgramScheduleType.Rotation]: "Rotation",
  [ProgramScheduleType.CustomCalendar]: "Custom calendar",
};

export const PLAN_STATUS_LABELS: Record<ProgramPlanStatus, string> = {
  [ProgramPlanStatus.Draft]: "Draft",
  [ProgramPlanStatus.Active]: "Active",
  [ProgramPlanStatus.Paused]: "Paused",
  [ProgramPlanStatus.Completed]: "Completed",
  [ProgramPlanStatus.Cancelled]: "Cancelled",
};

export const DAY_STATUS_LABELS: Record<ProgramPlanDayStatus, string> = {
  [ProgramPlanDayStatus.Scheduled]: "Scheduled",
  [ProgramPlanDayStatus.Started]: "Started",
  [ProgramPlanDayStatus.Completed]: "Completed",
  [ProgramPlanDayStatus.Skipped]: "Skipped",
  [ProgramPlanDayStatus.Missed]: "Missed",
  [ProgramPlanDayStatus.Rescheduled]: "Rescheduled",
  [ProgramPlanDayStatus.Cancelled]: "Cancelled",
};

export const DAY_TYPE_LABELS: Record<ProgramPlanDayType, string> = {
  [ProgramPlanDayType.Workout]: "Workout",
  [ProgramPlanDayType.Rest]: "Rest",
  [ProgramPlanDayType.OptionalWorkout]: "Optional workout",
  [ProgramPlanDayType.Recovery]: "Recovery",
  [ProgramPlanDayType.Deload]: "Deload",
};

export const WEEKDAY_NAMES: Record<DayOfWeek, string> = {
  [DayOfWeek.Sunday]: "Sunday",
  [DayOfWeek.Monday]: "Monday",
  [DayOfWeek.Tuesday]: "Tuesday",
  [DayOfWeek.Wednesday]: "Wednesday",
  [DayOfWeek.Thursday]: "Thursday",
  [DayOfWeek.Friday]: "Friday",
  [DayOfWeek.Saturday]: "Saturday",
};

/** Builder + summaries render Monday-first; DayOfWeek numeric values stay .NET's (Sunday=0). */
export const WEEKDAYS_MONDAY_FIRST: DayOfWeek[] = [
  DayOfWeek.Monday,
  DayOfWeek.Tuesday,
  DayOfWeek.Wednesday,
  DayOfWeek.Thursday,
  DayOfWeek.Friday,
  DayOfWeek.Saturday,
  DayOfWeek.Sunday,
];

/**
 * Distinct visual state per day status for calendar cells and status chips.
 * Tokens verified against index.css: --color-success/-warning/-danger (+ -soft/-border),
 * text-success/text-danger utilities, primary-* Tailwind scale.
 */
export const DAY_STATUS_CELL_CLASSES: Record<ProgramPlanDayStatus, string> = {
  [ProgramPlanDayStatus.Scheduled]:
    "border border-primary-300/40 bg-primary-100/10 font-semibold text-foreground",
  [ProgramPlanDayStatus.Started]: "bg-primary font-bold text-white",
  [ProgramPlanDayStatus.Completed]:
    "border border-(--color-success-border) bg-(--color-success-soft) font-semibold text-success",
  [ProgramPlanDayStatus.Skipped]: "bg-(--glass-bg-soft) text-muted line-through",
  [ProgramPlanDayStatus.Missed]:
    "border border-(--color-danger-border) bg-(--color-danger-soft) text-danger",
  [ProgramPlanDayStatus.Rescheduled]:
    "border border-(--color-warning-border) bg-(--color-warning-soft) text-(--color-warning)",
  [ProgramPlanDayStatus.Cancelled]: "text-muted opacity-40",
};

export const PLAN_STATUS_BADGE_CLASSES: Record<ProgramPlanStatus, string> = {
  [ProgramPlanStatus.Draft]: "bg-(--glass-bg-soft) text-secondary",
  [ProgramPlanStatus.Active]:
    "border border-(--color-success-border) bg-(--color-success-soft) text-success",
  [ProgramPlanStatus.Paused]:
    "border border-(--color-warning-border) bg-(--color-warning-soft) text-(--color-warning)",
  [ProgramPlanStatus.Completed]: "bg-primary-100/15 text-primary",
  [ProgramPlanStatus.Cancelled]: "bg-(--glass-bg-soft) text-muted",
};

/** "4 weeks" / "27 days" for fixed-length plans, "Open-ended" otherwise. */
export function formatPlanDuration(plan: ProgramPlanModel): string {
  if (!plan.endDate) {
    return "Open-ended";
  }

  const totalDays = diffDaysInclusive(plan.startDate, plan.endDate);
  if (totalDays < 14) {
    return `${totalDays} day${totalDays === 1 ? "" : "s"}`;
  }

  const weeks = Math.round(totalDays / 7);
  return `${weeks} week${weeks === 1 ? "" : "s"}`;
}

/**
 * Client-side total-workout estimate for the activation card (spec §33).
 * Matches the server generator for weekInterval=1 rules (the only kind the builder writes).
 * Returns null for open-ended plans (no denominator) and for custom plans when
 * `customDayCount` is unknown.
 */
export function estimateTotalWorkouts(
  plan: ProgramPlanModel,
  customDayCount?: number,
): number | null {
  if (plan.scheduleType === ProgramScheduleType.CustomCalendar) {
    return customDayCount ?? null;
  }

  if (!plan.endDate) {
    return null;
  }

  const totalDays = diffDaysInclusive(plan.startDate, plan.endDate);
  if (totalDays <= 0) {
    return 0;
  }

  const workoutRules = plan.scheduleRules.filter(
    (rule) => rule.dayType !== ProgramPlanDayType.Rest,
  );

  if (plan.scheduleType === ProgramScheduleType.FixedWeekdays) {
    let count = 0;
    const cursor = parseDateOnly(plan.startDate);
    for (let index = 0; index < totalDays; index += 1) {
      const weekday = cursor.getDay() as DayOfWeek;
      count += workoutRules.filter((rule) => rule.dayOfWeek === weekday).length;
      cursor.setDate(cursor.getDate() + 1);
    }
    return count;
  }

  // Rotation: cycle length is the highest rotation index (rest rules define the cycle too).
  const cycleLength = Math.max(0, ...plan.scheduleRules.map((rule) => rule.rotationDayIndex ?? 0));
  if (cycleLength === 0) {
    return 0;
  }

  const workoutIndexes = workoutRules.map((rule) => rule.rotationDayIndex ?? 0);
  const fullCycles = Math.floor(totalDays / cycleLength);
  const remainder = totalDays % cycleLength;
  return (
    fullCycles * workoutIndexes.length +
    workoutIndexes.filter((index) => index <= remainder).length
  );
}
```

> Verify at execution time: enum member names above (`TrainingGoal.GeneralFitness` … `ProgramPlanDayStatus.Cancelled`, `DayOfWeek.Sunday = 0`) against the regenerated `client/src/types/backend.ts`; `--glass-bg-soft` token against `client/src/index.css`.

- [ ] **Step 4: Verify** — from `client/`: `npm run lint` && `npx tsc -b --noEmit`. Expected: clean; the Calendar page compiles with no component changes.

- [ ] **Step 5: Commit**

```bash
git add client/src/shared/utils client/src/pages/Calendar
git commit -m "feat(program-ui): shared month grid and program display maps"
```

---

### Task 3: TemplatePickerModal (shared)

The Templates page has no reusable picker (its `TemplateListItem` is a full-width card with its own action menu — inspected, not reusable as a picker row), so build a compact search-and-pick modal. It lives in `shared/components` because the program builder uses it in three editors and Plan 07's AI preview cards will reuse it.

**Files:**
- Create: `client/src/shared/components/TemplatePickerModal.tsx`
- Modify: `client/src/shared/components/index.ts`

**Interfaces:**
- Consumes: `workoutTemplateService.list()`, `Modal`, `unwrap`, `WorkoutTemplateModel` from `@/types`.
- Produces: `<TemplatePickerModal isOpen onClose onSelect(template: WorkoutTemplateModel) />` — Tasks 5, 6 consume it.

- [ ] **Step 1: Write the component**

```tsx
import { useEffect, useMemo, useState } from "react";
import { LuClock, LuDumbbell, LuLoaderCircle, LuSearch } from "react-icons/lu";
import { unwrap } from "@/lib/unwrap";
import { workoutTemplateService } from "@/services/workoutTemplateService";
import type { WorkoutTemplateModel } from "@/types";
import { Modal } from "./Modal";

type TemplatePickerModalProps = {
  isOpen: boolean;
  title?: string;
  onClose: () => void;
  onSelect: (template: WorkoutTemplateModel) => void;
};

export function TemplatePickerModal({
  isOpen,
  title = "Choose a workout template",
  onClose,
  onSelect,
}: TemplatePickerModalProps) {
  const [templates, setTemplates] = useState<WorkoutTemplateModel[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!isOpen || templates !== null) {
      return;
    }

    let cancelled = false;

    async function loadTemplates() {
      setError(null);
      try {
        const response = await workoutTemplateService.list();
        if (!cancelled) {
          setTemplates(unwrap(response.data, "Unable to load templates."));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load templates.");
        }
      }
    }

    void loadTemplates();

    return () => {
      cancelled = true;
    };
  }, [isOpen, templates]);

  const filteredTemplates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const all = templates ?? [];
    if (!normalizedQuery) {
      return all;
    }

    return all.filter((template) => template.name.toLowerCase().includes(normalizedQuery));
  }, [templates, query]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="lg">
      <div className="flex max-h-[70vh] flex-col gap-3 p-5">
        <label className="liquid-input flex items-center gap-2 rounded-full px-3 py-2.5">
          <LuSearch className="h-4 w-4 shrink-0 text-muted" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search templates..."
            className="w-full bg-transparent text-sm outline-none"
            autoFocus
          />
        </label>

        {error ? (
          <p className="py-6 text-center text-sm text-danger">{error}</p>
        ) : templates === null ? (
          <p className="flex items-center justify-center gap-2 py-6 text-sm text-secondary">
            <LuLoaderCircle className="h-4 w-4 animate-spin" />
            Loading templates...
          </p>
        ) : filteredTemplates.length === 0 ? (
          <p className="py-6 text-center text-sm text-secondary">
            {templates.length === 0
              ? "No templates yet — create one on the Templates page first."
              : "No templates match your search."}
          </p>
        ) : (
          <div className="-mx-1 flex-1 space-y-2 overflow-y-auto px-1">
            {filteredTemplates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => onSelect(template)}
                className="liquid-panel flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition hover:border-primary-300/60"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-foreground">
                    {template.name}
                  </span>
                  <span className="mt-0.5 flex items-center gap-3 text-xs text-secondary">
                    <span className="inline-flex items-center gap-1">
                      <LuDumbbell className="h-3.5 w-3.5 text-primary" />
                      {template.exerciseCount} exercise{template.exerciseCount === 1 ? "" : "s"}
                    </span>
                    {template.estimatedDurationMinutes ? (
                      <span className="inline-flex items-center gap-1">
                        <LuClock className="h-3.5 w-3.5 text-primary" />
                        {template.estimatedDurationMinutes} min
                      </span>
                    ) : null}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Export it** — in `client/src/shared/components/index.ts` add (alphabetical position):

```ts
export { TemplatePickerModal } from "./TemplatePickerModal";
```

- [ ] **Step 3: Verify** — `npm run lint` && `npx tsc -b --noEmit`. Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add client/src/shared/components
git commit -m "feat(program-ui): shared workout template picker modal"
```

---

### Task 4: /program overview page + route + sidebar nav

**Files:**
- Create: `client/src/pages/Program/Program.tsx`, `client/src/pages/Program/index.ts`
- Create: `client/src/pages/Program/hooks/useProgramPage.ts`
- Create: `client/src/pages/Program/components/ProgramProgressCard.tsx`, `client/src/pages/Program/components/PlanListItem.tsx`
- Modify: `client/src/routes.tsx` (new `program` route block)
- Modify: `client/src/components/navigation.ts` (desktop sidebar entry)

**Interfaces:**
- Consumes: `programPlanService`, `todayDateOnlyString`, `formatDateOnly`, display maps from Task 2, `AsyncSection`/`PageHeader`/`PageBody`/`ActionMenu`/`DeleteConfirmationModal`.
- Produces: route `/program`; `ProgramProgressCard` (props `{ progress: ProgramProgressModel }`) reused by Task 8; `useProgramPage` returning `{ state, actions }`.

- [ ] **Step 1: Write `hooks/useProgramPage.ts`**

```ts
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { unwrap } from "@/lib/unwrap";
import { programPlanService } from "@/services/programPlanService";
import { todayDateOnlyString } from "@/shared/utils/dateOnly";
import { ProgramPlanStatus } from "@/types";
import type { ProgramPlanModel, ProgramProgressModel, ProgramTodayModel } from "@/types";

export function useProgramPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<ProgramPlanModel[] | null>(null);
  const [progress, setProgress] = useState<ProgramProgressModel | null>(null);
  const [todayModel, setTodayModel] = useState<ProgramTodayModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadIndex, setReloadIndex] = useState(0);
  const [planPendingDelete, setPlanPendingDelete] = useState<ProgramPlanModel | null>(null);
  const [deletingPlanId, setDeletingPlanId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPrograms() {
      setIsLoading(true);
      setError(null);

      try {
        const localDate = todayDateOnlyString();
        const listResponse = await programPlanService.list();
        const allPlans = unwrap(listResponse.data, "Unable to load programs.");
        const active = allPlans.find((plan) => plan.status === ProgramPlanStatus.Active) ?? null;

        let nextProgress: ProgramProgressModel | null = null;
        let nextToday: ProgramTodayModel | null = null;
        if (active) {
          const [progressResponse, todayResponse] = await Promise.all([
            programPlanService.getProgress(active.id, localDate),
            programPlanService.getToday(localDate),
          ]);
          nextProgress = unwrap(progressResponse.data, "Unable to load progress.");
          nextToday = unwrap(todayResponse.data, "Unable to load today's schedule.");
        }

        if (!cancelled) {
          setPlans(allPlans);
          setProgress(nextProgress);
          setTodayModel(nextToday);
        }
      } catch (loadError) {
        if (!cancelled) {
          setPlans(null);
          setError(loadError instanceof Error ? loadError.message : "Unable to load programs.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadPrograms();

    return () => {
      cancelled = true;
    };
  }, [reloadIndex]);

  const activePlan = useMemo(
    () => (plans ?? []).find((plan) => plan.status === ProgramPlanStatus.Active) ?? null,
    [plans],
  );

  const otherPlans = useMemo(
    () => (plans ?? []).filter((plan) => plan.status !== ProgramPlanStatus.Active),
    [plans],
  );

  const open = useCallback(
    (plan: ProgramPlanModel) => navigate(`/program/${plan.id}`),
    [navigate],
  );

  const edit = useCallback(
    (plan: ProgramPlanModel) => navigate(`/program/${plan.id}/edit`),
    [navigate],
  );

  const create = useCallback(() => navigate("/program/new"), [navigate]);

  const openCalendar = useCallback(
    (plan: ProgramPlanModel) => navigate(`/program/${plan.id}/calendar`),
    [navigate],
  );

  const requestDelete = useCallback((plan: ProgramPlanModel) => {
    setPlanPendingDelete(plan);
  }, []);

  const cancelDelete = useCallback(() => {
    if (deletingPlanId === null) {
      setPlanPendingDelete(null);
    }
  }, [deletingPlanId]);

  const confirmDelete = useCallback(async () => {
    if (!planPendingDelete || deletingPlanId !== null) {
      return;
    }

    setDeletingPlanId(planPendingDelete.id);

    try {
      const response = await programPlanService.remove(planPendingDelete.id);
      unwrap(response.data, "Unable to delete program.");
      toast.success("Draft deleted.");
      setPlanPendingDelete(null);
      setReloadIndex((index) => index + 1);
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Unable to delete program.");
    } finally {
      setDeletingPlanId(null);
    }
  }, [deletingPlanId, planPendingDelete]);

  const state = useMemo(
    () => ({
      isLoading,
      error,
      activePlan,
      otherPlans,
      progress,
      todayModel,
      planPendingDelete,
      deletingPlanId,
    }),
    [isLoading, error, activePlan, otherPlans, progress, todayModel, planPendingDelete, deletingPlanId],
  );

  const actions = useMemo(
    () => ({
      open,
      edit,
      create,
      openCalendar,
      requestDelete,
      cancelDelete,
      confirmDelete,
      reload: () => setReloadIndex((index) => index + 1),
    }),
    [open, edit, create, openCalendar, requestDelete, cancelDelete, confirmDelete],
  );

  return { state, actions };
}
```

- [ ] **Step 2: Write `components/ProgramProgressCard.tsx`** — spec progress display: scheduled, completed, missed, skipped, remaining, completion % (hidden when null = open-ended), adherence %, streak.

```tsx
import type { ProgramProgressModel } from "@/types";

type ProgramProgressCardProps = {
  progress: ProgramProgressModel;
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-(--glass-bg-soft) px-3 py-2.5 text-center">
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="text-2xs font-semibold uppercase tracking-widest text-muted">{label}</p>
    </div>
  );
}

export function ProgramProgressCard({ progress }: ProgramProgressCardProps) {
  return (
    <section className="liquid-panel rounded-2xl p-4 md:rounded-lg">
      {progress.completionPercentage != null ? (
        <div className="mb-4">
          <div className="mb-1 flex items-baseline justify-between">
            <p className="text-sm font-semibold text-foreground">Program completion</p>
            <p className="text-sm font-bold text-primary">{progress.completionPercentage}%</p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-(--glass-bg-soft)">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, Math.max(0, Number(progress.completionPercentage)))}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <Stat label="Planned" value={String(progress.scheduledWorkouts)} />
        <Stat label="Done" value={String(progress.completedWorkouts)} />
        <Stat label="Missed" value={String(progress.missedWorkouts)} />
        <Stat label="Skipped" value={String(progress.skippedWorkouts)} />
        <Stat label="Left" value={String(progress.remainingWorkouts)} />
        <Stat label="Streak" value={String(progress.currentStreak)} />
      </div>

      <p className="mt-3 text-xs text-secondary">
        Adherence <span className="font-bold text-foreground">{progress.adherencePercentage}%</span>{" "}
        of due workouts completed
      </p>
    </section>
  );
}
```

- [ ] **Step 3: Write `components/PlanListItem.tsx`**

```tsx
import { LuCalendarDays, LuEye, LuLoaderCircle, LuPencil, LuTrash2 } from "react-icons/lu";
import { ActionMenu, type ActionMenuItem } from "@/shared/components";
import { formatDateOnly } from "@/shared/utils/dateOnly";
import {
  PLAN_STATUS_BADGE_CLASSES,
  PLAN_STATUS_LABELS,
  SCHEDULE_TYPE_LABELS,
  TRAINING_GOAL_LABELS,
  formatPlanDuration,
} from "@/shared/utils/programDisplay";
import { ProgramPlanStatus } from "@/types";
import type { ProgramPlanModel } from "@/types";

type PlanListItemProps = {
  plan: ProgramPlanModel;
  isDeleting: boolean;
  onOpen: (plan: ProgramPlanModel) => void;
  onEdit: (plan: ProgramPlanModel) => void;
  onOpenCalendar: (plan: ProgramPlanModel) => void;
  onDelete: (plan: ProgramPlanModel) => void;
};

export function PlanListItem({
  plan,
  isDeleting,
  onOpen,
  onEdit,
  onOpenCalendar,
  onDelete,
}: PlanListItemProps) {
  const isDraft = plan.status === ProgramPlanStatus.Draft;

  const menuItems: ActionMenuItem[] = [
    {
      key: "view",
      label: "View",
      icon: <LuEye className="h-4 w-4 shrink-0" />,
      onSelect: () => onOpen(plan),
    },
    {
      key: "calendar",
      label: "Calendar",
      icon: <LuCalendarDays className="h-4 w-4 shrink-0" />,
      onSelect: () => onOpenCalendar(plan),
    },
  ];

  if (isDraft) {
    menuItems.push(
      {
        key: "edit",
        label: "Edit draft",
        icon: <LuPencil className="h-4 w-4 shrink-0" />,
        onSelect: () => onEdit(plan),
      },
      {
        key: "delete",
        label: "Delete draft",
        icon: isDeleting ? (
          <LuLoaderCircle className="h-4 w-4 shrink-0 animate-spin" />
        ) : (
          <LuTrash2 className="h-4 w-4 shrink-0" />
        ),
        onSelect: () => onDelete(plan),
        variant: "danger",
        disabled: isDeleting,
      },
    );
  }

  return (
    <article className="liquid-panel flex items-center justify-between gap-3 rounded-2xl p-4">
      <button
        type="button"
        onClick={() => onOpen(plan)}
        className="min-w-0 flex-1 cursor-pointer text-left"
        aria-label={`Open ${plan.name}`}
      >
        <div className="flex items-center gap-2">
          <h2 className="truncate text-base font-bold text-foreground">{plan.name}</h2>
          <span
            className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-2xs font-semibold uppercase tracking-wide ${PLAN_STATUS_BADGE_CLASSES[plan.status]}`}
          >
            {PLAN_STATUS_LABELS[plan.status]}
          </span>
        </div>
        <p className="mt-1 truncate text-xs text-secondary">
          {TRAINING_GOAL_LABELS[plan.goal]} · {SCHEDULE_TYPE_LABELS[plan.scheduleType]} ·{" "}
          {formatDateOnly(plan.startDate)} · {formatPlanDuration(plan)}
        </p>
      </button>
      <ActionMenu triggerAriaLabel={`${plan.name} actions`} items={menuItems} />
    </article>
  );
}
```

- [ ] **Step 4: Write `Program.tsx` and `index.ts`**

`Program.tsx`:

```tsx
import { LuCalendarDays, LuPlus } from "react-icons/lu";
import {
  AsyncSection,
  DeleteConfirmationModal,
  PageBody,
  PageHeader,
} from "@/shared/components";
import { formatDateOnly } from "@/shared/utils/dateOnly";
import { PlanListItem } from "./components/PlanListItem";
import { ProgramProgressCard } from "./components/ProgramProgressCard";
import { useProgramPage } from "./hooks/useProgramPage";

export default function Program() {
  const { state, actions } = useProgramPage();
  const nextWorkout = state.todayModel?.today ?? state.todayModel?.nextWorkout ?? null;
  const activePlan = state.activePlan;

  return (
    <>
      <PageHeader
        title="Program"
        subtitle="Your training plan, day by day"
        actions={
          <button
            type="button"
            onClick={actions.create}
            className="liquid-primary-btn inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold"
          >
            <LuPlus className="h-4 w-4" />
            <span>New program</span>
          </button>
        }
      />

      <PageBody>
        <AsyncSection
          isLoading={state.isLoading}
          error={state.error}
          onRetry={actions.reload}
          loadingLabel="Loading your program..."
          isEmpty={!activePlan && state.otherPlans.length === 0}
          emptyState={
            <div className="liquid-panel mx-auto max-w-4xl rounded-2xl px-5 py-10 text-center md:rounded-lg">
              <p className="text-base font-bold text-foreground">No program yet</p>
              <p className="mt-1 text-sm text-secondary">
                Build a plan from your workout templates and always know what to train.
              </p>
              <button
                type="button"
                onClick={actions.create}
                className="liquid-primary-btn mt-5 inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold"
              >
                <LuPlus className="h-4 w-4" />
                <span>Create a plan</span>
              </button>
            </div>
          }
        >
          <div className="mx-auto grid max-w-4xl gap-4">
            {activePlan ? (
              <section className="grid gap-3">
                <PlanListItem
                  plan={activePlan}
                  isDeleting={false}
                  onOpen={actions.open}
                  onEdit={actions.edit}
                  onOpenCalendar={actions.openCalendar}
                  onDelete={actions.requestDelete}
                />
                {state.progress ? <ProgramProgressCard progress={state.progress} /> : null}
                {nextWorkout ? (
                  <button
                    type="button"
                    onClick={() => actions.openCalendar(activePlan)}
                    className="liquid-panel flex cursor-pointer items-center gap-3 rounded-2xl p-4 text-left transition hover:border-primary-300/60"
                  >
                    <LuCalendarDays className="h-5 w-5 shrink-0 text-primary" />
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold uppercase tracking-widest text-muted">
                        Next up
                      </span>
                      <span className="block truncate text-sm font-bold text-foreground">
                        {nextWorkout.workoutTemplateName ?? "Workout"} ·{" "}
                        {formatDateOnly(nextWorkout.scheduledDate)}
                      </span>
                    </span>
                  </button>
                ) : null}
              </section>
            ) : null}

            {state.otherPlans.length > 0 ? (
              <section className="grid gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
                  Other programs
                </h2>
                {state.otherPlans.map((plan) => (
                  <PlanListItem
                    key={plan.id}
                    plan={plan}
                    isDeleting={state.deletingPlanId === plan.id}
                    onOpen={actions.open}
                    onEdit={actions.edit}
                    onOpenCalendar={actions.openCalendar}
                    onDelete={actions.requestDelete}
                  />
                ))}
              </section>
            ) : null}
          </div>
        </AsyncSection>
      </PageBody>

      <DeleteConfirmationModal
        isOpen={Boolean(state.planPendingDelete)}
        itemName={state.planPendingDelete?.name ?? ""}
        title="Delete draft"
        isDeleting={state.deletingPlanId !== null}
        onCancel={actions.cancelDelete}
        onConfirm={actions.confirmDelete}
      />
    </>
  );
}
```

`index.ts`:

```ts
export { default } from "./Program";
```

- [ ] **Step 5: Add the route block** — in `client/src/routes.tsx` add the import and, after the `templates` block, the new route:

```tsx
import Program from "./pages/Program";
```

```tsx
      {
        path: "program",
        element: (
          <AccessGate requireAuthenticated>
            <Outlet />
          </AccessGate>
        ),
        children: [
          {
            index: true,
            element: <Program />,
          },
        ],
      },
```

- [ ] **Step 6: Add the sidebar entry** — in `client/src/components/navigation.ts` import `LuCalendarCheck` (verify the icon name exists in `react-icons/lu` at execution time; fall back to `LuClipboardList`) and insert into `trainingNavItems` after "New workout":

```ts
  { label: "Program", to: "/program", icon: LuCalendarCheck, end: false },
```

Leave `mobileBottomNavItems` unchanged — it already holds five slots; on mobile the program is reached via the sidebar drawer and the Today card (Task 10).

- [ ] **Step 7: Verify** — `npm run lint` && `npx tsc -b --noEmit`. Expected: clean. Optionally `npm run dev` and open `/program`: empty state with "Create a plan" CTA (the CTA targets `/program/new`, which lands in Task 5).

- [ ] **Step 8: Commit**

```bash
git add client/src
git commit -m "feat(program-ui): program overview page with progress and plan list"
```

---

### Task 5: ProgramBuilder — state model, metadata panel, fixed-weekdays editor, save draft

**Files:**
- Create: `client/src/pages/ProgramBuilder/utils/builderState.ts`
- Create: `client/src/pages/ProgramBuilder/hooks/useProgramBuilderPage.ts`
- Create: `client/src/pages/ProgramBuilder/components/ProgramMetadataPanel.tsx`, `client/src/pages/ProgramBuilder/components/FixedWeekdaysEditor.tsx`
- Create: `client/src/pages/ProgramBuilder/ProgramBuilder.tsx`, `client/src/pages/ProgramBuilder/index.ts`
- Modify: `client/src/routes.tsx` (add `new` child to the `program` block)

**Interfaces:**
- Consumes: `TemplatePickerModal` (Task 3), display maps (Task 2), `programPlanService.create/update`, generated `SaveProgramPlanRequest`/`ProgramScheduleRuleRequest`/`CustomProgramDayRequest` + enums.
- Produces (Tasks 6–7 extend these exact names): `ProgramBuilderState`, `WeekdaySlot`, `RotationSlot`, `CustomDayEntry`, `createInitialState()`, `buildSaveRequest(state)`, `validateBuilderState(state)`, `deriveTargetWorkoutsPerWeek(state)`, `type PickerTarget`, hook `useProgramBuilderPage`.

- [ ] **Step 1: Write `utils/builderState.ts`** (UI view-model file — allowed because it is not a service file; it maps to/from generated request types)

```ts
import { createLocalId, clampNumber } from "@/lib/helpers";
import { diffDaysInclusive, toDateOnlyString } from "@/shared/utils/dateOnly";
import { WEEKDAYS_MONDAY_FIRST } from "@/shared/utils/programDisplay";
import { DayOfWeek, ProgramPlanDayType, ProgramScheduleType, TrainingGoal } from "@/types";
import type {
  CustomProgramDayRequest,
  ProgramScheduleRuleRequest,
  SaveProgramPlanRequest,
} from "@/types";

export type WeekdaySlot = {
  dayOfWeek: DayOfWeek;
  templateId: number | null;
  templateName: string | null;
};

export type RotationSlot = {
  localId: string;
  isRest: boolean;
  templateId: number | null;
  templateName: string | null;
};

export type CustomDayEntry = {
  localId: string;
  /** "yyyy-MM-dd" */
  date: string;
  templateId: number | null;
  templateName: string | null;
};

export type ProgramBuilderState = {
  name: string;
  description: string;
  goal: TrainingGoal;
  scheduleType: ProgramScheduleType;
  /** "yyyy-MM-dd" */
  startDate: string;
  /** Open-ended = EndDate null (roadmap D1). Forced off for CustomCalendar. */
  isOpenEnded: boolean;
  /** "yyyy-MM-dd"; ignored while isOpenEnded is true. */
  endDate: string;
  /** Always 7 entries, Monday-first. */
  weekdaySlots: WeekdaySlot[];
  rotationSlots: RotationSlot[];
  customDays: CustomDayEntry[];
};

function emptyWeekdaySlots(): WeekdaySlot[] {
  return WEEKDAYS_MONDAY_FIRST.map((dayOfWeek) => ({
    dayOfWeek,
    templateId: null,
    templateName: null,
  }));
}

export function createRotationSlot(isRest: boolean): RotationSlot {
  return { localId: createLocalId("rot"), isRest, templateId: null, templateName: null };
}

export function createCustomDayEntry(date: string): CustomDayEntry {
  return { localId: createLocalId("day"), date, templateId: null, templateName: null };
}

export function createInitialState(): ProgramBuilderState {
  const today = new Date();
  const inFourWeeks = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 27);
  return {
    name: "",
    description: "",
    goal: TrainingGoal.GeneralFitness,
    scheduleType: ProgramScheduleType.FixedWeekdays,
    startDate: toDateOnlyString(today),
    isOpenEnded: false,
    endDate: toDateOnlyString(inFourWeeks),
    weekdaySlots: emptyWeekdaySlots(),
    rotationSlots: [
      createRotationSlot(false),
      createRotationSlot(false),
      createRotationSlot(true),
    ],
    customDays: [],
  };
}

/** True when the request will carry an EndDate (CustomCalendar always does — spec/D1). */
export function hasEndDate(state: ProgramBuilderState): boolean {
  return !state.isOpenEnded || state.scheduleType === ProgramScheduleType.CustomCalendar;
}

/** First blocking problem, or null when the state can be submitted ("yyyy-MM-dd" compares lexically). */
export function validateBuilderState(state: ProgramBuilderState): string | null {
  if (!state.name.trim()) {
    return "Give the program a name.";
  }

  if (hasEndDate(state) && state.endDate < state.startDate) {
    return "The end date must be on or after the start date.";
  }

  if (state.scheduleType === ProgramScheduleType.FixedWeekdays) {
    if (state.weekdaySlots.every((slot) => slot.templateId === null)) {
      return "Assign a template to at least one weekday.";
    }
  }

  if (state.scheduleType === ProgramScheduleType.Rotation) {
    if (state.rotationSlots.length === 0) {
      return "Add at least one rotation day.";
    }
    if (!state.rotationSlots.some((slot) => !slot.isRest)) {
      return "A rotation needs at least one workout day.";
    }
    if (state.rotationSlots.some((slot) => !slot.isRest && slot.templateId === null)) {
      return "Every rotation workout day needs a template (or mark it as rest).";
    }
  }

  if (state.scheduleType === ProgramScheduleType.CustomCalendar) {
    if (state.customDays.length === 0) {
      return "Add at least one workout day.";
    }
    if (state.customDays.some((day) => day.templateId === null)) {
      return "Every custom day needs a template.";
    }
    if (state.customDays.some((day) => day.date < state.startDate || day.date > state.endDate)) {
      return "Custom days must fall between the start and end dates.";
    }
  }

  return null;
}

/** Server validates 1–7; derive instead of asking the user. */
export function deriveTargetWorkoutsPerWeek(state: ProgramBuilderState): number {
  if (state.scheduleType === ProgramScheduleType.FixedWeekdays) {
    const assigned = state.weekdaySlots.filter((slot) => slot.templateId !== null).length;
    return clampNumber(assigned, 1, 7);
  }

  if (state.scheduleType === ProgramScheduleType.Rotation) {
    const cycleLength = Math.max(1, state.rotationSlots.length);
    const workouts = state.rotationSlots.filter((slot) => !slot.isRest).length;
    return clampNumber(Math.round((workouts / cycleLength) * 7), 1, 7);
  }

  const totalDays = Math.max(1, diffDaysInclusive(state.startDate, state.endDate));
  const weeks = Math.max(1, totalDays / 7);
  return clampNumber(Math.round(state.customDays.length / weeks), 1, 7);
}

export function buildSaveRequest(state: ProgramBuilderState): SaveProgramPlanRequest {
  const scheduleRules: ProgramScheduleRuleRequest[] = [];

  if (state.scheduleType === ProgramScheduleType.FixedWeekdays) {
    state.weekdaySlots.forEach((slot, index) => {
      if (slot.templateId === null) {
        return;
      }
      scheduleRules.push({
        dayOfWeek: slot.dayOfWeek,
        dayType: ProgramPlanDayType.Workout,
        workoutTemplateId: slot.templateId,
        weekInterval: 1,
        orderIndex: index,
        isOptional: false,
      });
    });
  } else if (state.scheduleType === ProgramScheduleType.Rotation) {
    state.rotationSlots.forEach((slot, index) => {
      scheduleRules.push({
        rotationDayIndex: index + 1,
        dayType: slot.isRest ? ProgramPlanDayType.Rest : ProgramPlanDayType.Workout,
        workoutTemplateId: slot.isRest ? undefined : (slot.templateId ?? undefined),
        weekInterval: 1,
        orderIndex: index,
        isOptional: false,
      });
    });
  }

  const customDays: CustomProgramDayRequest[] =
    state.scheduleType === ProgramScheduleType.CustomCalendar
      ? [...state.customDays]
          .sort((left, right) => left.date.localeCompare(right.date))
          .map((day) => ({
            date: day.date,
            dayType: ProgramPlanDayType.Workout,
            workoutTemplateId: day.templateId ?? undefined,
          }))
      : [];

  return {
    name: state.name.trim(),
    description: state.description.trim() || undefined,
    goal: state.goal,
    scheduleType: state.scheduleType,
    startDate: state.startDate,
    endDate: hasEndDate(state) ? state.endDate : undefined,
    targetWorkoutsPerWeek: deriveTargetWorkoutsPerWeek(state),
    scheduleRules,
    customDays,
  };
}
```

> Verify at execution time: generated `SaveProgramPlanRequest` marks nullable members optional (`endDate?`, `description?`, `workoutTemplateId?`) — if `process-types` emitted them as `| null` instead, pass `null` rather than `undefined` in `buildSaveRequest`.

- [ ] **Step 2: Write `hooks/useProgramBuilderPage.ts`** (create-mode only in this task; Task 6 adds edit-mode loading, Task 7 adds activation)

```ts
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { unwrap } from "@/lib/unwrap";
import { programPlanService } from "@/services/programPlanService";
import { DayOfWeek, ProgramScheduleType, TrainingGoal } from "@/types";
import type { ProgramPlanModel, WorkoutTemplateModel } from "@/types";
import {
  buildSaveRequest,
  createCustomDayEntry,
  createInitialState,
  createRotationSlot,
  validateBuilderState,
  type ProgramBuilderState,
} from "../utils/builderState";

export type PickerTarget =
  | { kind: "weekday"; dayOfWeek: DayOfWeek }
  | { kind: "rotation"; localId: string }
  | { kind: "custom"; localId: string };

export function useProgramBuilderPage() {
  const navigate = useNavigate();
  const [builderState, setBuilderState] = useState<ProgramBuilderState>(createInitialState);
  const [isSaving, setIsSaving] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);

  const patch = useCallback((partial: Partial<ProgramBuilderState>) => {
    setBuilderState((current) => ({ ...current, ...partial }));
  }, []);

  const setName = useCallback((name: string) => patch({ name }), [patch]);
  const setDescription = useCallback((description: string) => patch({ description }), [patch]);
  const setGoal = useCallback((goal: TrainingGoal) => patch({ goal }), [patch]);
  const setStartDate = useCallback((startDate: string) => patch({ startDate }), [patch]);
  const setEndDate = useCallback((endDate: string) => patch({ endDate }), [patch]);

  const setScheduleType = useCallback(
    (scheduleType: ProgramScheduleType) =>
      setBuilderState((current) => ({
        ...current,
        scheduleType,
        // CustomCalendar requires an end date (roadmap D1).
        isOpenEnded: scheduleType === ProgramScheduleType.CustomCalendar ? false : current.isOpenEnded,
      })),
    [],
  );

  const setOpenEnded = useCallback((isOpenEnded: boolean) => patch({ isOpenEnded }), [patch]);

  const openPicker = useCallback((target: PickerTarget) => setPickerTarget(target), []);
  const closePicker = useCallback(() => setPickerTarget(null), []);

  const assignTemplate = useCallback(
    (template: WorkoutTemplateModel) => {
      setBuilderState((current) => {
        if (!pickerTarget) {
          return current;
        }

        if (pickerTarget.kind === "weekday") {
          return {
            ...current,
            weekdaySlots: current.weekdaySlots.map((slot) =>
              slot.dayOfWeek === pickerTarget.dayOfWeek
                ? { ...slot, templateId: template.id, templateName: template.name }
                : slot,
            ),
          };
        }

        if (pickerTarget.kind === "rotation") {
          return {
            ...current,
            rotationSlots: current.rotationSlots.map((slot) =>
              slot.localId === pickerTarget.localId
                ? { ...slot, isRest: false, templateId: template.id, templateName: template.name }
                : slot,
            ),
          };
        }

        return {
          ...current,
          customDays: current.customDays.map((day) =>
            day.localId === pickerTarget.localId
              ? { ...day, templateId: template.id, templateName: template.name }
              : day,
          ),
        };
      });
      setPickerTarget(null);
    },
    [pickerTarget],
  );

  const clearWeekday = useCallback((dayOfWeek: DayOfWeek) => {
    setBuilderState((current) => ({
      ...current,
      weekdaySlots: current.weekdaySlots.map((slot) =>
        slot.dayOfWeek === dayOfWeek ? { ...slot, templateId: null, templateName: null } : slot,
      ),
    }));
  }, []);

  const addRotationDay = useCallback(() => {
    setBuilderState((current) => ({
      ...current,
      rotationSlots: [...current.rotationSlots, createRotationSlot(true)],
    }));
  }, []);

  const removeRotationDay = useCallback((localId: string) => {
    setBuilderState((current) => ({
      ...current,
      rotationSlots: current.rotationSlots.filter((slot) => slot.localId !== localId),
    }));
  }, []);

  const setRotationRest = useCallback((localId: string) => {
    setBuilderState((current) => ({
      ...current,
      rotationSlots: current.rotationSlots.map((slot) =>
        slot.localId === localId
          ? { ...slot, isRest: true, templateId: null, templateName: null }
          : slot,
      ),
    }));
  }, []);

  const addCustomDay = useCallback(() => {
    setBuilderState((current) => ({
      ...current,
      customDays: [...current.customDays, createCustomDayEntry(current.startDate)],
    }));
  }, []);

  const removeCustomDay = useCallback((localId: string) => {
    setBuilderState((current) => ({
      ...current,
      customDays: current.customDays.filter((day) => day.localId !== localId),
    }));
  }, []);

  const setCustomDayDate = useCallback((localId: string, date: string) => {
    setBuilderState((current) => ({
      ...current,
      customDays: current.customDays.map((day) =>
        day.localId === localId ? { ...day, date } : day,
      ),
    }));
  }, []);

  const saveDraftInternal = useCallback(async (): Promise<ProgramPlanModel | null> => {
    const validationError = validateBuilderState(builderState);
    if (validationError) {
      toast.error(validationError);
      return null;
    }

    setIsSaving(true);

    try {
      const payload = buildSaveRequest(builderState);
      const response = await programPlanService.create(payload);
      return unwrap(response.data, "Unable to save program.");
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Unable to save program.");
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [builderState]);

  const saveDraft = useCallback(async () => {
    const saved = await saveDraftInternal();
    if (saved) {
      toast.success("Draft saved.");
      navigate(`/program/${saved.id}`);
    }
  }, [navigate, saveDraftInternal]);

  const state = useMemo(
    () => ({
      builderState,
      isLoading: false,
      loadError: null as string | null,
      isEditing: false,
      isSaving,
      isPickerOpen: pickerTarget !== null,
    }),
    [builderState, isSaving, pickerTarget],
  );

  const actions = useMemo(
    () => ({
      setName,
      setDescription,
      setGoal,
      setScheduleType,
      setStartDate,
      setEndDate,
      setOpenEnded,
      openPicker,
      closePicker,
      assignTemplate,
      clearWeekday,
      addRotationDay,
      removeRotationDay,
      setRotationRest,
      addCustomDay,
      removeCustomDay,
      setCustomDayDate,
      saveDraft,
    }),
    [
      setName,
      setDescription,
      setGoal,
      setScheduleType,
      setStartDate,
      setEndDate,
      setOpenEnded,
      openPicker,
      closePicker,
      assignTemplate,
      clearWeekday,
      addRotationDay,
      removeRotationDay,
      setRotationRest,
      addCustomDay,
      removeCustomDay,
      setCustomDayDate,
      saveDraft,
    ],
  );

  return { state, actions };
}
```

- [ ] **Step 3: Write `components/ProgramMetadataPanel.tsx`**

```tsx
import { Dropdown, SegmentControl, TextInputField, TextareaField } from "@/shared/components";
import { SCHEDULE_TYPE_LABELS, TRAINING_GOAL_LABELS } from "@/shared/utils/programDisplay";
import { ProgramScheduleType, TrainingGoal } from "@/types";
import type { ProgramBuilderState } from "../utils/builderState";

type ProgramMetadataPanelProps = {
  builderState: ProgramBuilderState;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  onGoalChange: (goal: TrainingGoal) => void;
  onScheduleTypeChange: (scheduleType: ProgramScheduleType) => void;
  onStartDateChange: (startDate: string) => void;
  onEndDateChange: (endDate: string) => void;
  onOpenEndedChange: (isOpenEnded: boolean) => void;
};

const GOAL_OPTIONS = Object.entries(TRAINING_GOAL_LABELS).map(([value, label]) => ({
  value: Number(value) as TrainingGoal,
  label,
}));

const SCHEDULE_OPTIONS = Object.entries(SCHEDULE_TYPE_LABELS).map(([value, label]) => ({
  value: Number(value) as ProgramScheduleType,
  label,
}));

export function ProgramMetadataPanel({
  builderState,
  onNameChange,
  onDescriptionChange,
  onGoalChange,
  onScheduleTypeChange,
  onStartDateChange,
  onEndDateChange,
  onOpenEndedChange,
}: ProgramMetadataPanelProps) {
  const isCustom = builderState.scheduleType === ProgramScheduleType.CustomCalendar;
  const showEndDate = !builderState.isOpenEnded || isCustom;

  return (
    <section className="liquid-panel grid gap-4 rounded-2xl p-4 md:rounded-lg">
      <TextInputField
        label="Program name"
        required
        value={builderState.name}
        onChange={(event) => onNameChange(event.target.value)}
        placeholder="e.g. Upper/Lower — August"
      />

      <TextareaField
        label="Description"
        value={builderState.description}
        onChange={(event) => onDescriptionChange(event.target.value)}
        placeholder="Optional notes about this program"
        rows={2}
      />

      <Dropdown
        label="Goal"
        value={builderState.goal}
        options={GOAL_OPTIONS}
        onChange={(value) => {
          if (value !== null) {
            onGoalChange(value);
          }
        }}
      />

      <SegmentControl
        label="Schedule type"
        value={builderState.scheduleType}
        options={SCHEDULE_OPTIONS}
        onChange={onScheduleTypeChange}
      />

      <SegmentControl
        label="Length"
        value={builderState.isOpenEnded && !isCustom}
        options={[
          { label: "Fixed dates", value: false },
          { label: "Keeps going", value: true, disabled: isCustom },
        ]}
        onChange={(value) => onOpenEndedChange(value)}
        helperText={
          isCustom ? "Custom calendar programs need an end date." : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInputField
          label="Start date"
          type="date"
          required
          value={builderState.startDate}
          onChange={(event) => onStartDateChange(event.target.value)}
        />
        {showEndDate ? (
          <TextInputField
            label="End date"
            type="date"
            required
            min={builderState.startDate}
            value={builderState.endDate}
            onChange={(event) => onEndDateChange(event.target.value)}
          />
        ) : null}
      </div>
    </section>
  );
}
```

> Verify at execution time: `TextareaField` accepts `rows` (it extends textarea attributes) and `Dropdown` single-select `onChange` signature is `(value, option) => void` — both checked against `shared/components/Inputs`.

- [ ] **Step 4: Write `components/FixedWeekdaysEditor.tsx`**

```tsx
import { LuPlus, LuX } from "react-icons/lu";
import { WEEKDAY_NAMES } from "@/shared/utils/programDisplay";
import type { DayOfWeek } from "@/types";
import type { WeekdaySlot } from "../utils/builderState";

type FixedWeekdaysEditorProps = {
  weekdaySlots: WeekdaySlot[];
  onPickTemplate: (dayOfWeek: DayOfWeek) => void;
  onClear: (dayOfWeek: DayOfWeek) => void;
};

export function FixedWeekdaysEditor({
  weekdaySlots,
  onPickTemplate,
  onClear,
}: FixedWeekdaysEditorProps) {
  return (
    <section className="liquid-panel grid gap-2 rounded-2xl p-4 md:rounded-lg">
      <h2 className="text-sm font-semibold text-foreground">Weekly schedule</h2>
      <p className="text-xs text-secondary">
        Pick a template for each training day. Days without a template are rest days.
      </p>

      <div className="mt-2 grid gap-2">
        {weekdaySlots.map((slot) => (
          <div
            key={slot.dayOfWeek}
            className="flex items-center justify-between gap-3 rounded-2xl bg-(--glass-bg-soft) px-4 py-3"
          >
            <span className="w-24 shrink-0 text-sm font-semibold text-foreground">
              {WEEKDAY_NAMES[slot.dayOfWeek]}
            </span>

            {slot.templateId !== null ? (
              <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onPickTemplate(slot.dayOfWeek)}
                  className="liquid-primary-chip inline-flex h-9 min-w-0 cursor-pointer items-center rounded-full px-3 text-xs font-semibold"
                >
                  <span className="truncate">{slot.templateName}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onClear(slot.dayOfWeek)}
                  aria-label={`Clear ${WEEKDAY_NAMES[slot.dayOfWeek]}`}
                  className="liquid-pill shrink-0 cursor-pointer rounded-full p-2"
                >
                  <LuX className="h-3.5 w-3.5" />
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onPickTemplate(slot.dayOfWeek)}
                className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-(--glass-divider) px-3 text-xs font-semibold text-secondary transition hover:border-primary-300/60 hover:text-foreground"
              >
                <LuPlus className="h-3.5 w-3.5" />
                <span>Rest — add workout</span>
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Write `ProgramBuilder.tsx` and `index.ts`**

`ProgramBuilder.tsx`:

```tsx
import {
  AsyncSection,
  OutlinedButton,
  PageBody,
  PageHeader,
  PrimaryButton,
  TemplatePickerModal,
} from "@/shared/components";
import { ProgramScheduleType } from "@/types";
import { FixedWeekdaysEditor } from "./components/FixedWeekdaysEditor";
import { ProgramMetadataPanel } from "./components/ProgramMetadataPanel";
import { useProgramBuilderPage } from "./hooks/useProgramBuilderPage";

export default function ProgramBuilder() {
  const { state, actions } = useProgramBuilderPage();
  const { builderState } = state;

  return (
    <>
      <PageHeader
        title={state.isEditing ? "Edit program" : "New program"}
        subtitle="Build a training plan from your workout templates"
      />

      <PageBody>
        <AsyncSection
          isLoading={state.isLoading}
          error={state.loadError}
          loadingLabel="Loading draft..."
        >
          <div className="mx-auto grid max-w-3xl gap-4">
            <ProgramMetadataPanel
              builderState={builderState}
              onNameChange={actions.setName}
              onDescriptionChange={actions.setDescription}
              onGoalChange={actions.setGoal}
              onScheduleTypeChange={actions.setScheduleType}
              onStartDateChange={actions.setStartDate}
              onEndDateChange={actions.setEndDate}
              onOpenEndedChange={actions.setOpenEnded}
            />

            {builderState.scheduleType === ProgramScheduleType.FixedWeekdays ? (
              <FixedWeekdaysEditor
                weekdaySlots={builderState.weekdaySlots}
                onPickTemplate={(dayOfWeek) => actions.openPicker({ kind: "weekday", dayOfWeek })}
                onClear={actions.clearWeekday}
              />
            ) : null}

            <footer className="flex items-center justify-end gap-3">
              <OutlinedButton onClick={actions.saveDraft} disabled={state.isSaving}>
                Save draft
              </OutlinedButton>
              <PrimaryButton onClick={actions.saveDraft} disabled={state.isSaving}>
                {state.isSaving ? "Saving..." : "Save & continue"}
              </PrimaryButton>
            </footer>
          </div>
        </AsyncSection>
      </PageBody>

      <TemplatePickerModal
        isOpen={state.isPickerOpen}
        onClose={actions.closePicker}
        onSelect={actions.assignTemplate}
      />
    </>
  );
}
```

(The Rotation/Custom editors render nothing yet — Task 6 adds them; Task 7 replaces the second footer button with the real Activate flow.)

`index.ts`:

```ts
export { default } from "./ProgramBuilder";
```

- [ ] **Step 6: Add the route** — in `client/src/routes.tsx`:

```tsx
import ProgramBuilder from "./pages/ProgramBuilder";
```

and inside the `program` block's `children`, after the index route:

```tsx
          {
            path: "new",
            element: <ProgramBuilder />,
          },
```

- [ ] **Step 7: Verify** — `npm run lint` && `npx tsc -b --noEmit`. Expected: clean. Optionally `npm run dev`: `/program/new` shows metadata + weekday editor; picking templates and saving creates a Draft visible on `/program`.

- [ ] **Step 8: Commit**

```bash
git add client/src
git commit -m "feat(program-ui): program builder with fixed-weekday schedule and draft save"
```

---

### Task 6: Rotation + custom-calendar editors, draft edit mode

**Files:**
- Create: `client/src/pages/ProgramBuilder/components/RotationEditor.tsx`, `client/src/pages/ProgramBuilder/components/CustomCalendarEditor.tsx`
- Modify: `client/src/pages/ProgramBuilder/utils/builderState.ts` (add `stateFromPlan`)
- Modify: `client/src/pages/ProgramBuilder/hooks/useProgramBuilderPage.ts` (edit-mode loading, create-vs-update save)
- Modify: `client/src/pages/ProgramBuilder/ProgramBuilder.tsx` (render the two editors)
- Modify: `client/src/routes.tsx` (add `:planId/edit` child)

**Interfaces:**
- Consumes: Task 5 names, `programPlanService.getById/getCalendar/update`.
- Produces: `stateFromPlan(plan: ProgramPlanModel, customDays: ProgramPlanDayModel[]): ProgramBuilderState`; route `/program/:planId/edit` (draft-only — non-drafts redirect to `/program/:planId`).

- [ ] **Step 1: Write `RotationEditor.tsx`**

```tsx
import { LuBedDouble, LuPlus, LuTrash2 } from "react-icons/lu";
import type { RotationSlot } from "../utils/builderState";

type RotationEditorProps = {
  rotationSlots: RotationSlot[];
  onPickTemplate: (localId: string) => void;
  onSetRest: (localId: string) => void;
  onAddDay: () => void;
  onRemoveDay: (localId: string) => void;
};

export function RotationEditor({
  rotationSlots,
  onPickTemplate,
  onSetRest,
  onAddDay,
  onRemoveDay,
}: RotationEditorProps) {
  return (
    <section className="liquid-panel grid gap-2 rounded-2xl p-4 md:rounded-lg">
      <h2 className="text-sm font-semibold text-foreground">Rotation cycle</h2>
      <p className="text-xs text-secondary">
        The cycle repeats from Day 1 after the last day, independent of weekdays.
      </p>

      <div className="mt-2 grid gap-2">
        {rotationSlots.map((slot, index) => (
          <div
            key={slot.localId}
            className="flex items-center justify-between gap-3 rounded-2xl bg-(--glass-bg-soft) px-4 py-3"
          >
            <span className="w-16 shrink-0 text-sm font-semibold text-foreground">
              Day {index + 1}
            </span>

            <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
              {slot.isRest ? (
                <button
                  type="button"
                  onClick={() => onPickTemplate(slot.localId)}
                  className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-(--glass-divider) px-3 text-xs font-semibold text-secondary transition hover:border-primary-300/60 hover:text-foreground"
                >
                  <LuBedDouble className="h-3.5 w-3.5" />
                  <span>Rest — add workout</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onPickTemplate(slot.localId)}
                    className="liquid-primary-chip inline-flex h-9 min-w-0 cursor-pointer items-center rounded-full px-3 text-xs font-semibold"
                  >
                    <span className="truncate">{slot.templateName ?? "Choose template"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetRest(slot.localId)}
                    className="liquid-pill shrink-0 cursor-pointer rounded-full px-3 py-2 text-xs font-semibold"
                  >
                    Rest
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => onRemoveDay(slot.localId)}
                aria-label={`Remove day ${index + 1}`}
                className="liquid-pill liquid-pill-danger shrink-0 cursor-pointer rounded-full p-2"
              >
                <LuTrash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onAddDay}
        className="mt-1 inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-full border border-dashed border-(--glass-divider) px-4 text-sm font-semibold text-secondary transition hover:border-primary-300/60 hover:text-foreground"
      >
        <LuPlus className="h-4 w-4" />
        <span>Add day</span>
      </button>
    </section>
  );
}
```

- [ ] **Step 2: Write `CustomCalendarEditor.tsx`**

```tsx
import { LuPlus, LuTrash2 } from "react-icons/lu";
import { TextInputField } from "@/shared/components";
import type { CustomDayEntry } from "../utils/builderState";

type CustomCalendarEditorProps = {
  customDays: CustomDayEntry[];
  minDate: string;
  maxDate: string;
  onPickTemplate: (localId: string) => void;
  onDateChange: (localId: string, date: string) => void;
  onAddDay: () => void;
  onRemoveDay: (localId: string) => void;
};

export function CustomCalendarEditor({
  customDays,
  minDate,
  maxDate,
  onPickTemplate,
  onDateChange,
  onAddDay,
  onRemoveDay,
}: CustomCalendarEditorProps) {
  const sortedDays = [...customDays].sort((left, right) => left.date.localeCompare(right.date));

  return (
    <section className="liquid-panel grid gap-2 rounded-2xl p-4 md:rounded-lg">
      <h2 className="text-sm font-semibold text-foreground">Workout days</h2>
      <p className="text-xs text-secondary">
        Add each training day individually. Dates must fall inside the program range.
      </p>

      <div className="mt-2 grid gap-2">
        {sortedDays.map((day) => (
          <div
            key={day.localId}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-(--glass-bg-soft) px-4 py-3"
          >
            <TextInputField
              label="Date"
              type="date"
              min={minDate}
              max={maxDate}
              value={day.date}
              onChange={(event) => onDateChange(day.localId, event.target.value)}
              containerClassName="w-44"
            />

            <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => onPickTemplate(day.localId)}
                className="liquid-primary-chip inline-flex h-9 min-w-0 cursor-pointer items-center rounded-full px-3 text-xs font-semibold"
              >
                <span className="truncate">{day.templateName ?? "Choose template"}</span>
              </button>
              <button
                type="button"
                onClick={() => onRemoveDay(day.localId)}
                aria-label="Remove day"
                className="liquid-pill liquid-pill-danger shrink-0 cursor-pointer rounded-full p-2"
              >
                <LuTrash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onAddDay}
        className="mt-1 inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-full border border-dashed border-(--glass-divider) px-4 text-sm font-semibold text-secondary transition hover:border-primary-300/60 hover:text-foreground"
      >
        <LuPlus className="h-4 w-4" />
        <span>Add workout day</span>
      </button>
    </section>
  );
}
```

- [ ] **Step 3: Add `stateFromPlan` to `utils/builderState.ts`**

```ts
import { createLocalId } from "@/lib/helpers"; // already imported at top
import type { ProgramPlanDayModel, ProgramPlanModel } from "@/types"; // extend the type imports

/**
 * Rebuilds editable state from a saved draft. `customDays` comes from the calendar endpoint
 * (ProgramPlanModel carries schedule rules only; custom-calendar drafts persist their days
 * as ProgramPlanDay rows — Plan 01 Task 4).
 */
export function stateFromPlan(
  plan: ProgramPlanModel,
  customDays: ProgramPlanDayModel[],
): ProgramBuilderState {
  const base = createInitialState();
  const sortedRules = [...plan.scheduleRules].sort((left, right) => left.orderIndex - right.orderIndex);

  return {
    ...base,
    name: plan.name,
    description: plan.description ?? "",
    goal: plan.goal,
    scheduleType: plan.scheduleType,
    startDate: plan.startDate,
    isOpenEnded: plan.endDate == null,
    endDate: plan.endDate ?? base.endDate,
    weekdaySlots:
      plan.scheduleType === ProgramScheduleType.FixedWeekdays
        ? base.weekdaySlots.map((slot) => {
            const rule = sortedRules.find((candidate) => candidate.dayOfWeek === slot.dayOfWeek);
            return rule
              ? {
                  ...slot,
                  templateId: rule.workoutTemplateId ?? null,
                  templateName: rule.workoutTemplateName ?? null,
                }
              : slot;
          })
        : base.weekdaySlots,
    rotationSlots:
      plan.scheduleType === ProgramScheduleType.Rotation
        ? [...sortedRules]
            .sort((left, right) => (left.rotationDayIndex ?? 0) - (right.rotationDayIndex ?? 0))
            .map((rule) => ({
              localId: createLocalId("rot"),
              isRest: rule.dayType === ProgramPlanDayType.Rest,
              templateId: rule.workoutTemplateId ?? null,
              templateName: rule.workoutTemplateName ?? null,
            }))
        : base.rotationSlots,
    customDays:
      plan.scheduleType === ProgramScheduleType.CustomCalendar
        ? customDays.map((day) => ({
            localId: createLocalId("day"),
            date: day.scheduledDate,
            templateId: day.workoutTemplateId ?? null,
            templateName: day.workoutTemplateName ?? null,
          }))
        : base.customDays,
  };
}
```

- [ ] **Step 4: Add edit mode to `useProgramBuilderPage`**

Add at the top of the hook:

```ts
import { useEffect } from "react"; // extend the react import
import { useParams } from "react-router"; // extend the react-router import
import { ProgramPlanStatus } from "@/types"; // extend the type imports
import { parseDateOnly } from "@/shared/utils/dateOnly";
import { stateFromPlan } from "../utils/builderState";
import type { ProgramPlanDayModel } from "@/types";

async function loadCustomDays(plan: ProgramPlanModel): Promise<ProgramPlanDayModel[]> {
  // Custom plans always have an EndDate, so the month range is bounded.
  const start = parseDateOnly(plan.startDate);
  const end = parseDateOnly(plan.endDate ?? plan.startDate);
  const requests = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    requests.push(programPlanService.getCalendar(plan.id, cursor.getFullYear(), cursor.getMonth() + 1));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const responses = await Promise.all(requests);
  return responses.flatMap((response) => unwrap(response.data, "Unable to load program days."));
}
```

Inside the hook body:

```ts
  const { planId } = useParams();
  const editingPlanId = planId ? Number(planId) : null;
  const [isLoading, setIsLoading] = useState(editingPlanId !== null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (editingPlanId === null) {
      return;
    }

    let cancelled = false;

    async function loadDraft() {
      try {
        const response = await programPlanService.getById(editingPlanId!);
        const plan = unwrap(response.data, "Unable to load program.");

        if (plan.status !== ProgramPlanStatus.Draft) {
          toast.error("Only draft programs can be edited.");
          navigate(`/program/${plan.id}`, { replace: true });
          return;
        }

        const customDays =
          plan.scheduleType === ProgramScheduleType.CustomCalendar
            ? await loadCustomDays(plan)
            : [];

        if (!cancelled) {
          setBuilderState(stateFromPlan(plan, customDays));
        }
      } catch (loadDraftError) {
        if (!cancelled) {
          setLoadError(
            loadDraftError instanceof Error ? loadDraftError.message : "Unable to load program.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadDraft();

    return () => {
      cancelled = true;
    };
  }, [editingPlanId, navigate]);
```

Change `saveDraftInternal` to create OR update:

```ts
      const payload = buildSaveRequest(builderState);
      const response =
        editingPlanId === null
          ? await programPlanService.create(payload)
          : await programPlanService.update(editingPlanId, payload);
      return unwrap(response.data, "Unable to save program.");
```

and update the returned state object: `isLoading`, `loadError`, `isEditing: editingPlanId !== null`.

- [ ] **Step 5: Render the editors in `ProgramBuilder.tsx`** — after the FixedWeekdays block add:

```tsx
            {builderState.scheduleType === ProgramScheduleType.Rotation ? (
              <RotationEditor
                rotationSlots={builderState.rotationSlots}
                onPickTemplate={(localId) => actions.openPicker({ kind: "rotation", localId })}
                onSetRest={actions.setRotationRest}
                onAddDay={actions.addRotationDay}
                onRemoveDay={actions.removeRotationDay}
              />
            ) : null}

            {builderState.scheduleType === ProgramScheduleType.CustomCalendar ? (
              <CustomCalendarEditor
                customDays={builderState.customDays}
                minDate={builderState.startDate}
                maxDate={builderState.endDate}
                onPickTemplate={(localId) => actions.openPicker({ kind: "custom", localId })}
                onDateChange={actions.setCustomDayDate}
                onAddDay={actions.addCustomDay}
                onRemoveDay={actions.removeCustomDay}
              />
            ) : null}
```

with the matching imports.

- [ ] **Step 6: Add the edit route** — in `client/src/routes.tsx`, inside the `program` children after `new`:

```tsx
          {
            path: ":planId/edit",
            element: <ProgramBuilder />,
          },
```

- [ ] **Step 7: Verify** — `npm run lint` && `npx tsc -b --noEmit`. Expected: clean. Optionally `npm run dev`: build a Rotation draft and a Custom draft, save both, reopen each via `/program/:id/edit` — state round-trips (weekday/rotation/custom assignments reappear).

- [ ] **Step 8: Commit**

```bash
git add client/src
git commit -m "feat(program-ui): rotation and custom-calendar editors with draft editing"
```

---

### Task 7: Activation flow with confirmation card

**Files:**
- Create: `client/src/shared/components/ActivateProgramModal.tsx`
- Modify: `client/src/shared/components/index.ts`
- Modify: `client/src/pages/ProgramBuilder/hooks/useProgramBuilderPage.ts`, `ProgramBuilder.tsx`

**Interfaces:**
- Consumes: `estimateTotalWorkouts`, `formatPlanDuration`, `WEEKDAY_NAMES`, `SCHEDULE_TYPE_LABELS`, `TRAINING_GOAL_LABELS` (Task 2), `programPlanService.activate`.
- Produces: `<ActivateProgramModal isOpen plan customDayCount isActivating onCancel onConfirm />` — Task 8 reuses it for activating drafts from the detail page.

- [ ] **Step 1: Write `ActivateProgramModal.tsx`** — the spec §33 confirmation-card layout: header with name + goal, meta row (schedule type, duration, workouts/week, total workouts), then the schedule table (weekday → template for FixedWeekdays, Day N → template for Rotation, day count for Custom).

```tsx
import { LuCalendarCheck } from "react-icons/lu";
import { formatDateOnly } from "@/shared/utils/dateOnly";
import {
  SCHEDULE_TYPE_LABELS,
  TRAINING_GOAL_LABELS,
  WEEKDAY_NAMES,
  estimateTotalWorkouts,
  formatPlanDuration,
} from "@/shared/utils/programDisplay";
import { ProgramPlanDayType, ProgramScheduleType } from "@/types";
import type { ProgramPlanModel } from "@/types";
import { OutlinedButton, PrimaryButton } from "./Buttons";
import { Modal } from "./Modal";

type ActivateProgramModalProps = {
  isOpen: boolean;
  plan: ProgramPlanModel | null;
  /** Only known when arriving from the builder (custom-calendar drafts). */
  customDayCount?: number;
  isActivating: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

type ScheduleRow = { label: string; value: string };

function buildScheduleRows(plan: ProgramPlanModel, customDayCount?: number): ScheduleRow[] {
  const sortedRules = [...plan.scheduleRules].sort(
    (left, right) => left.orderIndex - right.orderIndex,
  );

  if (plan.scheduleType === ProgramScheduleType.FixedWeekdays) {
    return sortedRules
      .filter((rule) => rule.dayType !== ProgramPlanDayType.Rest)
      .map((rule) => ({
        label: rule.dayOfWeek != null ? WEEKDAY_NAMES[rule.dayOfWeek] : "Day",
        value: rule.workoutTemplateName ?? "Workout",
      }));
  }

  if (plan.scheduleType === ProgramScheduleType.Rotation) {
    return [...sortedRules]
      .sort((left, right) => (left.rotationDayIndex ?? 0) - (right.rotationDayIndex ?? 0))
      .map((rule) => ({
        label: `Day ${rule.rotationDayIndex}`,
        value:
          rule.dayType === ProgramPlanDayType.Rest ? "Rest" : (rule.workoutTemplateName ?? "Workout"),
      }));
  }

  return [
    {
      label: "Workout days",
      value: customDayCount != null ? `${customDayCount} scheduled` : "Custom calendar",
    },
  ];
}

export function ActivateProgramModal({
  isOpen,
  plan,
  customDayCount,
  isActivating,
  onCancel,
  onConfirm,
}: ActivateProgramModalProps) {
  if (!plan) {
    return null;
  }

  const totalWorkouts = estimateTotalWorkouts(plan, customDayCount);
  const scheduleRows = buildScheduleRows(plan, customDayCount);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title="Activate program"
      titleIcon={<LuCalendarCheck className="h-5 w-5 text-primary" />}
      maxWidth="md"
    >
      <div className="grid gap-4 p-5">
        <div>
          <p className="text-base font-bold text-foreground">{plan.name}</p>
          <p className="mt-0.5 text-xs text-secondary">
            {TRAINING_GOAL_LABELS[plan.goal]} · {SCHEDULE_TYPE_LABELS[plan.scheduleType]}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-2xl bg-(--glass-bg-soft) px-3 py-2">
            <dt className="text-2xs font-semibold uppercase tracking-widest text-muted">Starts</dt>
            <dd className="font-semibold text-foreground">{formatDateOnly(plan.startDate)}</dd>
          </div>
          <div className="rounded-2xl bg-(--glass-bg-soft) px-3 py-2">
            <dt className="text-2xs font-semibold uppercase tracking-widest text-muted">Duration</dt>
            <dd className="font-semibold text-foreground">{formatPlanDuration(plan)}</dd>
          </div>
          <div className="rounded-2xl bg-(--glass-bg-soft) px-3 py-2">
            <dt className="text-2xs font-semibold uppercase tracking-widest text-muted">Per week</dt>
            <dd className="font-semibold text-foreground">
              {plan.targetWorkoutsPerWeek} workout{plan.targetWorkoutsPerWeek === 1 ? "" : "s"}
            </dd>
          </div>
          <div className="rounded-2xl bg-(--glass-bg-soft) px-3 py-2">
            <dt className="text-2xs font-semibold uppercase tracking-widest text-muted">Total</dt>
            <dd className="font-semibold text-foreground">
              {totalWorkouts != null ? `${totalWorkouts} workouts` : "Ongoing"}
            </dd>
          </div>
        </dl>

        <div className="overflow-hidden rounded-2xl border border-(--glass-divider)">
          {scheduleRows.map((row, index) => (
            <div
              key={`${row.label}-${index}`}
              className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm ${index > 0 ? "border-t border-(--glass-divider)" : ""}`}
            >
              <span className="shrink-0 font-semibold text-secondary">{row.label}</span>
              <span className="truncate font-semibold text-foreground">{row.value}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-secondary">
          Activating generates your day-by-day calendar. You can pause or cancel the program at any
          time.
        </p>

        <footer className="flex items-center justify-end gap-3">
          <OutlinedButton onClick={onCancel} disabled={isActivating}>
            Cancel
          </OutlinedButton>
          <PrimaryButton onClick={onConfirm} disabled={isActivating}>
            {isActivating ? "Activating..." : "Activate program"}
          </PrimaryButton>
        </footer>
      </div>
    </Modal>
  );
}
```

> Verify at execution time: `OutlinedButton` prop shape in `shared/components/Buttons/OutlinedButton.tsx` (same `ButtonHTMLAttributes` pattern as `PrimaryButton`).

Export in `shared/components/index.ts`:

```ts
export { ActivateProgramModal } from "./ActivateProgramModal";
```

- [ ] **Step 2: Wire activation into the builder hook** — add to `useProgramBuilderPage`:

```ts
  const [planPendingActivation, setPlanPendingActivation] = useState<ProgramPlanModel | null>(null);
  const [isActivating, setIsActivating] = useState(false);

  /** Save (create or update) the draft first, then open the confirmation card. */
  const requestActivate = useCallback(async () => {
    const saved = await saveDraftInternal();
    if (saved) {
      setPlanPendingActivation(saved);
    }
  }, [saveDraftInternal]);

  const cancelActivate = useCallback(() => {
    if (!isActivating && planPendingActivation) {
      // Draft is already saved — leave the user on its detail page.
      navigate(`/program/${planPendingActivation.id}`);
    }
  }, [isActivating, navigate, planPendingActivation]);

  const confirmActivate = useCallback(async () => {
    if (!planPendingActivation || isActivating) {
      return;
    }

    setIsActivating(true);

    try {
      const response = await programPlanService.activate(planPendingActivation.id);
      unwrap(response.data, "Unable to activate program.");
      toast.success("Program activated.");
      navigate("/program");
    } catch (activateError) {
      toast.error(
        activateError instanceof Error ? activateError.message : "Unable to activate program.",
      );
      setIsActivating(false);
    }
  }, [isActivating, navigate, planPendingActivation]);
```

Extend `state` with `planPendingActivation`, `isActivating`, and `customDayCount: builderState.customDays.length`; extend `actions` with `requestActivate`, `cancelActivate`, `confirmActivate`.

- [ ] **Step 3: Wire the modal into `ProgramBuilder.tsx`** — replace the footer's second button and append the modal:

```tsx
              <PrimaryButton onClick={actions.requestActivate} disabled={state.isSaving}>
                {state.isSaving ? "Saving..." : "Activate"}
              </PrimaryButton>
```

```tsx
      <ActivateProgramModal
        isOpen={state.planPendingActivation !== null}
        plan={state.planPendingActivation}
        customDayCount={state.customDayCount}
        isActivating={state.isActivating}
        onCancel={actions.cancelActivate}
        onConfirm={actions.confirmActivate}
      />
```

- [ ] **Step 4: Verify** — `npm run lint` && `npx tsc -b --noEmit`. Expected: clean. Optionally `npm run dev`: Activate from the builder shows the card (weekday→template table, duration, totals); confirming lands on `/program` with the plan Active; activating a second plan surfaces the server error toast ("You already have an active program plan.").

- [ ] **Step 5: Commit**

```bash
git add client/src
git commit -m "feat(program-ui): activation confirmation card and activate flow"
```

---

### Task 8: Program detail page with lifecycle actions

**Files:**
- Create: `client/src/pages/Program/ProgramDetail.tsx`
- Create: `client/src/pages/Program/hooks/useProgramDetailPage.ts`
- Create: `client/src/pages/Program/components/ScheduleSummary.tsx`
- Modify: `client/src/pages/Program/index.ts`, `client/src/routes.tsx`

**Interfaces:**
- Consumes: `programPlanService`, `ActivateProgramModal` (Task 7), `ProgramProgressCard` (Task 4), display maps.
- Produces: route `/program/:planId`; named export `ProgramDetail`.

- [ ] **Step 1: Write `hooks/useProgramDetailPage.ts`**

```ts
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { unwrap } from "@/lib/unwrap";
import { programPlanService } from "@/services/programPlanService";
import { todayDateOnlyString } from "@/shared/utils/dateOnly";
import { ProgramPlanStatus } from "@/types";
import type { ProgramPlanModel, ProgramProgressModel } from "@/types";

export function useProgramDetailPage() {
  const navigate = useNavigate();
  const { planId } = useParams();
  const numericPlanId = Number(planId);

  const [plan, setPlan] = useState<ProgramPlanModel | null>(null);
  const [progress, setProgress] = useState<ProgramProgressModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadIndex, setReloadIndex] = useState(0);
  const [isActivateOpen, setIsActivateOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<
    "activate" | "pause" | "complete" | "cancel" | "delete" | null
  >(null);
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPlan() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await programPlanService.getById(numericPlanId);
        const loaded = unwrap(response.data, "Unable to load program.");

        let loadedProgress: ProgramProgressModel | null = null;
        if (
          loaded.status === ProgramPlanStatus.Active ||
          loaded.status === ProgramPlanStatus.Paused ||
          loaded.status === ProgramPlanStatus.Completed
        ) {
          const progressResponse = await programPlanService.getProgress(
            loaded.id,
            todayDateOnlyString(),
          );
          loadedProgress = unwrap(progressResponse.data, "Unable to load progress.");
        }

        if (!cancelled) {
          setPlan(loaded);
          setProgress(loadedProgress);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load program.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadPlan();

    return () => {
      cancelled = true;
    };
  }, [numericPlanId, reloadIndex]);

  const reload = useCallback(() => setReloadIndex((index) => index + 1), []);

  const runLifecycleAction = useCallback(
    async (
      action: "pause" | "complete" | "cancel",
      request: () => Promise<{ data: { success: boolean; data?: boolean; error?: string } }>,
      successMessage: string,
    ) => {
      if (busyAction !== null) {
        return;
      }

      setBusyAction(action);

      try {
        const response = await request();
        unwrap(response.data, "The action failed.");
        toast.success(successMessage);
        reload();
      } catch (actionError) {
        toast.error(actionError instanceof Error ? actionError.message : "The action failed.");
      } finally {
        setBusyAction(null);
      }
    },
    [busyAction, reload],
  );

  const pause = useCallback(
    () => runLifecycleAction("pause", () => programPlanService.pause(numericPlanId), "Program paused."),
    [numericPlanId, runLifecycleAction],
  );

  const complete = useCallback(
    () =>
      runLifecycleAction(
        "complete",
        () => programPlanService.complete(numericPlanId),
        "Program completed. Nice work!",
      ),
    [numericPlanId, runLifecycleAction],
  );

  const cancel = useCallback(
    () =>
      runLifecycleAction(
        "cancel",
        () => programPlanService.cancel(numericPlanId),
        "Program cancelled.",
      ),
    [numericPlanId, runLifecycleAction],
  );

  const requestActivate = useCallback(() => setIsActivateOpen(true), []);
  const cancelActivate = useCallback(() => {
    if (busyAction === null) {
      setIsActivateOpen(false);
    }
  }, [busyAction]);

  const confirmActivate = useCallback(async () => {
    if (busyAction !== null) {
      return;
    }

    setBusyAction("activate");

    try {
      const response = await programPlanService.activate(numericPlanId);
      unwrap(response.data, "Unable to activate program.");
      toast.success("Program activated.");
      setIsActivateOpen(false);
      reload();
    } catch (activateError) {
      toast.error(
        activateError instanceof Error ? activateError.message : "Unable to activate program.",
      );
    } finally {
      setBusyAction(null);
    }
  }, [busyAction, numericPlanId, reload]);

  const requestDelete = useCallback(() => setIsDeleteConfirmationOpen(true), []);
  const cancelDelete = useCallback(() => {
    if (busyAction === null) {
      setIsDeleteConfirmationOpen(false);
    }
  }, [busyAction]);

  const confirmDelete = useCallback(async () => {
    if (busyAction !== null) {
      return;
    }

    setBusyAction("delete");

    try {
      const response = await programPlanService.remove(numericPlanId);
      unwrap(response.data, "Unable to delete program.");
      toast.success("Draft deleted.");
      navigate("/program");
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Unable to delete program.");
      setBusyAction(null);
    }
  }, [busyAction, navigate, numericPlanId]);

  const edit = useCallback(() => navigate(`/program/${numericPlanId}/edit`), [navigate, numericPlanId]);
  const openCalendar = useCallback(
    () => navigate(`/program/${numericPlanId}/calendar`),
    [navigate, numericPlanId],
  );

  const state = useMemo(
    () => ({
      plan,
      progress,
      isLoading,
      error,
      busyAction,
      isActivateOpen,
      isDeleteConfirmationOpen,
    }),
    [plan, progress, isLoading, error, busyAction, isActivateOpen, isDeleteConfirmationOpen],
  );

  const actions = useMemo(
    () => ({
      reload,
      pause,
      complete,
      cancel,
      requestActivate,
      cancelActivate,
      confirmActivate,
      requestDelete,
      cancelDelete,
      confirmDelete,
      edit,
      openCalendar,
    }),
    [
      reload,
      pause,
      complete,
      cancel,
      requestActivate,
      cancelActivate,
      confirmActivate,
      requestDelete,
      cancelDelete,
      confirmDelete,
      edit,
      openCalendar,
    ],
  );

  return { state, actions };
}
```

- [ ] **Step 2: Write `components/ScheduleSummary.tsx`** — read-only schedule table (same row-building logic as the activate card, shown inline on the page):

```tsx
import { WEEKDAY_NAMES } from "@/shared/utils/programDisplay";
import { ProgramPlanDayType, ProgramScheduleType } from "@/types";
import type { ProgramPlanModel } from "@/types";

type ScheduleSummaryProps = {
  plan: ProgramPlanModel;
};

export function ScheduleSummary({ plan }: ScheduleSummaryProps) {
  if (plan.scheduleType === ProgramScheduleType.CustomCalendar) {
    return (
      <p className="text-sm text-secondary">
        Custom calendar — open the program calendar to see every scheduled day.
      </p>
    );
  }

  const rows =
    plan.scheduleType === ProgramScheduleType.FixedWeekdays
      ? [...plan.scheduleRules]
          .sort((left, right) => left.orderIndex - right.orderIndex)
          .filter((rule) => rule.dayType !== ProgramPlanDayType.Rest)
          .map((rule) => ({
            key: `w-${rule.id}`,
            label: rule.dayOfWeek != null ? WEEKDAY_NAMES[rule.dayOfWeek] : "Day",
            value: rule.workoutTemplateName ?? "Workout",
          }))
      : [...plan.scheduleRules]
          .sort((left, right) => (left.rotationDayIndex ?? 0) - (right.rotationDayIndex ?? 0))
          .map((rule) => ({
            key: `r-${rule.id}`,
            label: `Day ${rule.rotationDayIndex}`,
            value:
              rule.dayType === ProgramPlanDayType.Rest
                ? "Rest"
                : (rule.workoutTemplateName ?? "Workout"),
          }));

  return (
    <div className="overflow-hidden rounded-2xl border border-(--glass-divider)">
      {rows.map((row, index) => (
        <div
          key={row.key}
          className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm ${index > 0 ? "border-t border-(--glass-divider)" : ""}`}
        >
          <span className="shrink-0 font-semibold text-secondary">{row.label}</span>
          <span className="truncate font-semibold text-foreground">{row.value}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Write `ProgramDetail.tsx`**

```tsx
import { LuCalendarDays, LuPencil } from "react-icons/lu";
import {
  ActivateProgramModal,
  AsyncSection,
  DeleteConfirmationModal,
  OutlinedButton,
  PageBody,
  PageHeader,
  PrimaryButton,
} from "@/shared/components";
import { formatDateOnly } from "@/shared/utils/dateOnly";
import {
  PLAN_STATUS_BADGE_CLASSES,
  PLAN_STATUS_LABELS,
  SCHEDULE_TYPE_LABELS,
  TRAINING_GOAL_LABELS,
  formatPlanDuration,
} from "@/shared/utils/programDisplay";
import { ProgramPlanStatus } from "@/types";
import { ProgramProgressCard } from "./components/ProgramProgressCard";
import { ScheduleSummary } from "./components/ScheduleSummary";
import { useProgramDetailPage } from "./hooks/useProgramDetailPage";

export function ProgramDetail() {
  const { state, actions } = useProgramDetailPage();
  const plan = state.plan;
  const status = plan?.status;

  return (
    <>
      <PageHeader
        title={plan?.name ?? "Program"}
        subtitle={
          plan
            ? `${TRAINING_GOAL_LABELS[plan.goal]} · ${SCHEDULE_TYPE_LABELS[plan.scheduleType]}`
            : undefined
        }
        actions={
          plan ? (
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${PLAN_STATUS_BADGE_CLASSES[plan.status]}`}
            >
              {PLAN_STATUS_LABELS[plan.status]}
            </span>
          ) : undefined
        }
      />

      <PageBody>
        <AsyncSection
          isLoading={state.isLoading}
          error={state.error}
          onRetry={actions.reload}
          loadingLabel="Loading program..."
        >
          {plan ? (
            <div className="mx-auto grid max-w-3xl gap-4">
              <section className="liquid-panel grid gap-3 rounded-2xl p-4 md:rounded-lg">
                <p className="text-sm text-secondary">
                  {formatDateOnly(plan.startDate)}
                  {plan.endDate ? ` → ${formatDateOnly(plan.endDate)}` : " → open-ended"} ·{" "}
                  {formatPlanDuration(plan)} · {plan.targetWorkoutsPerWeek}x / week
                </p>
                {plan.description ? (
                  <p className="text-sm text-secondary">{plan.description}</p>
                ) : null}
                <ScheduleSummary plan={plan} />
              </section>

              {state.progress ? <ProgramProgressCard progress={state.progress} /> : null}

              <footer className="flex flex-wrap items-center justify-end gap-3">
                <OutlinedButton onClick={actions.openCalendar}>
                  <LuCalendarDays className="h-4 w-4" />
                  Calendar
                </OutlinedButton>

                {status === ProgramPlanStatus.Draft ? (
                  <>
                    <OutlinedButton onClick={actions.edit}>
                      <LuPencil className="h-4 w-4" />
                      Edit
                    </OutlinedButton>
                    <OutlinedButton
                      onClick={actions.requestDelete}
                      disabled={state.busyAction !== null}
                    >
                      Delete
                    </OutlinedButton>
                    <PrimaryButton
                      onClick={actions.requestActivate}
                      disabled={state.busyAction !== null}
                    >
                      Activate
                    </PrimaryButton>
                  </>
                ) : null}

                {status === ProgramPlanStatus.Active ? (
                  <>
                    <OutlinedButton onClick={actions.pause} disabled={state.busyAction !== null}>
                      {state.busyAction === "pause" ? "Pausing..." : "Pause"}
                    </OutlinedButton>
                    <OutlinedButton onClick={actions.cancel} disabled={state.busyAction !== null}>
                      {state.busyAction === "cancel" ? "Cancelling..." : "Cancel program"}
                    </OutlinedButton>
                    <PrimaryButton onClick={actions.complete} disabled={state.busyAction !== null}>
                      {state.busyAction === "complete" ? "Completing..." : "Complete"}
                    </PrimaryButton>
                  </>
                ) : null}

                {status === ProgramPlanStatus.Paused ? (
                  <>
                    <OutlinedButton onClick={actions.cancel} disabled={state.busyAction !== null}>
                      {state.busyAction === "cancel" ? "Cancelling..." : "Cancel program"}
                    </OutlinedButton>
                    <OutlinedButton onClick={actions.complete} disabled={state.busyAction !== null}>
                      {state.busyAction === "complete" ? "Completing..." : "Complete"}
                    </OutlinedButton>
                    <PrimaryButton
                      onClick={actions.requestActivate}
                      disabled={state.busyAction !== null}
                    >
                      Resume
                    </PrimaryButton>
                  </>
                ) : null}
              </footer>
            </div>
          ) : null}
        </AsyncSection>
      </PageBody>

      <ActivateProgramModal
        isOpen={state.isActivateOpen}
        plan={plan}
        isActivating={state.busyAction === "activate"}
        onCancel={actions.cancelActivate}
        onConfirm={actions.confirmActivate}
      />

      <DeleteConfirmationModal
        isOpen={state.isDeleteConfirmationOpen}
        itemName={plan?.name ?? ""}
        title="Delete draft"
        isDeleting={state.busyAction === "delete"}
        onCancel={actions.cancelDelete}
        onConfirm={actions.confirmDelete}
      />
    </>
  );
}
```

- [ ] **Step 4: Export + route** — `pages/Program/index.ts` becomes:

```ts
export { default } from "./Program";
export { ProgramDetail } from "./ProgramDetail";
```

`routes.tsx`: change the import to `import Program, { ProgramDetail } from "./pages/Program";` and add to the `program` children (AFTER the `new` and `:planId/edit` entries — static segments win over params in react-router, but keep the readable order: `index`, `new`, `:planId`, `:planId/edit`, `:planId/calendar`):

```tsx
          {
            path: ":planId",
            element: <ProgramDetail />,
          },
```

- [ ] **Step 5: Verify** — `npm run lint` && `npx tsc -b --noEmit`. Expected: clean. Optionally `npm run dev`: draft shows Edit/Delete/Activate; active shows Pause/Cancel/Complete; paused shows Resume (opens the confirmation card; server does not regenerate days on resume — Plan 01 Task 5).

- [ ] **Step 6: Commit**

```bash
git add client/src
git commit -m "feat(program-ui): program detail page with lifecycle actions"
```

---

### Task 9: Monthly program calendar with day actions

**Files:**
- Create: `client/src/pages/ProgramCalendar/ProgramCalendar.tsx`, `client/src/pages/ProgramCalendar/index.ts`
- Create: `client/src/pages/ProgramCalendar/hooks/useProgramCalendarPage.ts`
- Create: `client/src/pages/ProgramCalendar/components/ProgramCalendarGrid.tsx`, `client/src/pages/ProgramCalendar/components/ProgramDayDetail.tsx`
- Create: `client/src/shared/components/MoveProgramDayModal.tsx`
- Create: `client/src/shared/hooks/useStartProgramDay.ts`
- Modify: `client/src/shared/components/index.ts`, `client/src/routes.tsx`

**Interfaces:**
- Consumes: `buildMonthMatrix`/`toDayKey`/`WEEKDAY_LABELS`/`MONTH_LABELS` (Task 2), `DAY_STATUS_CELL_CLASSES`/`DAY_STATUS_LABELS`/`DAY_TYPE_LABELS`, `programPlanService.getCalendar/moveDay/skipDay/restoreDay/startDay`.
- Produces: route `/program/:planId/calendar`; `useStartProgramDay(): { startingDayId, startProgramDay }` and `<MoveProgramDayModal />` — both reused by Task 10's Today card.

- [ ] **Step 1: Write `shared/hooks/useStartProgramDay.ts`** — mirrors `useStartWorkoutFromTemplate` (desktop navigates into the workout; mobile opens the workout sheet). The start endpoint is idempotent, so a double-tap is safe.

```ts
import { useCallback, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { unwrap } from "@/lib/unwrap";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";
import { programPlanService } from "@/services/programPlanService";
import { useActiveWorkoutStore } from "@/stores/activeWorkoutStore";

export function useStartProgramDay(onStarted?: () => void) {
  const navigate = useNavigate();
  const isMobile = useIsMobileViewport();
  const [startingDayId, setStartingDayId] = useState<number | null>(null);

  const startProgramDay = useCallback(
    async (programPlanDayId: number) => {
      if (startingDayId !== null) {
        return;
      }

      setStartingDayId(programPlanDayId);

      try {
        const response = await programPlanService.startDay(programPlanDayId);
        const workoutId = unwrap(response.data, "Unable to start workout.");
        onStarted?.();

        if (isMobile) {
          useActiveWorkoutStore.getState().openExistingWorkout(workoutId);
        } else {
          navigate(`/workouts/${workoutId}`);
        }
      } catch (startError) {
        toast.error(startError instanceof Error ? startError.message : "Unable to start workout.");
      } finally {
        setStartingDayId(null);
      }
    },
    [isMobile, navigate, onStarted, startingDayId],
  );

  return { startingDayId, startProgramDay };
}
```

- [ ] **Step 2: Write `shared/components/MoveProgramDayModal.tsx`**

```tsx
import { useEffect, useState } from "react";
import { LuCalendarClock } from "react-icons/lu";
import { formatDateOnly } from "@/shared/utils/dateOnly";
import type { ProgramPlanDayModel } from "@/types";
import { OutlinedButton, PrimaryButton } from "./Buttons";
import { TextInputField } from "./Inputs";
import { Modal } from "./Modal";

type MoveProgramDayModalProps = {
  isOpen: boolean;
  day: ProgramPlanDayModel | null;
  /** "yyyy-MM-dd" bounds for the date input (plan range / today). */
  minDate?: string;
  maxDate?: string;
  isMoving: boolean;
  onCancel: () => void;
  onConfirm: (newDate: string) => void;
};

export function MoveProgramDayModal({
  isOpen,
  day,
  minDate,
  maxDate,
  isMoving,
  onCancel,
  onConfirm,
}: MoveProgramDayModalProps) {
  const [newDate, setNewDate] = useState("");

  useEffect(() => {
    if (isOpen && day) {
      setNewDate(day.scheduledDate);
    }
  }, [isOpen, day]);

  if (!day) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title="Move workout"
      titleIcon={<LuCalendarClock className="h-5 w-5 text-primary" />}
      maxWidth="sm"
    >
      <div className="grid gap-4 p-5">
        <p className="text-sm text-secondary">
          <span className="font-semibold text-foreground">
            {day.workoutTemplateName ?? "Workout"}
          </span>{" "}
          is scheduled for {formatDateOnly(day.scheduledDate)}. Pick a new date.
        </p>

        <TextInputField
          label="New date"
          type="date"
          required
          min={minDate}
          max={maxDate}
          value={newDate}
          onChange={(event) => setNewDate(event.target.value)}
        />

        <footer className="flex items-center justify-end gap-3">
          <OutlinedButton onClick={onCancel} disabled={isMoving}>
            Cancel
          </OutlinedButton>
          <PrimaryButton
            onClick={() => onConfirm(newDate)}
            disabled={isMoving || !newDate || newDate === day.scheduledDate}
          >
            {isMoving ? "Moving..." : "Move workout"}
          </PrimaryButton>
        </footer>
      </div>
    </Modal>
  );
}
```

Export in `shared/components/index.ts`:

```ts
export { MoveProgramDayModal } from "./MoveProgramDayModal";
```

- [ ] **Step 3: Write `hooks/useProgramCalendarPage.ts`**

```ts
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { unwrap } from "@/lib/unwrap";
import { useStartProgramDay } from "@/shared/hooks/useStartProgramDay";
import { parseDateOnly, todayDateOnlyString } from "@/shared/utils/dateOnly";
import { buildMonthMatrix, toDayKey } from "@/shared/utils/monthGrid";
import { programPlanService } from "@/services/programPlanService";
import type { ProgramPlanDayModel, ProgramPlanModel } from "@/types";

export function useProgramCalendarPage() {
  const navigate = useNavigate();
  const { planId } = useParams();
  const numericPlanId = Number(planId);
  const now = useMemo(() => new Date(), []);

  const [plan, setPlan] = useState<ProgramPlanModel | null>(null);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [days, setDays] = useState<ProgramPlanDayModel[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadIndex, setReloadIndex] = useState(0);
  const [userSelectedKey, setUserSelectedKey] = useState<string | null>(null);
  const [dayPendingMove, setDayPendingMove] = useState<ProgramPlanDayModel | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [busyDayId, setBusyDayId] = useState<number | null>(null);

  const reload = useCallback(() => setReloadIndex((index) => index + 1), []);
  const { startingDayId, startProgramDay } = useStartProgramDay(reload);

  useEffect(() => {
    let cancelled = false;

    async function loadCalendar() {
      setIsLoading(true);
      setError(null);

      try {
        const [planResponse, daysResponse] = await Promise.all([
          programPlanService.getById(numericPlanId),
          programPlanService.getCalendar(numericPlanId, year, month),
        ]);

        if (!cancelled) {
          setPlan(unwrap(planResponse.data, "Unable to load program."));
          setDays(unwrap(daysResponse.data, "Unable to load calendar."));
        }
      } catch (loadError) {
        if (!cancelled) {
          setDays(null);
          setError(loadError instanceof Error ? loadError.message : "Unable to load calendar.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadCalendar();

    return () => {
      cancelled = true;
    };
  }, [numericPlanId, year, month, reloadIndex]);

  useEffect(() => {
    setUserSelectedKey(null);
  }, [year, month]);

  const cells = useMemo(() => buildMonthMatrix(year, month), [year, month]);

  const daysByKey = useMemo(() => {
    const grouped = new Map<string, ProgramPlanDayModel[]>();
    for (const day of days ?? []) {
      const key = toDayKey(parseDateOnly(day.scheduledDate));
      const existing = grouped.get(key);
      if (existing) {
        existing.push(day);
      } else {
        grouped.set(key, [day]);
      }
    }
    return grouped;
  }, [days]);

  const defaultSelectedKey = useMemo(() => {
    const today = cells.find((cell) => cell.isCurrentMonth && cell.isToday);
    if (today) {
      return today.dayKey;
    }

    const firstWithDay = cells.find(
      (cell) => cell.isCurrentMonth && (daysByKey.get(cell.dayKey)?.length ?? 0) > 0,
    );
    return firstWithDay?.dayKey ?? null;
  }, [cells, daysByKey]);

  const selectedKey = userSelectedKey ?? defaultSelectedKey;
  const selectedCell = useMemo(
    () => cells.find((cell) => cell.isCurrentMonth && cell.dayKey === selectedKey) ?? null,
    [cells, selectedKey],
  );
  const selectedDays = useMemo(
    () => (selectedKey ? (daysByKey.get(selectedKey) ?? []) : []),
    [daysByKey, selectedKey],
  );

  const prevMonth = useCallback(() => {
    setMonth((current) => {
      if (current === 1) {
        setYear((value) => value - 1);
        return 12;
      }
      return current - 1;
    });
  }, []);

  const nextMonth = useCallback(() => {
    setMonth((current) => {
      if (current === 12) {
        setYear((value) => value + 1);
        return 1;
      }
      return current + 1;
    });
  }, []);

  const goToday = useCallback(() => {
    const today = new Date();
    setUserSelectedKey(null);
    setYear(today.getFullYear());
    setMonth(today.getMonth() + 1);
  }, []);

  const selectDay = useCallback((dayKey: string) => setUserSelectedKey(dayKey), []);

  const runDayAction = useCallback(
    async (
      day: ProgramPlanDayModel,
      request: () => ReturnType<typeof programPlanService.skipDay>,
      successMessage: string,
    ) => {
      if (busyDayId !== null) {
        return;
      }

      setBusyDayId(day.id);

      try {
        const response = await request();
        unwrap(response.data, "The action failed.");
        toast.success(successMessage);
        reload();
      } catch (actionError) {
        toast.error(actionError instanceof Error ? actionError.message : "The action failed.");
      } finally {
        setBusyDayId(null);
      }
    },
    [busyDayId, reload],
  );

  const skip = useCallback(
    (day: ProgramPlanDayModel) =>
      runDayAction(day, () => programPlanService.skipDay(day.id), "Workout skipped."),
    [runDayAction],
  );

  const restore = useCallback(
    (day: ProgramPlanDayModel) =>
      runDayAction(day, () => programPlanService.restoreDay(day.id), "Workout restored."),
    [runDayAction],
  );

  const requestMove = useCallback((day: ProgramPlanDayModel) => setDayPendingMove(day), []);

  const cancelMove = useCallback(() => {
    if (!isMoving) {
      setDayPendingMove(null);
    }
  }, [isMoving]);

  const confirmMove = useCallback(
    async (newDate: string) => {
      if (!dayPendingMove || isMoving) {
        return;
      }

      setIsMoving(true);

      try {
        const response = await programPlanService.moveDay(dayPendingMove.id, { newDate });
        unwrap(response.data, "Unable to move workout.");
        toast.success("Workout moved.");
        setDayPendingMove(null);
        reload();
      } catch (moveError) {
        toast.error(moveError instanceof Error ? moveError.message : "Unable to move workout.");
      } finally {
        setIsMoving(false);
      }
    },
    [dayPendingMove, isMoving, reload],
  );

  const openWorkout = useCallback(
    (day: ProgramPlanDayModel) => {
      if (day.completedWorkoutId) {
        navigate(`/workouts/${day.completedWorkoutId}/summary`);
      } else if (day.startedWorkoutId) {
        navigate(`/workouts/${day.startedWorkoutId}`);
      }
    },
    [navigate],
  );

  const state = useMemo(
    () => ({
      plan,
      year,
      month,
      cells,
      daysByKey,
      selectedKey,
      selectedCell,
      selectedDays,
      isLoading,
      error,
      dayPendingMove,
      isMoving,
      busyDayId,
      startingDayId,
      todayString: todayDateOnlyString(),
    }),
    [
      plan,
      year,
      month,
      cells,
      daysByKey,
      selectedKey,
      selectedCell,
      selectedDays,
      isLoading,
      error,
      dayPendingMove,
      isMoving,
      busyDayId,
      startingDayId,
    ],
  );

  const actions = useMemo(
    () => ({
      prevMonth,
      nextMonth,
      goToday,
      selectDay,
      reload,
      start: startProgramDay,
      skip,
      restore,
      requestMove,
      cancelMove,
      confirmMove,
      openWorkout,
    }),
    [
      prevMonth,
      nextMonth,
      goToday,
      selectDay,
      reload,
      startProgramDay,
      skip,
      restore,
      requestMove,
      cancelMove,
      confirmMove,
      openWorkout,
    ],
  );

  return { state, actions };
}
```

- [ ] **Step 4: Write `components/ProgramCalendarGrid.tsx`** — same grid skeleton as the workout `CalendarGrid`, but every current-month cell is clickable (future included) and cell styling comes from `DAY_STATUS_CELL_CLASSES`; Recovery/Deload days show a corner letter.

```tsx
import { DAY_STATUS_LABELS, DAY_STATUS_CELL_CLASSES } from "@/shared/utils/programDisplay";
import { WEEKDAY_LABELS, type CalendarCell } from "@/shared/utils/monthGrid";
import { ProgramPlanDayType } from "@/types";
import type { ProgramPlanDayModel } from "@/types";

type ProgramCalendarGridProps = {
  cells: CalendarCell[];
  daysByKey: Map<string, ProgramPlanDayModel[]>;
  selectedKey: string | null;
  onSelectDay: (dayKey: string) => void;
};

const CELL_BASE_CLASS =
  "relative flex aspect-square min-h-11 items-center justify-center rounded-2xl text-sm transition";

const DAY_TYPE_BADGES: Partial<Record<ProgramPlanDayType, string>> = {
  [ProgramPlanDayType.Recovery]: "R",
  [ProgramPlanDayType.Deload]: "D",
  [ProgramPlanDayType.OptionalWorkout]: "?",
};

export function ProgramCalendarGrid({
  cells,
  daysByKey,
  selectedKey,
  onSelectDay,
}: ProgramCalendarGridProps) {
  return (
    <div className="liquid-panel rounded-3xl p-3 sm:p-4">
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="pb-1 text-center text-2xs font-semibold uppercase tracking-widest text-muted"
          >
            {label}
          </div>
        ))}

        {cells.map((cell) => {
          if (!cell.isCurrentMonth) {
            return (
              <div
                key={cell.dayKey}
                className={`${CELL_BASE_CLASS} text-(--text-disabled) opacity-50`}
                aria-hidden="true"
              >
                {cell.dayOfMonth}
              </div>
            );
          }

          const cellDays = daysByKey.get(cell.dayKey) ?? [];
          const primaryDay = cellDays[0] ?? null;
          const isSelected = cell.dayKey === selectedKey;

          const classes = [CELL_BASE_CLASS, "cursor-pointer"];
          if (primaryDay) {
            classes.push(DAY_STATUS_CELL_CLASSES[primaryDay.status]);
          } else {
            classes.push("text-secondary hover:bg-primary-100/10");
          }
          if (cell.isToday) {
            classes.push("ring-2 ring-inset ring-primary-400");
          }
          if (isSelected) {
            classes.push("outline-2 outline-offset-2 outline-primary");
          }

          const badge = primaryDay ? DAY_TYPE_BADGES[primaryDay.dayType] : undefined;

          return (
            <button
              key={cell.dayKey}
              type="button"
              onClick={() => onSelectDay(cell.dayKey)}
              aria-pressed={isSelected}
              aria-label={
                primaryDay
                  ? `Day ${cell.dayOfMonth}: ${primaryDay.workoutTemplateName ?? "Program day"}, ${DAY_STATUS_LABELS[primaryDay.status]}`
                  : `Day ${cell.dayOfMonth}, rest day`
              }
              className={classes.join(" ")}
            >
              <span className="leading-none">{cell.dayOfMonth}</span>
              {badge ? (
                <span className="absolute right-1 top-1 text-2xs font-bold opacity-80">{badge}</span>
              ) : null}
              {cellDays.length > 1 ? (
                <span className="absolute bottom-1.5 left-1/2 h-[5px] w-[5px] -translate-x-1/2 rounded-full bg-current" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Write `components/ProgramDayDetail.tsx`** — status-dependent actions (start / move / skip / restore / continue / view summary):

```tsx
import { LuArrowRight, LuLoaderCircle, LuPlay } from "react-icons/lu";
import { OutlinedButton, PrimaryButton } from "@/shared/components";
import { formatDateOnlyLong } from "@/shared/utils/dateOnly";
import {
  DAY_STATUS_LABELS,
  DAY_TYPE_LABELS,
} from "@/shared/utils/programDisplay";
import { ProgramPlanDayStatus } from "@/types";
import type { ProgramPlanDayModel } from "@/types";

type ProgramDayDetailProps = {
  days: ProgramPlanDayModel[];
  busyDayId: number | null;
  startingDayId: number | null;
  onStart: (day: ProgramPlanDayModel) => void;
  onMove: (day: ProgramPlanDayModel) => void;
  onSkip: (day: ProgramPlanDayModel) => void;
  onRestore: (day: ProgramPlanDayModel) => void;
  onOpenWorkout: (day: ProgramPlanDayModel) => void;
};

const ACTIONABLE = [
  ProgramPlanDayStatus.Scheduled,
  ProgramPlanDayStatus.Missed,
  ProgramPlanDayStatus.Rescheduled,
];

export function ProgramDayDetail({
  days,
  busyDayId,
  startingDayId,
  onStart,
  onMove,
  onSkip,
  onRestore,
  onOpenWorkout,
}: ProgramDayDetailProps) {
  if (days.length === 0) {
    return (
      <section className="liquid-panel rounded-2xl px-5 py-6 text-center">
        <p className="text-sm font-semibold text-foreground">Rest day</p>
        <p className="mt-1 text-xs text-secondary">Nothing scheduled — recover well.</p>
      </section>
    );
  }

  return (
    <div className="grid gap-3">
      {days.map((day) => {
        const isBusy = busyDayId === day.id || startingDayId === day.id;
        const canStartMoveSkip = ACTIONABLE.includes(day.status);

        return (
          <section key={day.id} className="liquid-panel grid gap-3 rounded-2xl p-4">
            <div>
              <p className="text-sm font-bold text-foreground">
                {day.workoutTemplateName ?? DAY_TYPE_LABELS[day.dayType]}
              </p>
              <p className="mt-0.5 text-xs text-secondary">
                {formatDateOnlyLong(day.scheduledDate)} · {DAY_STATUS_LABELS[day.status]}
                {day.exerciseCount > 0 ? ` · ${day.exerciseCount} exercises` : ""}
                {day.estimatedDurationMinutes ? ` · ~${day.estimatedDurationMinutes} min` : ""}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {day.status === ProgramPlanDayStatus.Started ? (
                <PrimaryButton size="sm" onClick={() => onOpenWorkout(day)}>
                  <LuArrowRight className="h-4 w-4" />
                  Continue workout
                </PrimaryButton>
              ) : null}

              {day.status === ProgramPlanDayStatus.Completed ? (
                <OutlinedButton onClick={() => onOpenWorkout(day)}>View workout</OutlinedButton>
              ) : null}

              {day.status === ProgramPlanDayStatus.Skipped ||
              day.status === ProgramPlanDayStatus.Missed ? (
                <OutlinedButton onClick={() => onRestore(day)} disabled={isBusy}>
                  Restore
                </OutlinedButton>
              ) : null}

              {canStartMoveSkip ? (
                <>
                  <OutlinedButton onClick={() => onSkip(day)} disabled={isBusy}>
                    Skip
                  </OutlinedButton>
                  <OutlinedButton onClick={() => onMove(day)} disabled={isBusy}>
                    Move
                  </OutlinedButton>
                  <PrimaryButton size="sm" onClick={() => onStart(day)} disabled={isBusy}>
                    {startingDayId === day.id ? (
                      <LuLoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <LuPlay className="h-4 w-4" />
                    )}
                    Start
                  </PrimaryButton>
                </>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 6: Write `ProgramCalendar.tsx` and `index.ts`**

`ProgramCalendar.tsx`:

```tsx
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";
import {
  AsyncSection,
  MoveProgramDayModal,
  PageBody,
  PageHeader,
} from "@/shared/components";
import { MONTH_LABELS } from "@/shared/utils/monthGrid";
import { ProgramCalendarGrid } from "./components/ProgramCalendarGrid";
import { ProgramDayDetail } from "./components/ProgramDayDetail";
import { useProgramCalendarPage } from "./hooks/useProgramCalendarPage";

export default function ProgramCalendar() {
  const { state, actions } = useProgramCalendarPage();

  return (
    <>
      <PageHeader
        title={state.plan?.name ?? "Program calendar"}
        subtitle={`${MONTH_LABELS[state.month - 1]} ${state.year}`}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={actions.prevMonth}
              aria-label="Previous month"
              className="liquid-pill cursor-pointer rounded-full p-2"
            >
              <LuChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={actions.goToday}
              className="liquid-pill cursor-pointer rounded-full px-3 py-2 text-xs font-semibold"
            >
              Today
            </button>
            <button
              type="button"
              onClick={actions.nextMonth}
              aria-label="Next month"
              className="liquid-pill cursor-pointer rounded-full p-2"
            >
              <LuChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
      />

      <PageBody>
        <AsyncSection
          isLoading={state.isLoading}
          error={state.error}
          onRetry={actions.reload}
          loadingLabel="Loading calendar..."
        >
          <div className="mx-auto grid max-w-4xl gap-4 lg:grid-cols-[1.4fr_1fr] lg:items-start">
            <ProgramCalendarGrid
              cells={state.cells}
              daysByKey={state.daysByKey}
              selectedKey={state.selectedKey}
              onSelectDay={actions.selectDay}
            />
            <ProgramDayDetail
              days={state.selectedDays}
              busyDayId={state.busyDayId}
              startingDayId={state.startingDayId}
              onStart={(day) => void actions.start(day.id)}
              onMove={actions.requestMove}
              onSkip={(day) => void actions.skip(day)}
              onRestore={(day) => void actions.restore(day)}
              onOpenWorkout={actions.openWorkout}
            />
          </div>
        </AsyncSection>
      </PageBody>

      <MoveProgramDayModal
        isOpen={state.dayPendingMove !== null}
        day={state.dayPendingMove}
        minDate={state.plan?.startDate}
        maxDate={state.plan?.endDate ?? undefined}
        isMoving={state.isMoving}
        onCancel={actions.cancelMove}
        onConfirm={(newDate) => void actions.confirmMove(newDate)}
      />
    </>
  );
}
```

`index.ts`:

```ts
export { default } from "./ProgramCalendar";
```

- [ ] **Step 7: Add the route** — in `client/src/routes.tsx`:

```tsx
import ProgramCalendar from "./pages/ProgramCalendar";
```

```tsx
          {
            path: ":planId/calendar",
            element: <ProgramCalendar />,
          },
```

- [ ] **Step 8: Verify** — `npm run lint` && `npx tsc -b --noEmit`. Expected: clean. Optionally `npm run dev`: month shows distinct cell states (Scheduled/Today-ring/Started/Completed/Missed/Skipped/Rescheduled + R/D badges); navigating an open-ended plan into next month tops up days (server-side); start/move/skip/restore all round-trip.

- [ ] **Step 9: Commit**

```bash
git add client/src
git commit -m "feat(program-ui): monthly program calendar with day actions"
```

---

### Task 10: Today card on the Workouts dashboard

`/workouts` is the authenticated landing page (`routes.tsx` redirects authenticated users there), so the Today card lives at the top of `Workouts.tsx`.

**Files:**
- Create: `client/src/pages/Workouts/hooks/useProgramToday.ts`
- Create: `client/src/pages/Workouts/components/ProgramTodayCard.tsx`
- Modify: `client/src/pages/Workouts/Workouts.tsx`

**Interfaces:**
- Consumes: `programPlanService.getToday/skipDay`, `useStartProgramDay`, `MoveProgramDayModal`, `useActiveWorkoutStore`, `todayDateOnlyString`, `formatDateOnly`.
- Produces: `<ProgramTodayCard />` (self-contained — no props).

- [ ] **Step 1: Write `hooks/useProgramToday.ts`**

```ts
import { useCallback, useEffect, useMemo, useState } from "react";
import { unwrap } from "@/lib/unwrap";
import { programPlanService } from "@/services/programPlanService";
import { todayDateOnlyString } from "@/shared/utils/dateOnly";
import type { ProgramTodayModel } from "@/types";

export function useProgramToday() {
  const [todayModel, setTodayModel] = useState<ProgramTodayModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadIndex, setReloadIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadToday() {
      setIsLoading(true);

      try {
        const response = await programPlanService.getToday(todayDateOnlyString());
        if (!cancelled) {
          setTodayModel(unwrap(response.data, "Unable to load today's program."));
        }
      } catch {
        // The dashboard card is non-critical: fail silent, render nothing.
        if (!cancelled) {
          setTodayModel(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadToday();

    return () => {
      cancelled = true;
    };
  }, [reloadIndex]);

  const reload = useCallback(() => setReloadIndex((index) => index + 1), []);

  return useMemo(
    () => ({ todayModel, isLoading, reload }),
    [todayModel, isLoading, reload],
  );
}
```

- [ ] **Step 2: Write `components/ProgramTodayCard.tsx`** — the spec priority ladder:
1. ongoing started workout → Continue,
2. missed program workout → "You missed X" + Train today / Move / Skip,
3. today's planned workout → name, exercise count, minutes, Start,
4. rest day → next workout date+name,
5. no active plan → Create-a-plan CTA. (Plus a "done" state when today's workout is already completed.)

```tsx
import { useCallback, useState } from "react";
import { LuArrowRight, LuCalendarPlus, LuLoaderCircle, LuMoon, LuPlay } from "react-icons/lu";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { unwrap } from "@/lib/unwrap";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";
import { programPlanService } from "@/services/programPlanService";
import { MoveProgramDayModal, OutlinedButton, PrimaryButton } from "@/shared/components";
import { useStartProgramDay } from "@/shared/hooks/useStartProgramDay";
import { formatDateOnly, todayDateOnlyString } from "@/shared/utils/dateOnly";
import { useActiveWorkoutStore } from "@/stores/activeWorkoutStore";
import { ProgramPlanDayStatus } from "@/types";
import type { ProgramPlanDayModel, ProgramTodayModel } from "@/types";
import { useProgramToday } from "../hooks/useProgramToday";

type TodayVariant =
  | { kind: "continue"; day: ProgramPlanDayModel }
  | { kind: "missed"; day: ProgramPlanDayModel }
  | { kind: "today"; day: ProgramPlanDayModel }
  | { kind: "done"; next: ProgramPlanDayModel | null }
  | { kind: "rest"; next: ProgramPlanDayModel | null }
  | { kind: "noPlan" };

/** Spec priority: started > missed > planned today > rest > no plan. */
function resolveVariant(model: ProgramTodayModel): TodayVariant {
  if (!model.hasActiveProgram) {
    return { kind: "noPlan" };
  }

  if (model.today?.status === ProgramPlanDayStatus.Started && model.today.startedWorkoutId) {
    return { kind: "continue", day: model.today };
  }

  if (model.missedWorkout) {
    return { kind: "missed", day: model.missedWorkout };
  }

  if (model.today && model.today.status === ProgramPlanDayStatus.Completed) {
    return { kind: "done", next: model.nextWorkout ?? null };
  }

  if (model.today) {
    return { kind: "today", day: model.today };
  }

  return { kind: "rest", next: model.nextWorkout ?? null };
}

export function ProgramTodayCard() {
  const navigate = useNavigate();
  const isMobile = useIsMobileViewport();
  const { todayModel, isLoading, reload } = useProgramToday();
  const { startingDayId, startProgramDay } = useStartProgramDay(reload);
  const [dayPendingMove, setDayPendingMove] = useState<ProgramPlanDayModel | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);

  const continueWorkout = useCallback(
    (day: ProgramPlanDayModel) => {
      if (!day.startedWorkoutId) {
        return;
      }

      if (isMobile) {
        useActiveWorkoutStore.getState().openExistingWorkout(day.startedWorkoutId);
      } else {
        navigate(`/workouts/${day.startedWorkoutId}`);
      }
    },
    [isMobile, navigate],
  );

  const skip = useCallback(
    async (day: ProgramPlanDayModel) => {
      if (isSkipping) {
        return;
      }

      setIsSkipping(true);

      try {
        const response = await programPlanService.skipDay(day.id);
        unwrap(response.data, "Unable to skip workout.");
        toast.success("Workout skipped.");
        reload();
      } catch (skipError) {
        toast.error(skipError instanceof Error ? skipError.message : "Unable to skip workout.");
      } finally {
        setIsSkipping(false);
      }
    },
    [isSkipping, reload],
  );

  const confirmMove = useCallback(
    async (newDate: string) => {
      if (!dayPendingMove || isMoving) {
        return;
      }

      setIsMoving(true);

      try {
        const response = await programPlanService.moveDay(dayPendingMove.id, { newDate });
        unwrap(response.data, "Unable to move workout.");
        toast.success("Workout moved.");
        setDayPendingMove(null);
        reload();
      } catch (moveError) {
        toast.error(moveError instanceof Error ? moveError.message : "Unable to move workout.");
      } finally {
        setIsMoving(false);
      }
    },
    [dayPendingMove, isMoving, reload],
  );

  if (isLoading || !todayModel) {
    return null;
  }

  const variant = resolveVariant(todayModel);

  return (
    <>
      <section className="liquid-panel rounded-2xl p-4 md:rounded-lg">
        <p className="text-2xs font-semibold uppercase tracking-widest text-muted">
          {todayModel.programName ?? "Training program"}
        </p>

        {variant.kind === "continue" ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-foreground">
                {variant.day.workoutTemplateName ?? "Workout"} in progress
              </p>
              <p className="text-xs text-secondary">Pick up where you left off.</p>
            </div>
            <PrimaryButton size="sm" onClick={() => continueWorkout(variant.day)}>
              <LuArrowRight className="h-4 w-4" />
              Continue
            </PrimaryButton>
          </div>
        ) : null}

        {variant.kind === "missed" ? (
          <div className="mt-2 grid gap-3">
            <div>
              <p className="text-base font-bold text-foreground">
                You missed {variant.day.workoutTemplateName ?? "a workout"}
              </p>
              <p className="text-xs text-secondary">
                Planned for {formatDateOnly(variant.day.scheduledDate)}. Catch up, move it, or let
                it go.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <OutlinedButton onClick={() => void skip(variant.day)} disabled={isSkipping}>
                Skip
              </OutlinedButton>
              <OutlinedButton onClick={() => setDayPendingMove(variant.day)}>Move</OutlinedButton>
              <PrimaryButton
                size="sm"
                onClick={() => void startProgramDay(variant.day.id)}
                disabled={startingDayId !== null}
              >
                {startingDayId === variant.day.id ? (
                  <LuLoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <LuPlay className="h-4 w-4" />
                )}
                Train today
              </PrimaryButton>
            </div>
          </div>
        ) : null}

        {variant.kind === "today" ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-foreground">
                {variant.day.workoutTemplateName ?? "Today's workout"}
              </p>
              <p className="text-xs text-secondary">
                {variant.day.exerciseCount > 0
                  ? `${variant.day.exerciseCount} exercises`
                  : "Today's session"}
                {variant.day.estimatedDurationMinutes
                  ? ` · ~${variant.day.estimatedDurationMinutes} min`
                  : ""}
              </p>
            </div>
            <PrimaryButton
              size="sm"
              onClick={() => void startProgramDay(variant.day.id)}
              disabled={startingDayId !== null}
            >
              {startingDayId === variant.day.id ? (
                <LuLoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <LuPlay className="h-4 w-4" />
              )}
              Start
            </PrimaryButton>
          </div>
        ) : null}

        {variant.kind === "done" || variant.kind === "rest" ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-base font-bold text-foreground">
                {variant.kind === "done" ? "Workout complete" : (
                  <>
                    <LuMoon className="h-4 w-4 text-primary" />
                    Rest day
                  </>
                )}
              </p>
              <p className="text-xs text-secondary">
                {variant.next
                  ? `Next: ${variant.next.workoutTemplateName ?? "Workout"} on ${formatDateOnly(variant.next.scheduledDate)}`
                  : "No upcoming workouts scheduled."}
              </p>
            </div>
          </div>
        ) : null}

        {variant.kind === "noPlan" ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-base font-bold text-foreground">Know what to train, every day</p>
              <p className="text-xs text-secondary">
                Build a program from your templates and get a daily plan.
              </p>
            </div>
            <PrimaryButton size="sm" onClick={() => navigate("/program/new")}>
              <LuCalendarPlus className="h-4 w-4" />
              Create a plan
            </PrimaryButton>
          </div>
        ) : null}
      </section>

      <MoveProgramDayModal
        isOpen={dayPendingMove !== null}
        day={dayPendingMove}
        minDate={todayDateOnlyString()}
        isMoving={isMoving}
        onCancel={() => {
          if (!isMoving) {
            setDayPendingMove(null);
          }
        }}
        onConfirm={(newDate) => void confirmMove(newDate)}
      />
    </>
  );
}
```

- [ ] **Step 3: Mount it in `Workouts.tsx`** — inside `<PageBody>`, before the `<AsyncSection>`:

```tsx
        <section className="mx-auto mb-4 max-w-4xl">
          <ProgramTodayCard />
        </section>
```

with `import { ProgramTodayCard } from "./components/ProgramTodayCard";`.

- [ ] **Step 4: Verify** — `npm run lint` && `npx tsc -b --noEmit`. Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add client/src
git commit -m "feat(program-ui): today card on the workouts dashboard"
```

---

### Task 11: Final verification + manual QA checklist

**Files:** none created — verification only.

- [ ] **Step 1: Full static checks**

From `client/`: `npm run lint` then `npx tsc -b --noEmit` — both clean.
From repo root: `dotnet build server/FitMate.sln` — still green (this plan must not have touched the server; if `backend.ts` was regenerated in Task 1, commit it).

- [ ] **Step 2: Manual QA checklist** (run `npm run dev` with the Plan 01 backend; tick every line)

Builder:
- [ ] `/program/new`: FixedWeekdays — assign Mon/Thu templates via the picker, save draft, reopen via Edit, assignments round-trip.
- [ ] Rotation — Day 1 Push, Day 2 Pull, Day 3 Rest, add/remove days, save.
- [ ] CustomCalendar — "Keeps going" segment is disabled, end date required, add dated entries, out-of-range date is rejected on save.
- [ ] Open-ended toggle hides the end date for FixedWeekdays/Rotation; saved plan shows "Open-ended".
- [ ] Activate from the builder shows the §33-style card (schedule table, duration, per-week, total); confirm activates and lands on `/program`.
- [ ] Activating a second plan while one is active surfaces the server error toast.

Overview + detail:
- [ ] `/program` shows the active plan, progress stats (completion bar hidden for open-ended plans), "Next up", and other plans with status badges.
- [ ] Detail actions per status: Draft → Edit/Delete/Activate; Active → Pause/Cancel/Complete; Paused → Resume/Cancel/Complete. Editing a non-draft redirects with a toast.

Calendar:
- [ ] `/program/:id/calendar` renders distinct cell states: Scheduled, Today (ring), Started, Completed, Missed, Skipped (strikethrough), Rescheduled, plus R/D badges for Recovery/Deload days.
- [ ] Start from a Scheduled day opens the created workout (desktop navigates; mobile opens the sheet); finishing it flips the cell to Completed.
- [ ] Move opens the date-picker modal, respects plan bounds, cell becomes Rescheduled; moving onto an occupied date shows the server error.
- [ ] Skip → Restore round-trips; restoring a past skip shows Missed.
- [ ] Open-ended plan: paging into next month keeps showing generated days (rolling horizon).

Today card (`/workouts`):
- [ ] Started program workout → "Continue" opens it.
- [ ] Missed workout → "You missed <name>" with Train today / Move / Skip, each reloading the card.
- [ ] Planned today → name, exercise count, ~minutes, Start creates the workout and navigates into it.
- [ ] Rest day → next workout name + date. Completed today → "Workout complete".
- [ ] No active plan → "Create a plan" CTA navigates to `/program/new`.
- [ ] Mobile viewport: Start/Continue open the workout sheet, bottom nav unchanged, card layout does not overflow.

Regression:
- [ ] Existing `/calendar` (workout calendar) still renders and navigates months (Task 2 extraction touched its utils).

- [ ] **Step 3: Commit any stragglers**

```bash
git add client
git commit -m "chore(program-ui): final lint/tsc pass for program frontend"
```

---

## Acceptance criteria (Plan 02 done)

- `programPlanService.ts` exists with zero handwritten API types — all imports from generated `@/types` (`ProgramPlanModel`, `ProgramPlanDayModel`, `ProgramTodayModel`, `ProgramProgressModel`, `SaveProgramPlanRequest`, `ProgramScheduleRuleRequest`, `CustomProgramDayRequest`, `MoveProgramDayRequest` + enums).
- Routes `/program`, `/program/new`, `/program/:id`, `/program/:id/edit` (drafts only), `/program/:id/calendar` all live inside the authenticated layout, each page folder following the `PageName.tsx + components/ + hooks/ + index.ts` convention.
- Builder supports all three schedule types built from workout templates, fixed-length AND open-ended (open-ended disabled for CustomCalendar per roadmap D1), saves drafts (POST), edits drafts (PUT), and activates through a confirmation card summarizing weekday→template table, duration, per-week and total workouts (spec §33 layout).
- Plan lifecycle actions match status: Draft → edit/delete/activate; Active → pause/cancel/complete; Paused → resume/cancel/complete.
- Monthly calendar renders visually distinct cell states (Scheduled, Today, Started, Completed, Missed, Skipped, Rescheduled, Recovery, Deload) and offers start/move/skip/restore per day status.
- Today card on `/workouts` implements the exact priority ladder: started → Continue; missed → Train today/Move/Skip; planned → Start (POST start → navigate into workout); rest → next workout; no plan → `/program/new` CTA; all dates sent as the client's local `yyyy-MM-dd` (never `toISOString()`).
- Progress display shows scheduled/completed/missed/skipped/remaining, adherence %, streak, and hides completion % when null (open-ended).
- `npm run lint` and `npx tsc -b --noEmit` pass; no test framework added; the Task 11 manual QA checklist is fully ticked.
