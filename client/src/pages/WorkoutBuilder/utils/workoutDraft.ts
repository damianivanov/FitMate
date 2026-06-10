import { createLocalId, normalizeUtcIsoString } from "@/lib/helpers";
import type { ExerciseMetricMode } from "@/shared/components";
import {
  ExerciseGroupType,
  ExerciseSetType,
  type CreateWorkoutExerciseRequest,
  type CreateWorkoutSetRequest,
  type ExerciseLookupModel,
  type PreviousExerciseSet,
  type SaveWorkoutRequest,
  type Workout,
  type WorkoutExerciseGroup,
  type WorkoutTemplate,
  type WorkoutTemplateExercise,
  type WorkoutTemplateExerciseGroup,
  type WorkoutTemplateExerciseSet,
} from "@/types";

export type WorkoutSetMetricField = "weightKg" | "reps" | "durationSeconds" | "rpe";

export const DEFAULT_NEW_WORKOUT_TITLE = "New workout";

const DEFAULT_WORKOUT_SET_REPS = 1;
const DEFAULT_WORKOUT_SET_DURATION_SECONDS = 30;

export type WorkoutSetDraft = CreateWorkoutSetRequest & {
  id: string;
  templateSetId?: number;
  orderIndex: number;
  restSeconds?: number;
  notes: string;
  isCompleted: boolean;
};

export type WorkoutExerciseDraft = Omit<CreateWorkoutExerciseRequest, "notes" | "sets"> & {
  id: string;
  templateExerciseId?: number;
  orderIndex: number;
  exerciseName: string;
  exerciseImageUrl?: string;
  notes: string;
  sets: WorkoutSetDraft[];
};

export type WorkoutDraft = Omit<SaveWorkoutRequest, "exercises" | "notes" | "startedAt" | "title"> & {
  workoutTemplateId?: number;
  templateName?: string;
  title: string;
  startedAt?: string;
  notes: string;
  exercises: WorkoutExerciseDraft[];
};

export type WorkoutExerciseGroupDraft = Pick<
  WorkoutTemplateExerciseGroup,
  "sortOrder" | "groupType" | "restBetweenExercisesSeconds" | "restAfterGroupSeconds" | "rounds"
> & {
  id: string;
  exercises: WorkoutExerciseDraft[];
};

export type WorkoutSummary = {
  exerciseCount: number;
  totalSetCount: number;
  completedSetCount: number;
  totalVolumeKg: number | null;
};

function normalizeMetricValue(value: number | null | undefined): number | undefined {
  return value == null ? undefined : value;
}

function normalizePositiveMetricValue(value: number | null | undefined): number | undefined {
  return value == null || value <= 0 ? undefined : value;
}

function normalizeOptionalText(value: string): string | undefined {
  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : undefined;
}

export function hasMainMetric(set: WorkoutSetDraft): boolean {
  return (
    set.weightKg !== undefined
    || normalizePositiveMetricValue(set.reps) !== undefined
    || normalizePositiveMetricValue(set.durationSeconds) !== undefined
  );
}

function buildSetDraft(
  set: WorkoutTemplateExerciseSet,
  setIndex: number,
): WorkoutSetDraft {
  return {
    id: `template-set-${set.id}`,
    templateSetId: set.id,
    orderIndex: setIndex + 1,
    setType: set.setType,
    weightKg: normalizeMetricValue(set.weightKg),
    reps: normalizePositiveMetricValue(set.reps),
    durationSeconds: normalizePositiveMetricValue(set.durationSeconds),
    rpe: normalizeMetricValue(set.rpe),
    restSeconds: normalizeMetricValue(set.restSeconds),
    notes: set.notes ?? "",
    isCompleted: false,
  };
}

function isGroupedExerciseType(groupType: ExerciseGroupType): boolean {
  return groupType === ExerciseGroupType.Superset || groupType === ExerciseGroupType.Circuit;
}

function buildExerciseDraft(
  exercise: WorkoutTemplateExercise,
  group: WorkoutTemplateExerciseGroup,
  orderIndex: number,
): WorkoutExerciseDraft {
  return {
    id: `template-exercise-${exercise.id}`,
    templateExerciseId: exercise.id,
    groupType: group.groupType,
    clientGroupId: isGroupedExerciseType(group.groupType) ? group.id : undefined,
    exerciseId: exercise.exerciseId,
    orderIndex,
    exerciseName: exercise.exerciseName || `Exercise #${exercise.exerciseId}`,
    exerciseImageUrl: exercise.exerciseImageUrl,
    notes: exercise.notes ?? "",
    sets: exercise.sets
      .slice()
      .sort((left, right) => left.orderIndex - right.orderIndex)
      .map(buildSetDraft),
  };
}

