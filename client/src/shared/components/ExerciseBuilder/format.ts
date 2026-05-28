import type { PreviousExerciseSet } from "@/types";

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
  const distance = formatMetricValue(previousSet.distanceMeters);

  if (weight && reps) {
    return `${weight} kg x ${reps}`;
  }

  if (reps) {
    return `${reps} reps`;
  }

  if (duration) {
    return `${duration}s`;
  }

  if (distance) {
    return `${distance} m`;
  }

  return null;
}
