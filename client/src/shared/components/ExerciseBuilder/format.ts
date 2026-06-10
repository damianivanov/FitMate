import type { PreviousExerciseSet } from "@/types";
import type { ExerciseBuilderCapabilities, ExerciseMetricMode } from "./types";

const GRID_COLUMN_CLASS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
};

export function getMetricColumnCount(capabilities: ExerciseBuilderCapabilities): number {
  return (
    2
    + (capabilities.showRestColumn ? 1 : 0)
    + (capabilities.showRpeColumn ? 1 : 0)
  );
}

export function getMetricGridColumnsClass(capabilities: ExerciseBuilderCapabilities): string {
  return GRID_COLUMN_CLASS[getMetricColumnCount(capabilities)] ?? "grid-cols-2";
}

export function getMetricModeLabel(metricMode: ExerciseMetricMode): string {
  if (metricMode === "duration") {
    return "Duration";
  }

  return "Reps";
}

export function getMetricModeUnit(metricMode: ExerciseMetricMode): string {
  if (metricMode === "duration") {
    return "sec";
  }

  return "reps";
}

export function getCompactSetValueText(value: number | null | undefined): string {
  if (value == null) {
    return "-";
  }

  return Number.isInteger(value) ? value.toString() : value.toFixed(2).replace(/\.?0+$/, "");
}

export function formatMetricValue(value: number | null | undefined): string {
  if (value == null) {
    return "";
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

export function formatPreviousSetLabel(previousSet: PreviousExerciseSet | undefined): string | null {
  if (!previousSet) {
    return null;
  }

  const weight = formatMetricValue(previousSet.weightKg);
  const reps = formatMetricValue(previousSet.reps);
  const duration = formatMetricValue(previousSet.durationSeconds);

  if (weight && reps) {
    return `${weight} kg x ${reps}`;
  }

  if (reps) {
    return `${reps} reps`;
  }

  if (duration) {
    return `${duration}s`;
  }

  return null;
}