export function buildEmptyWorkoutDraft(startedAt?: Date): WorkoutDraft {
  return {
    title: DEFAULT_NEW_WORKOUT_TITLE,
    notes: "",
    startedAt: startedAt?.toISOString(),
    exercises: [],
  };
}

export function buildWorkoutDraftFromTemplate(
  template: WorkoutTemplate,
  startedAt?: Date,
): WorkoutDraft {
  let exerciseOrderIndex = 0;

  return {
    workoutTemplateId: template.id,
    templateName: template.name,
    title: template.name,
    notes: "",
    startedAt: startedAt?.toISOString(),
    exercises: template.groups
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .flatMap((group) =>
        group.exercises
          .slice()
          .sort((left, right) => left.orderIndex - right.orderIndex)
          .map((exercise) => buildExerciseDraft(exercise, group, ++exerciseOrderIndex)),
      ),
  };
}

export function buildWorkoutDraftFromWorkout(workout: Workout): WorkoutDraft {
  let exerciseOrderIndex = 0;

  return {
    workoutId: workout.id,
    workoutTemplateId: workout.workoutTemplateId,
    templateName: workout.templateName,
    title: workout.title,
    startedAt: workout.startedAt ? normalizeUtcIsoString(workout.startedAt) : undefined,
    notes: workout.notes ?? "",
    exercises: workout.groups
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .flatMap((group) =>
        group.exercises
          .slice()
          .sort((left, right) => left.orderIndex - right.orderIndex)
          .map((exercise) => ({
            id: `workout-exercise-${exercise.id}`,
            groupType: group.groupType,
            clientGroupId: getWorkoutGroupClientId(group),
            exerciseId: exercise.exerciseId,
            orderIndex: ++exerciseOrderIndex,
            exerciseName: exercise.exerciseName || `Exercise #${exercise.exerciseId}`,
            exerciseImageUrl: exercise.exerciseImageUrl,
            notes: exercise.notes ?? "",
            sets: exercise.sets
              .slice()
              .sort((left, right) => left.orderIndex - right.orderIndex)
              .map((set) => ({
                id: `workout-set-${set.id}`,
                orderIndex: set.orderIndex,
                setType: set.setType,
                weightKg: normalizeMetricValue(set.weightKg),
                reps: normalizePositiveMetricValue(set.reps),
                durationSeconds: normalizePositiveMetricValue(set.durationSeconds),
                rpe: normalizeMetricValue(set.rpe),
                notes: set.notes ?? "",
                isCompleted: set.isCompleted,
              })),
          })),
      ),
  };
}

export function buildWorkoutExerciseGroups(
  draft: WorkoutDraft,
): WorkoutExerciseGroupDraft[] {
  const groups: WorkoutExerciseGroupDraft[] = [];
  const groupedByClientGroupId = new Map<string, WorkoutExerciseGroupDraft>();

  draft.exercises
    .slice()
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .forEach((exercise) => {
      const isGrouped = isGroupedExerciseType(exercise.groupType) && exercise.clientGroupId !== undefined;
      if (!isGrouped) {
        groups.push({
          id: `straight-${exercise.id}`,
          sortOrder: groups.length + 1,
          groupType: ExerciseGroupType.Straight,
          rounds: 1,
          exercises: [exercise],
        });
        return;
      }

      const groupKey = `${exercise.groupType}-${exercise.clientGroupId}`;
      const existingGroup = groupedByClientGroupId.get(groupKey);
      if (existingGroup) {
        existingGroup.exercises.push(exercise);
        return;
      }

      const nextGroup: WorkoutExerciseGroupDraft = {
        id: `group-${groupKey}`,
        sortOrder: groups.length + 1,
        groupType: exercise.groupType,
        rounds: 1,
        exercises: [exercise],
      };
      groupedByClientGroupId.set(groupKey, nextGroup);
      groups.push(nextGroup);
    });

  return groups.map((group, index) => ({
    ...group,
    sortOrder: index + 1,
  }));
}

