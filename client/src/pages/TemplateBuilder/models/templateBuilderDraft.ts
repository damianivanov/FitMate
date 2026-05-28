import type {
  ExerciseLookupModel,
  CreateWorkoutTemplateExerciseRequest,
  CreateWorkoutTemplateExerciseSetRequest,
} from "@/types";
import { ExerciseGroupType } from "@/types";

export interface TemplateBuilderSetDraftModel extends CreateWorkoutTemplateExerciseSetRequest {
  id: string;
}

export interface TemplateBuilderExerciseDraftModel extends CreateWorkoutTemplateExerciseRequest {
  id: string;
  exerciseId: number;
  groupId?: number | null;
  notes: string;
  collapsed: boolean;
  sets: TemplateBuilderSetDraftModel[];
}

export type TemplateBuilderFeedback = {
  text: string;
  tone: "success" | "error";
};

export type TemplateBuilderDraftContent = {
  name: string;
  description: string;
  estimatedDurationMinutes: number;
  isPublic: boolean;
  exercises: TemplateBuilderExerciseDraftModel[];
  exerciseIndex: ExerciseLookupModel[];
};

export type TemplateBuilderDraftModel = TemplateBuilderDraftContent & {
  draftVersion: number;
};

export function cloneTemplateBuilderExercises(
  exercises: readonly TemplateBuilderExerciseDraftModel[],
): TemplateBuilderExerciseDraftModel[] {
  return exercises.map((exercise) => ({
    ...exercise,
    sets: exercise.sets.map((set) => ({ ...set })),
  }));
}

function isTemplateBuilderGroupedExerciseType(
  groupType: ExerciseGroupType,
): boolean {
  return groupType === ExerciseGroupType.Superset || groupType === ExerciseGroupType.Circuit;
}

function getTemplateBuilderExerciseGroup(
  exercise: TemplateBuilderExerciseDraftModel,
): { groupId: number; groupType: ExerciseGroupType } | null {
  if (exercise.groupId == null || !isTemplateBuilderGroupedExerciseType(exercise.groupType)) {
    return null;
  }

  return {
    groupId: exercise.groupId,
    groupType: exercise.groupType,
  };
}

function areTemplateBuilderExerciseGroupsEqual(
  left: { groupId: number; groupType: ExerciseGroupType } | null,
  right: { groupId: number; groupType: ExerciseGroupType } | null,
): boolean {
  if (left === null || right === null) {
    return left === right;
  }

  return left.groupId === right.groupId && left.groupType === right.groupType;
}

function moveArrayItem<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] {
  const next = items.slice();
  const [item] = next.splice(fromIndex, 1);
  if (item === undefined) {
    return items.slice();
  }

  next.splice(toIndex, 0, item);
  return next;
}

export function getTemplateBuilderExerciseDragOrderIndexes(
  exercises: readonly TemplateBuilderExerciseDraftModel[],
  activeIndex: number,
  overIndex: number,
): number[] {
  const currentIndexes = exercises.map((_, index) => index);
  if (
    activeIndex < 0
    || overIndex < 0
    || activeIndex >= exercises.length
    || overIndex >= exercises.length
    || activeIndex === overIndex
  ) {
    return currentIndexes;
  }

  const activeGroup = getTemplateBuilderExerciseGroup(exercises[activeIndex]);
  const overGroup = getTemplateBuilderExerciseGroup(exercises[overIndex]);
  if (activeGroup || overGroup) {
    if (!areTemplateBuilderExerciseGroupsEqual(activeGroup, overGroup)) {
      return currentIndexes;
    }
  }

  return moveArrayItem(currentIndexes, activeIndex, overIndex);
}

export function reorderTemplateBuilderExercisesForDrag(
  exercises: readonly TemplateBuilderExerciseDraftModel[],
  activeExerciseId: string,
  overExerciseId: string,
): TemplateBuilderExerciseDraftModel[] {
  const activeIndex = exercises.findIndex((exercise) => exercise.id === activeExerciseId);
  const overIndex = exercises.findIndex((exercise) => exercise.id === overExerciseId);
  const activeExercise = exercises[activeIndex];
  const overExercise = exercises[overIndex];
  if (!activeExercise || !overExercise || activeIndex === overIndex) {
    return exercises.slice();
  }

  const nextIndexes = getTemplateBuilderExerciseDragOrderIndexes(exercises, activeIndex, overIndex);
  return nextIndexes.map((index) => exercises[index]);
}

