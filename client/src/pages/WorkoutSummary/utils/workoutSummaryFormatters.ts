import { normalizeUtcIsoString } from "@/lib/helpers";
import { ExerciseGroupType, type WorkoutExerciseModel } from "@/types";

export { SET_TYPE_LABELS, getSetValueText } from "@/shared/utils/workoutSetDisplay";

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

export function getExerciseName(exercise: WorkoutExerciseModel): string {
  return exercise.exerciseName || `Exercise #${exercise.exerciseId}`;
}
