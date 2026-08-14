import { ExerciseSetType } from "@/types";
import type { WorkoutSetModel } from "@/types";
import { formatMetricValue } from "@/pages/WorkoutBuilder/utils/workoutDraft";

export const SET_TYPE_LABELS: Record<ExerciseSetType, string> = {
  [ExerciseSetType.Warmup]: "Warmup",
  [ExerciseSetType.Working]: "Working",
  [ExerciseSetType.Dropset]: "Dropset",
  [ExerciseSetType.Failure]: "Failure",
};

/** Whatever the set actually recorded — weight×reps, reps, or a duration. */
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