export function getNextTemplateBuilderExerciseGroupId(
  exercises: readonly TemplateBuilderExerciseDraftModel[],
): number {
  let maxGroupId = 0;

  exercises.forEach((exercise) => {
    if (exercise.groupId != null) {
      maxGroupId = Math.max(maxGroupId, exercise.groupId);
    }
  });

  return maxGroupId + 1;
}

export function populateTemplateBuilderExerciseGroupIds(
  exercises: readonly TemplateBuilderExerciseDraftModel[],
): TemplateBuilderExerciseDraftModel[] {
  const next: TemplateBuilderExerciseDraftModel[] = [];
  let nextGroupId = getNextTemplateBuilderExerciseGroupId(exercises);
  let currentIndex = 0;

  while (currentIndex < exercises.length) {
    const currentExercise = exercises[currentIndex];
    if (currentExercise.groupId != null || !isTemplateBuilderGroupedExerciseType(currentExercise.groupType)) {
      next.push(currentExercise);
      currentIndex += 1;
      continue;
    }

    const groupType = currentExercise.groupType;
    const groupExercises: TemplateBuilderExerciseDraftModel[] = [];
    let groupedIndex = currentIndex;

    while (
      groupedIndex < exercises.length
      && exercises[groupedIndex].groupId == null
      && exercises[groupedIndex].groupType === groupType
    ) {
      groupExercises.push(exercises[groupedIndex]);
      groupedIndex += 1;
    }

    const assignedGroupId = nextGroupId++;
    groupExercises.forEach((exercise) => {
      next.push({
        ...exercise,
        groupId: assignedGroupId,
      });
    });

    currentIndex = groupedIndex;
  }

  return next;
}

export function normalizeTemplateBuilderExerciseGroups(
  exercises: readonly TemplateBuilderExerciseDraftModel[],
  dissolvableGroupIds?: ReadonlySet<number>,
): TemplateBuilderExerciseDraftModel[] {
  const groupMemberCounts = new Map<number, number>();
  const groupTypeById = new Map<number, ExerciseGroupType>();

  exercises.forEach((exercise) => {
    if (exercise.groupId == null) {
      return;
    }

    groupMemberCounts.set(exercise.groupId, (groupMemberCounts.get(exercise.groupId) ?? 0) + 1);
    if (!groupTypeById.has(exercise.groupId) && isTemplateBuilderGroupedExerciseType(exercise.groupType)) {
      groupTypeById.set(exercise.groupId, exercise.groupType);
    }
  });

  return exercises.map((exercise) => {
    if (exercise.groupId == null) {
      if (exercise.groupType === ExerciseGroupType.Straight) {
        return exercise;
      }

      return {
        ...exercise,
        groupId: undefined,
        groupType: ExerciseGroupType.Straight,
      };
    }

    const memberCount = groupMemberCounts.get(exercise.groupId) ?? 0;
    if (memberCount < 2 && dissolvableGroupIds?.has(exercise.groupId)) {
      return {
        ...exercise,
        groupId: undefined,
        groupType: ExerciseGroupType.Straight,
      };
    }

    const normalizedGroupType = groupTypeById.get(exercise.groupId) ?? ExerciseGroupType.Superset;
    if (exercise.groupType === normalizedGroupType) {
      return exercise;
    }

    return {
      ...exercise,
      groupType: normalizedGroupType,
    };
  });
}

export function upsertTemplateBuilderExerciseIndex(
  currentItems: readonly ExerciseLookupModel[],
  nextItems: readonly ExerciseLookupModel[],
): ExerciseLookupModel[] {
  const itemsById = new Map(currentItems.map((item) => [item.id, item] as const));

  for (const item of nextItems) {
    itemsById.set(item.id, item);
  }

  return Array.from(itemsById.values()).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

export function filterTemplateBuilderExerciseIndex(
  currentItems: readonly ExerciseLookupModel[],
  activeExerciseIds: readonly number[],
): ExerciseLookupModel[] {
  const activeIds = new Set(activeExerciseIds);
  const filteredItems = currentItems.filter((item) => activeIds.has(item.id));

  if (filteredItems.length === currentItems.length) {
    return currentItems.slice();
  }

  return filteredItems;
}

export function hasTemplateBuilderDraftContent(draft: TemplateBuilderDraftModel): boolean {
  return (
    draft.name.trim().length > 0
    || draft.description.trim().length > 0
    || draft.exercises.length > 0
  );
}
