import { ExerciseGroupType, type WorkoutTemplate, type WorkoutTemplateExerciseGroup } from "@/types";

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function formatTemplateDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return DATE_FORMATTER.format(date);
}

export function getTemplateDurationLabel(template: WorkoutTemplate): string {
  return template.estimatedDurationMinutes
    ? `${template.estimatedDurationMinutes} min`
    : "No duration";
}

export function getTemplateVisibilityLabel(template: WorkoutTemplate): string {
  return template.isPublic ? "Public" : "Private";
}

export function getTemplateGroupTypeLabel(groupType: ExerciseGroupType): string {
  if (groupType === ExerciseGroupType.Superset) {
    return "Superset";
  }

  if (groupType === ExerciseGroupType.Circuit) {
    return "Circuit";
  }

  return "Single";
}

export function getTemplateGroupSummary(group: WorkoutTemplateExerciseGroup): string {
  return group.exercises
    .map((exercise) => exercise.exerciseName || `Exercise #${exercise.exerciseId}`)
    .join(" + ");
}

export function getTemplateExerciseSummary(template: WorkoutTemplate, maxItems = 3): string {
  const exerciseNames = template.groups
    .flatMap((group) => group.exercises)
    .map((exercise) => exercise.exerciseName || `Exercise #${exercise.exerciseId}`);

  if (exerciseNames.length === 0) {
    return "No exercises";
  }

  const visibleNames = exerciseNames.slice(0, maxItems);
  const hiddenCount = exerciseNames.length - visibleNames.length;

  if (hiddenCount <= 0) {
    return visibleNames.join(", ");
  }

  return `${visibleNames.join(", ")} + ${hiddenCount} more`;
}
