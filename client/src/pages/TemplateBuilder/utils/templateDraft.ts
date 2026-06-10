import { createLocalId } from "@/lib/helpers";
import { getExerciseBlockDragOrderIndexes, type ExerciseMetricMode } from "@/shared/components";
import {
  ExerciseGroupType,
  ExerciseSetType,
  type CreateWorkoutTemplateRequest,
  type ExerciseLookupModel,
  type WorkoutTemplateModel,
} from "@/types";

export type TemplateSetMetricField =
  | "weightKg"
  | "reps"
  | "durationSeconds"
  | "restSeconds"
  | "rpe";

export type TemplateSetDraft = {
  id: string;
  setType: ExerciseSetType;
  weightKg?: number;
  reps?: number;
  durationSeconds?: number;
  rpe?: number;
  restSeconds?: number;
  notes?: string;
};

export type TemplateExerciseDraft = {
  id: string;
  exerciseId: number;
  exerciseName: string;
  exerciseImageUrl?: string;
  groupType: ExerciseGroupType;
  clientGroupId?: number;
  notes: string;
  sets: TemplateSetDraft[];
};

export type TemplateDraft = {
  name: string;
  description: string;
  estimatedDurationMinutes: number;
  isPublic: boolean;
  exercises: TemplateExerciseDraft[];
};

const DEFAULT_TEMPLATE_DURATION_MINUTES = 60;
const DEFAULT_SET_REPS = 8;
const DEFAULT_SET_REST_SECONDS = 90;
const DEFAULT_SET_DURATION_SECONDS = 30;

function isGroupedExerciseType(groupType: ExerciseGroupType): boolean {
  return groupType === ExerciseGroupType.Superset || groupType === ExerciseGroupType.Circuit;
}

export function buildEmptyTemplateDraft(): TemplateDraft {
  return {
    name: "",
    description: "",
    estimatedDurationMinutes: DEFAULT_TEMPLATE_DURATION_MINUTES,
    isPublic: false,
    exercises: [],
  };
}

export function createTemplateSetDraft(): TemplateSetDraft {
  return {
    id: createLocalId("template-set"),
    setType: ExerciseSetType.Working,
    reps: DEFAULT_SET_REPS,
    restSeconds: DEFAULT_SET_REST_SECONDS,
  };
}

export function createTemplateSetDraftFromPrevious(
  previous: TemplateSetDraft | undefined,
): TemplateSetDraft {
  if (!previous) {
    return createTemplateSetDraft();
  }

  return {
    ...previous,
    id: createLocalId("template-set"),
  };
}

export function createTemplateExerciseFromLookup(exercise: ExerciseLookupModel): TemplateExerciseDraft {
  return {
    id: createLocalId("template-exercise"),
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    exerciseImageUrl: exercise.imageUrl ?? undefined,
    groupType: ExerciseGroupType.Straight,
    notes: "",
    sets: [createTemplateSetDraft(), createTemplateSetDraft(), createTemplateSetDraft()],
  };
}

export function cloneTemplateDraft(draft: TemplateDraft): TemplateDraft {
  return {
    ...draft,
    exercises: draft.exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => ({ ...set })),
    })),
  };
}

export function buildTemplateDraftFromTemplate(template: WorkoutTemplateModel): TemplateDraft {
  return {
    name: template.name,
    description: template.description ?? "",
    estimatedDurationMinutes: template.estimatedDurationMinutes ?? DEFAULT_TEMPLATE_DURATION_MINUTES,
    isPublic: template.isPublic,
    exercises: template.groups
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .flatMap((group) => {
        const clientGroupId = isGroupedExerciseType(group.groupType) ? group.id : undefined;

        return group.exercises
          .slice()
          .sort((left, right) => left.orderIndex - right.orderIndex)
          .map((exercise) => ({
            id: `template-exercise-${exercise.id}`,
            exerciseId: exercise.exerciseId,
            exerciseName: exercise.exerciseName || `Exercise #${exercise.exerciseId}`,
            exerciseImageUrl: exercise.exerciseImageUrl ?? undefined,
            groupType: group.groupType,
            clientGroupId,
            notes: exercise.notes ?? "",
            sets: exercise.sets
              .slice()
              .sort((left, right) => left.orderIndex - right.orderIndex)
              .map((set) => ({
                id: `template-set-${set.id}`,
                setType: set.setType,
                weightKg: set.weightKg ?? undefined,
                reps: set.reps ?? undefined,
                durationSeconds: set.durationSeconds ?? undefined,
                rpe: set.rpe ?? undefined,
                restSeconds: set.restSeconds ?? undefined,
                notes: set.notes ?? undefined,
              })),
          }));
      }),
  };
}

export function buildTemplatePayload(draft: TemplateDraft): CreateWorkoutTemplateRequest {
  return {
    name: draft.name,
    description: draft.description,
    estimatedDurationMinutes: draft.estimatedDurationMinutes,
    isPublic: draft.isPublic,
    exercises: draft.exercises.map((exercise) => ({
      groupType: exercise.clientGroupId != null ? exercise.groupType : ExerciseGroupType.Straight,
      clientGroupId: exercise.clientGroupId,
      exerciseId: exercise.exerciseId,
      notes: exercise.notes,
      sets: exercise.sets.map((set) => ({
        setType: set.setType,
        weightKg: set.weightKg,
        reps: set.reps,
        durationSeconds: set.durationSeconds,
        rpe: set.rpe,
        restSeconds: set.restSeconds,
        notes: set.notes,
      })),
    })),
  };
}

export function areTemplateDraftsEquivalent(left: TemplateDraft, right: TemplateDraft): boolean {
  return JSON.stringify(buildTemplatePayload(left)) === JSON.stringify(buildTemplatePayload(right));
}

export function getTemplateExerciseMetricMode(exercise: TemplateExerciseDraft): ExerciseMetricMode {
  if (exercise.sets.some((set) => set.reps !== undefined)) {
    return "reps";
  }

  if (exercise.sets.some((set) => set.durationSeconds !== undefined)) {
    return "duration";
  }

  return "reps";
}

export function setTemplateExerciseMetricMode(
  exercise: TemplateExerciseDraft,
  metricMode: ExerciseMetricMode,
): TemplateExerciseDraft {
  return {
    ...exercise,
    sets: exercise.sets.map((set) => ({
      ...set,
      reps: metricMode === "reps" ? set.reps ?? DEFAULT_SET_REPS : undefined,
      durationSeconds: metricMode === "duration" ? set.durationSeconds ?? DEFAULT_SET_DURATION_SECONDS : undefined,
    })),
  };
}

export function getNextTemplateClientGroupId(exercises: readonly TemplateExerciseDraft[]): number {
  const groupIds = exercises
    .map((exercise) => exercise.clientGroupId)
    .filter((value): value is number => typeof value === "number");

  return groupIds.length ? Math.max(...groupIds) + 1 : 1;
}

export function reorderTemplateExercisesForDrag(
  exercises: readonly TemplateExerciseDraft[],
  activeExerciseId: string,
  overExerciseId: string,
): TemplateExerciseDraft[] {
  const items = exercises.map((exercise) => ({
    id: exercise.id,
    groupId: exercise.clientGroupId ?? null,
    groupType: exercise.groupType,
  }));
  const nextIndexes = getExerciseBlockDragOrderIndexes(items, activeExerciseId, overExerciseId);
  return nextIndexes.map((index) => exercises[index]);
}

export function hasTemplateDraftContent(draft: TemplateDraft): boolean {
  return (
    draft.name.trim().length > 0
    || draft.description.trim().length > 0
    || draft.exercises.length > 0
  );
}
