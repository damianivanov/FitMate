import { normalizeUtcIsoString } from "@/lib/helpers";
import type {
  AnalyticsOverview,
  ExerciseProgression,
  ExerciseProgressionPoint,
  ExerciseSessionSet,
} from "@/types";
import type { LineChartPoint } from "@/shared/components";
import type { ProgressionChange, ProgressionMetric } from "../types";

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

const SESSION_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});

const SESSION_DATE_WITH_YEAR_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function toDate(value: string): Date {
  return new Date(normalizeUtcIsoString(value));
}

export function formatShortDate(value: string): string {
  const date = toDate(value);
  return Number.isNaN(date.getTime()) ? value : SHORT_DATE_FORMATTER.format(date);
}

export function formatSessionDate(value: string): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.getFullYear() === new Date().getFullYear()
    ? SESSION_DATE_FORMATTER.format(date)
    : SESSION_DATE_WITH_YEAR_FORMATTER.format(date);
}

export function formatVolume(value: number): string {
  return `${Math.round(value).toLocaleString()} kg`;
}

export function formatKg(value: number): string {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`;
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatSessionSet(set: ExerciseSessionSet): string {
  const weight = set.weightKg != null && set.weightKg > 0
    ? set.weightKg.toLocaleString(undefined, { maximumFractionDigits: 1 })
    : null;

  if (weight && set.reps != null) {
    return `${weight} × ${set.reps}`;
  }

  if (weight) {
    return `${weight} kg`;
  }

  if (set.reps != null) {
    return `${set.reps} reps`;
  }

  if (set.durationSeconds != null) {
    return formatDuration(set.durationSeconds);
  }

  return "—";
}

export function formatWeightTimesReps(weightKg?: number, reps?: number): string {
  if (weightKg != null && reps != null) {
    return `${formatKg(weightKg)} × ${reps}`;
  }

  if (weightKg != null) {
    return formatKg(weightKg);
  }

  return reps != null ? `${reps} reps` : "";
}

export function toVolumePoints(overview: AnalyticsOverview | null): LineChartPoint[] {
  return (overview?.volumeTrend ?? []).map((point) => ({
    label: formatShortDate(point.periodStart),
    value: point.totalVolumeKg,
  }));
}

function getMetricValue(point: ExerciseProgressionPoint, metric: ProgressionMetric): number | null {
  switch (metric) {
    case "oneRepMax":
      return point.estimatedOneRepMax ?? null;
    case "topWeight":
      return point.bestWeightKg ?? null;
    case "volume":
      return point.totalVolumeKg > 0 ? point.totalVolumeKg : null;
  }
}

export function toProgressionPoints(
  progression: ExerciseProgression | null,
  metric: ProgressionMetric,
): LineChartPoint[] {
  return (progression?.points ?? []).flatMap((point) => {
    const value = getMetricValue(point, metric);
    return value == null ? [] : [{ label: formatShortDate(point.date), value }];
  });
}

export function getProgressionChange(
  progression: ExerciseProgression | null,
  metric: ProgressionMetric,
): ProgressionChange | null {
  const measured = (progression?.points ?? []).flatMap((point) => {
    const value = getMetricValue(point, metric);
    return value == null ? [] : [{ date: point.date, value }];
  });

  if (measured.length < 2) {
    return null;
  }

  const first = measured[0];
  const last = measured[measured.length - 1];
  const delta = Math.round((last.value - first.value) * 10) / 10;

  return {
    delta,
    percent: first.value > 0 ? Math.round((delta / first.value) * 1000) / 10 : null,
    since: formatShortDate(first.date),
  };
}