function getWorkoutGroupClientId(group: WorkoutExerciseGroup): number | undefined {
  return isGroupedExerciseType(group.groupType) ? group.id : undefined;
}

export function createWorkoutSetDraft(exercise: WorkoutExerciseDraft): WorkoutSetDraft {
  const latestSet = exercise.sets[exercise.sets.length - 1];
  const nextOrderIndex = exercise.sets.length + 1;

  if (!latestSet) {
    return {
      id: createLocalId("workout-set"),
      orderIndex: nextOrderIndex,
      setType: ExerciseSetType.Working,
      notes: "",
      isCompleted: false,
    };
  }

  return {
    ...latestSet,
    id: createLocalId("workout-set"),
    templateSetId: undefined,
    orderIndex: nextOrderIndex,
    notes: "",
    isCompleted: false,
  };
}

export function createWorkoutSetDraftFromPreviousSet(
  previousSet: PreviousExerciseSet,
  index: number,
): WorkoutSetDraft {
  return {
    id: createLocalId("workout-set"),
    orderIndex: index + 1,
    setType: previousSet.setType,
    weightKg: previousSet.weightKg,
    reps: normalizePositiveMetricValue(previousSet.reps),
    durationSeconds: normalizePositiveMetricValue(previousSet.durationSeconds),
    distanceMeters: previousSet.distanceMeters,
    rpe: previousSet.rpe,
    notes: "",
    isCompleted: false,
  };
}

const DEFAULT_NEW_EXERCISE_SET_COUNT = 3;
const DEFAULT_NEW_EXERCISE_SET_REPS = 8;

export function createWorkoutExerciseDraftFromLookup(
  exercise: ExerciseLookupModel,
  orderIndex: number,
): WorkoutExerciseDraft {
  return {
    id: createLocalId("workout-exercise"),
    groupType: ExerciseGroupType.Straight,
    orderIndex,
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    exerciseImageUrl: exercise.imageUrl ?? undefined,
    notes: "",
    sets: Array.from({ length: DEFAULT_NEW_EXERCISE_SET_COUNT }, (_value, index) => ({
      id: createLocalId("workout-set"),
      orderIndex: index + 1,
      setType: ExerciseSetType.Working,
      reps: DEFAULT_NEW_EXERCISE_SET_REPS,
      notes: "",
      isCompleted: false,
    })),
  };
}

export function normalizeWorkoutExerciseOrderIndexes(
  exercises: readonly WorkoutExerciseDraft[],
): WorkoutExerciseDraft[] {
  return exercises.map((exercise, index) => ({
    ...exercise,
    orderIndex: index + 1,
  }));
}

export function calculateWorkoutSummary(draft: WorkoutDraft): WorkoutSummary {
  const sets = draft.exercises.flatMap((exercise) => exercise.sets);
  const completedSets = sets.filter((set) => set.isCompleted);
  let totalVolumeKg = 0;
  let hasTotalVolume = false;

  completedSets.forEach((set) => {
    if (set.weightKg === undefined || set.reps === undefined) {
      return;
    }

    totalVolumeKg += set.weightKg * set.reps;
    hasTotalVolume = true;
  });

  return {
    exerciseCount: draft.exercises.length,
    totalSetCount: sets.length,
    completedSetCount: completedSets.length,
    totalVolumeKg: hasTotalVolume ? Math.round(totalVolumeKg * 100) / 100 : null,
  };
}

export function validateWorkoutDraft(draft: WorkoutDraft): string | null {
  if (!draft.title.trim()) {
    return "Workout title is required.";
  }

  if (!draft.exercises.length) {
    return "At least one exercise is required.";
  }

  for (const exercise of draft.exercises) {
    const completedSets = exercise.sets.filter((set) => set.isCompleted);
    if (!completedSets.length) {
      return `Exercise #${exercise.orderIndex} needs at least one completed set.`;
    }

    for (const set of completedSets) {
      const reps = normalizePositiveMetricValue(set.reps);
      const durationSeconds = normalizePositiveMetricValue(set.durationSeconds);

      if (set.weightKg !== undefined && set.weightKg < 0) {
        return `Exercise #${exercise.orderIndex} weight cannot be negative.`;
      }

      if (set.reps !== undefined && reps === undefined && durationSeconds === undefined) {
        return `Exercise #${exercise.orderIndex} reps must be greater than zero.`;
      }

      if (set.durationSeconds !== undefined && durationSeconds === undefined && reps === undefined) {
        return `Exercise #${exercise.orderIndex} duration must be greater than zero.`;
      }

      if (set.rpe !== undefined && (set.rpe < 0 || set.rpe > 10)) {
        return `Exercise #${exercise.orderIndex} RPE must be between 0 and 10.`;
      }

      if (!hasMainMetric(set)) {
        return `Exercise #${exercise.orderIndex} set ${set.orderIndex} needs a metric.`;
      }
    }
  }

  return null;
}

