import { useMemo, useState } from "react";
import { normalizeUtcIsoString } from "@/lib/helpers";
import { toDateOnlyString, todayDateOnlyString } from "@/shared/utils/dateOnly";
import type { Workout } from "@/types";

const DAY_INITIAL_FORMATTER = new Intl.DateTimeFormat(undefined, { weekday: "narrow" });

export interface TrainingDay {
  /** "yyyy-MM-dd", the same shape the program endpoints speak. */
  date: string;
  initial: string;
  dayOfMonth: string;
  isToday: boolean;
  isFuture: boolean;
  sessionCount: number;
}

export interface WeekSnapshot {
  streakDays: number;
  sessionCount: number;
  volumeKg: number;
  /** Null when the previous week logged nothing — a percentage off zero says nothing. */
  volumeChangePercent: number | null;
}

/** The day a session belongs to is the day it finished, falling back to the day it started. */
function resolveWorkoutDate(workout: Workout): string | null {
  const value = workout.finishedAt ?? workout.startedAt;

  if (!value) {
    return null;
  }

  const date = new Date(normalizeUtcIsoString(value));
  return Number.isNaN(date.getTime()) ? null : toDateOnlyString(date);
}

function startOfWeek(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // Monday-first, independent of the locale's own week start: the strip reads M T W T F S S
  // and a Sunday-first grid would put the weekend either side of the working days.
  copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7));
  return copy;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() + days);
  return copy;
}

function sumVolume(workouts: Workout[]): number {
  return workouts.reduce((total, workout) => total + (workout.totalVolumeKg ?? 0), 0);
}

/**
 * Everything the training screen needs about the current week, derived from the workout list
 * the page already holds. No extra request: the list carries dates, sets and volume, and
 * counting them here keeps the strip and the snapshot in step with the list below them.
 */
export function useTrainingWeek(workouts: Workout[]) {
  const today = todayDateOnlyString();
  const [selectedDate, setSelectedDate] = useState(today);

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, Workout[]>();

    for (const workout of workouts) {
      const date = resolveWorkoutDate(workout);

      if (!date) {
        continue;
      }

      const existing = map.get(date);

      if (existing) {
        existing.push(workout);
      } else {
        map.set(date, [workout]);
      }
    }

    return map;
  }, [workouts]);

  const days = useMemo<TrainingDay[]>(() => {
    const weekStart = startOfWeek(new Date());

    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(weekStart, index);
      const dateOnly = toDateOnlyString(date);

      return {
        date: dateOnly,
        initial: DAY_INITIAL_FORMATTER.format(date),
        dayOfMonth: String(date.getDate()),
        isToday: dateOnly === today,
        isFuture: dateOnly > today,
        sessionCount: sessionsByDate.get(dateOnly)?.length ?? 0,
      };
    });
  }, [sessionsByDate, today]);

  const snapshot = useMemo<WeekSnapshot>(() => {
    const weekStart = startOfWeek(new Date());
    const previousWeekStart = addDays(weekStart, -7);

    const inRange = (from: Date, to: Date) => {
      const fromDate = toDateOnlyString(from);
      const toDate = toDateOnlyString(to);

      return workouts.filter((workout) => {
        if (!workout.finishedAt) {
          return false;
        }

        const date = resolveWorkoutDate(workout);
        return date != null && date >= fromDate && date < toDate;
      });
    };

    const thisWeek = inRange(weekStart, addDays(weekStart, 7));
    const previousWeek = inRange(previousWeekStart, weekStart);
    const previousVolume = sumVolume(previousWeek);
    const volumeKg = sumVolume(thisWeek);

    // A day counts as trained once it has a finished session. The walk starts at yesterday
    // when today is still empty, so an unfinished run does not read as a broken one.
    const trainedDates = new Set(
      workouts
        .filter((workout) => Boolean(workout.finishedAt))
        .map(resolveWorkoutDate)
        .filter((date): date is string => date != null),
    );

    let streakDays = 0;
    let cursor = trainedDates.has(today) ? new Date() : addDays(new Date(), -1);

    while (trainedDates.has(toDateOnlyString(cursor))) {
      streakDays += 1;
      cursor = addDays(cursor, -1);
    }

    return {
      streakDays,
      sessionCount: thisWeek.length,
      volumeKg,
      volumeChangePercent:
        previousVolume > 0 ? ((volumeKg - previousVolume) / previousVolume) * 100 : null,
    };
  }, [today, workouts]);

  const selectedSessions = useMemo(
    () => sessionsByDate.get(selectedDate) ?? [],
    [selectedDate, sessionsByDate],
  );

  return {
    today,
    days,
    snapshot,
    selectedDate,
    selectedSessions,
    isTodaySelected: selectedDate === today,
    selectDate: setSelectedDate,
    resetToToday: () => setSelectedDate(today),
  };
}
