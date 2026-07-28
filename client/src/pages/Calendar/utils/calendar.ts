import { normalizeUtcIsoString } from "@/lib/helpers";
import { startOfDay, toDayKey } from "@/shared/utils/monthGrid";
import type { WorkoutCalendarDayModel } from "@/types";

export {
  WEEKDAY_LABELS,
  MONTH_LABELS,
  buildMonthMatrix,
  isFutureDate,
  toDayKey,
  type CalendarCell,
} from "@/shared/utils/monthGrid";

const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

const TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

const SELECTED_DAY_FORMATTER = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
});

export function getWorkoutDayKey(workout: WorkoutCalendarDayModel): string {
  return toDayKey(new Date(normalizeUtcIsoString(workout.date)));
}

export function groupWorkoutsByDay(
  workouts: readonly WorkoutCalendarDayModel[],
): Map<string, WorkoutCalendarDayModel[]> {
  const grouped = new Map<string, WorkoutCalendarDayModel[]>();
  for (const workout of workouts) {
    const key = getWorkoutDayKey(workout);
    const existing = grouped.get(key);
    if (existing) {
      existing.push(workout);
    } else {
      grouped.set(key, [workout]);
    }
  }

  return grouped;
}

export function formatMonthDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null) {
    return "-";
  }

  const boundedSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(boundedSeconds / 3600);
  const minutes = Math.floor((boundedSeconds % 3600) / 60);

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${minutes}m`;
}

export function formatDayLabel(iso: string): string {
  const date = new Date(normalizeUtcIsoString(iso));
  return Number.isNaN(date.getTime()) ? "Workout day" : DAY_LABEL_FORMATTER.format(date);
}

export function formatWorkoutTime(iso: string): string {
  const date = new Date(normalizeUtcIsoString(iso));
  return Number.isNaN(date.getTime()) ? "" : TIME_FORMATTER.format(date);
}

export function formatSelectedDayLabel(date: Date): string {
  return SELECTED_DAY_FORMATTER.format(date);
}

export function computeCurrentStreak(days: readonly WorkoutCalendarDayModel[]): number {
  if (days.length === 0) {
    return 0;
  }

  const activeDayKeys = new Set(days.map(getWorkoutDayKey));
  const cursor = startOfDay(new Date());

  if (!activeDayKeys.has(toDayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!activeDayKeys.has(toDayKey(cursor))) {
      return 0;
    }
  }

  let streak = 0;
  while (activeDayKeys.has(toDayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}
