import { normalizeUtcIsoString } from "@/lib/helpers";
import type { WorkoutCalendarDayModel } from "@/types";

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

export type CalendarCell = {
  date: Date;
  dayKey: string;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
};

function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

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

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isFutureDate(date: Date): boolean {
  return startOfDay(date).getTime() > startOfDay(new Date()).getTime();
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
