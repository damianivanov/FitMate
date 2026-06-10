import { ExerciseGroupType } from "@/types";
import type { ExerciseBuilderExerciseVM } from "./types";

export const GROUP_BLOCK_PREFIX = "group:";

export function getGroupBlockId(groupId: number): string {
  return `${GROUP_BLOCK_PREFIX}${groupId}`;
}

type ExerciseGroupKeyLike = {
  groupId: number | null;
  groupType: ExerciseGroupType;
};

type ExerciseBlockKeyLike = ExerciseGroupKeyLike & {
  id: string;
};

type ExerciseRenderItem = {
  exercise: ExerciseBuilderExerciseVM;
  exerciseIndex: number;
};

export type ExerciseRenderBlock =
  | {
      kind: "single";
      exercise: ExerciseBuilderExerciseVM;
      exerciseIndex: number;
    }
  | {
      kind: "group";
      groupType: ExerciseGroupType;
      groupId: number;
      items: ExerciseRenderItem[];
    };

function isGroupedExerciseType(groupType: ExerciseGroupType): boolean {
  return groupType === ExerciseGroupType.Superset || groupType === ExerciseGroupType.Circuit;
}

export function buildExerciseRenderBlocks(
  exercises: readonly ExerciseBuilderExerciseVM[],
): ExerciseRenderBlock[] {
  const blocks: ExerciseRenderBlock[] = [];
  let currentIndex = 0;

  while (currentIndex < exercises.length) {
    const currentExercise = exercises[currentIndex];
    const groupId = currentExercise.groupId;
    if (groupId == null || currentExercise.groupType === ExerciseGroupType.Straight) {
      blocks.push({
        kind: "single",
        exercise: currentExercise,
        exerciseIndex: currentIndex,
      });
      currentIndex += 1;
      continue;
    }

    const groupType = currentExercise.groupType;
    const groupedItems: ExerciseRenderItem[] = [];
    while (
      currentIndex < exercises.length
      && exercises[currentIndex].groupId === groupId
      && exercises[currentIndex].groupType === groupType
    ) {
      groupedItems.push({
        exercise: exercises[currentIndex],
        exerciseIndex: currentIndex,
      });
      currentIndex += 1;
    }

    blocks.push({
      kind: "group",
      groupId,
      groupType,
      items: groupedItems,
    });
  }

  return blocks;
}

function getExerciseGroup(
  exercise: ExerciseGroupKeyLike,
): { groupId: number; groupType: ExerciseGroupType } | null {
  if (exercise.groupId == null || !isGroupedExerciseType(exercise.groupType)) {
    return null;
  }

  return {
    groupId: exercise.groupId,
    groupType: exercise.groupType,
  };
}

function areExerciseGroupsEqual(
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

type IndexBlock = {
  id: string;
  indexes: number[];
};

function buildIndexBlocks(items: readonly ExerciseBlockKeyLike[]): IndexBlock[] {
  const blocks: IndexBlock[] = [];
  let currentIndex = 0;

  while (currentIndex < items.length) {
    const group = getExerciseGroup(items[currentIndex]);
    if (!group) {
      blocks.push({ id: items[currentIndex].id, indexes: [currentIndex] });
      currentIndex += 1;
      continue;
    }

    const indexes: number[] = [];
    while (
      currentIndex < items.length
      && areExerciseGroupsEqual(getExerciseGroup(items[currentIndex]), group)
    ) {
      indexes.push(currentIndex);
      currentIndex += 1;
    }

    blocks.push({ id: getGroupBlockId(group.groupId), indexes });
  }

  return blocks;
}

function findBlockPosition(
  blocks: readonly IndexBlock[],
  id: string,
  exerciseIndex: number,
): number {
  if (id.startsWith(GROUP_BLOCK_PREFIX)) {
    return blocks.findIndex((block) => block.id === id);
  }

  if (exerciseIndex < 0) {
    return -1;
  }

  return blocks.findIndex((block) => block.indexes.includes(exerciseIndex));
}

export function getExerciseBlockDragOrderIndexes(
  items: readonly ExerciseBlockKeyLike[],
  activeId: string,
  overId: string,
): number[] {
  const currentIndexes = items.map((_, index) => index);
  if (activeId === overId) {
    return currentIndexes;
  }

  const activeExerciseIndex = items.findIndex((item) => item.id === activeId);
  const overExerciseIndex = items.findIndex((item) => item.id === overId);

  if (activeExerciseIndex >= 0 && overExerciseIndex >= 0) {
    const activeGroup = getExerciseGroup(items[activeExerciseIndex]);
    const overGroup = getExerciseGroup(items[overExerciseIndex]);
    if (activeGroup && overGroup && areExerciseGroupsEqual(activeGroup, overGroup)) {
      return moveArrayItem(currentIndexes, activeExerciseIndex, overExerciseIndex);
    }
  }

  const blocks = buildIndexBlocks(items);
  const activeBlockPosition = findBlockPosition(blocks, activeId, activeExerciseIndex);
  const overBlockPosition = findBlockPosition(blocks, overId, overExerciseIndex);
  if (
    activeBlockPosition < 0
    || overBlockPosition < 0
    || activeBlockPosition === overBlockPosition
  ) {
    return currentIndexes;
  }

  return moveArrayItem(blocks, activeBlockPosition, overBlockPosition).flatMap(
    (block) => block.indexes,
  );
}