function buildCreateWorkoutSetRequest(set: WorkoutSetDraft): CreateWorkoutSetRequest {
  return {
    setType: set.setType,
    isCompleted: set.isCompleted,
    weightKg: set.weightKg,
    reps: normalizePositiveMetricValue(set.reps),
    durationSeconds: normalizePositiveMetricValue(set.durationSeconds),
    rpe: set.rpe,
    notes: normalizeOptionalText(set.notes),
  };
}

export function buildWorkoutPayload(
  draft: WorkoutDraft,
  finishedAt?: Date,
): SaveWorkoutRequest {
  return {
    workoutId: draft.workoutId,
    workoutTemplateId: draft.workoutTemplateId,
    title: draft.title.trim(),
    startedAt: draft.startedAt ? normalizeUtcIsoString(draft.startedAt) : undefined,
    finishedAt: finishedAt?.toISOString(),
    notes: normalizeOptionalText(draft.notes),
    exercises: draft.exercises.map((exercise) => ({
      groupType: exercise.groupType,
      clientGroupId: exercise.clientGroupId,
      orderIndex: exercise.orderIndex,
      exerciseId: exercise.exerciseId,
      notes: normalizeOptionalText(exercise.notes),
      sets: exercise.sets.map(buildCreateWorkoutSetRequest),
    })),
  };
}

export function formatElapsedTime(totalSeconds: number): string {
  const boundedSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(boundedSeconds / 3600);
  const minutes = Math.floor((boundedSeconds % 3600) / 60);
  const seconds = boundedSeconds % 60;
  const paddedMinutes = hours > 0 ? minutes.toString().padStart(2, "0") : String(minutes);
  const paddedSeconds = seconds.toString().padStart(2, "0");

  return hours > 0
    ? `${hours}:${paddedMinutes}:${paddedSeconds}`
    : `${paddedMinutes}:${paddedSeconds}`;
}

export function formatMetricValue(value: number | null | undefined): string {
  if (value == null) {
    return "";
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

export function getWorkoutExerciseMetricMode(exercise: WorkoutExerciseDraft): ExerciseMetricMode {
  if (exercise.sets.some((set) => normalizePositiveMetricValue(set.reps) !== undefined)) {
    return "reps";
  }

  if (exercise.sets.some((set) => normalizePositiveMetricValue(set.durationSeconds) !== undefined)) {
    return "duration";
  }

  return "reps";
}

export function setWorkoutExerciseMetricMode(
  exercise: WorkoutExerciseDraft,
  metricMode: ExerciseMetricMode,
): WorkoutExerciseDraft {
  return {
    ...exercise,
    sets: exercise.sets.map((set) => ({
      ...set,
      reps: metricMode === "reps" ? normalizePositiveMetricValue(set.reps) ?? DEFAULT_WORKOUT_SET_REPS : undefined,
      durationSeconds:
        metricMode === "duration"
          ? normalizePositiveMetricValue(set.durationSeconds) ?? DEFAULT_WORKOUT_SET_DURATION_SECONDS
          : undefined,
    })),
  };
}

export function isWorkoutExerciseCompleted(exercise: WorkoutExerciseDraft): boolean {
  return exercise.sets.length > 0 && exercise.sets.every((set) => set.isCompleted);
}

export function findNextIncompleteWorkoutExercise(
  exercises: readonly WorkoutExerciseDraft[],
  currentExercise: WorkoutExerciseDraft,
): WorkoutExerciseDraft | null {
  return (
    exercises
      .filter(
        (exercise) =>
          exercise.orderIndex > currentExercise.orderIndex
          && exercise.sets.some((set) => !set.isCompleted),
      )
      .sort((left, right) => left.orderIndex - right.orderIndex)[0] ?? null
  );
}
