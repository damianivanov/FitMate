import { normalizeUtcIsoString } from "@/lib/helpers";
import { ExerciseGroupType, ExerciseSetType, type WorkoutExerciseModel, type WorkoutSetModel } from "@/types";
import { formatMetricValue } from "../../WorkoutBuilder/utils/workoutDraft";

export const SET_TYPE_LABELS: Record<ExerciseSetType, string> = {
  [ExerciseSetType.Warmup]: "Warmup",
  [ExerciseSetType.Working]: "Working",
  [ExerciseSetType.Dropset]: "Dropset",
  [ExerciseSetType.Failure]: "Failure",
};

export const GROUP_TYPE_LABELS: Record<ExerciseGroupType, string> = {
  [ExerciseGroupType.Straight]: "Straight set",
  [ExerciseGroupType.Superset]: "Superset",
  [ExerciseGroupType.Circuit]: "Circuit",
};

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function formatDate(value: string | undefined): string {
  if (!value) {
    return "Unknown date";
  }

  const date = new Date(normalizeUtcIsoString(value));
  return Number.isNaN(date.getTime()) ? "Unknown date" : DATE_FORMATTER.format(date);
}

export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null) {
    return "-";
  }

  const bounded = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(bounded / 3600);
  const minutes = Math.floor((bounded % 3600) / 60);

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${minutes}m`;
}

export function getSetValueText(set: WorkoutSetModel): string {
  const weight = formatMetricValue(set.weightKg);
  const reps = formatMetricValue(set.reps);
  const duration = formatMetricValue(set.durationSeconds);

  if (weight && reps) {
    return `${weight} kg × ${reps}`;
  }

  if (reps) {
    return `${reps} reps`;
  }

  if (duration) {
    return `${duration}s`;
  }

  if (weight) {
    return `${weight} kg`;
  }

  return "-";
}

export function getExerciseName(exercise: WorkoutExerciseModel): string {
  return exercise.exerciseName || `Exercise #${exercise.exerciseId}`;
}
