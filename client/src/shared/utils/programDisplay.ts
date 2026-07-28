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

/** Distinct visual state per day status for calendar cells and status chips. */
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
 * Client-side total-workout estimate for the activation card.
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
