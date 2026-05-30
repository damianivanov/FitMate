import { normalizeUtcIsoString } from "@/lib/helpers";
import type { AnalyticsOverview, ExerciseProgression } from "@/types";
import type { LineChartPoint } from "../components/LineChart";

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

export function formatShortDate(value: string): string {
  const date = new Date(normalizeUtcIsoString(value));
  return Number.isNaN(date.getTime()) ? value : SHORT_DATE_FORMATTER.format(date);
}

export function formatVolume(value: number): string {
  return `${Math.round(value).toLocaleString()} kg`;
}

export function toVolumePoints(overview: AnalyticsOverview | null): LineChartPoint[] {
  return (overview?.volumeTrend ?? []).map((point) => ({
    label: formatShortDate(point.periodStart),
    value: point.totalVolumeKg,
  }));
}

export function toProgressionPoints(progression: ExerciseProgression | null): LineChartPoint[] {
  return (progression?.points ?? []).map((point) => ({
    label: formatShortDate(point.date),
    value: point.estimatedOneRepMax ?? point.bestWeightKg ?? 0,
  }));
}
