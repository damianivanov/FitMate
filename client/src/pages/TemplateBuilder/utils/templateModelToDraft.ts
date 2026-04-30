import {
  ExerciseGroupType,
  type ExerciseLookupModel,
  type WorkoutTemplateExerciseModel,
  type WorkoutTemplateModel,
} from "@/types";
import type { TemplateBuilderDraftModel } from "../models/templateBuilderDraft";

const DEFAULT_TEMPLATE_DURATION_MINUTES = 60;

function normalizeTemplateMetric(value: number | null | undefined): number | undefined {
  return value ?? undefined;
}

function getTemplateExerciseDraftId(exercise: WorkoutTemplateExerciseModel): string {
  return `template-exercise-${exercise.id}`;
}

function buildFallbackExerciseLookup(
  exercise: WorkoutTemplateExerciseModel,
  dateCreated: string,
): ExerciseLookupModel {
  return {
    id: exercise.exerciseId,
    isGlobal: false,
    name: exercise.exerciseName || `Exercise #${exercise.exerciseId}`,
    slug: `exercise-${exercise.exerciseId}`,
    imageUrl: exercise.exerciseImageUrl ?? undefined,
    primaryMuscleGroupId: 0,
    primaryMuscleGroupName: "",
    dateCreated,
  };
}

export function buildTemplateBuilderDraftFromTemplate(
  template: WorkoutTemplateModel,
  exerciseLookups: readonly ExerciseLookupModel[] = [],
): TemplateBuilderDraftModel {
  const lookupById = new Map(exerciseLookups.map((exercise) => [exercise.id, exercise] as const));
  const fallbackLookupsById = new Map<number, ExerciseLookupModel>();

  const exercises = template.groups
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .flatMap((group) => {
      const groupId = group.groupType === ExerciseGroupType.Straight ? undefined : group.id;

      return group.exercises
        .slice()
        .sort((left, right) => left.orderIndex - right.orderIndex)
        .map((exercise) => {
          if (!lookupById.has(exercise.exerciseId) && !fallbackLookupsById.has(exercise.exerciseId)) {
            fallbackLookupsById.set(
              exercise.exerciseId,
              buildFallbackExerciseLookup(exercise, template.dateCreated),
            );
          }

          return {
            id: getTemplateExerciseDraftId(exercise),
            groupType: group.groupType,
            clientGroupId: groupId,
            groupId,
            exerciseId: exercise.exerciseId,
            notes: exercise.notes ?? "",
            collapsed: false,
            sets: exercise.sets
              .slice()
              .sort((left, right) => left.orderIndex - right.orderIndex)
              .map((set) => ({
                id: `template-set-${set.id}`,
                weightKg: normalizeTemplateMetric(set.weightKg),
                reps: normalizeTemplateMetric(set.reps),
                durationSeconds: normalizeTemplateMetric(set.durationSeconds),
                distanceMeters: normalizeTemplateMetric(set.distanceMeters),
                rpe: normalizeTemplateMetric(set.rpe),
                restSeconds: normalizeTemplateMetric(set.restSeconds),
                notes: set.notes,
              })),
          };
        });
    });

  return {
    draftVersion: 0,
    name: template.name,
    description: template.description ?? "",
    estimatedDurationMinutes: template.estimatedDurationMinutes ?? DEFAULT_TEMPLATE_DURATION_MINUTES,
    isPublic: template.isPublic,
    exercises,
    exerciseIndex: [
      ...exerciseLookups,
      ...Array.from(fallbackLookupsById.values()),
    ],
  };
}
