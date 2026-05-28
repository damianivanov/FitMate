import type { SortingStrategy } from "@dnd-kit/sortable";
import { ExerciseGroupType } from "@/types";
import type { ExerciseBuilderExerciseVM } from "./types";

type ExerciseGroupKeyLike = {
  groupId: number | null;
  groupType: ExerciseGroupType;
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

export function getExerciseDragOrderIndexes(
  exercises: readonly ExerciseGroupKeyLike[],
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

  const activeGroup = getExerciseGroup(exercises[activeIndex]);
  const overGroup = getExerciseGroup(exercises[overIndex]);
  if (activeGroup || overGroup) {
    if (!areExerciseGroupsEqual(activeGroup, overGroup)) {
      return currentIndexes;
    }
  }

  return moveArrayItem(currentIndexes, activeIndex, overIndex);
}

export function createExerciseSortingStrategy(
  exercises: readonly ExerciseBuilderExerciseVM[],
  shouldLockHorizontalMovement: boolean,
): SortingStrategy {
  return (args) => {
    const nextIndexes = getExerciseDragOrderIndexes(exercises, args.activeIndex, args.overIndex);
    const nextIndex = nextIndexes.indexOf(args.index);
    const oldRect = args.rects[args.index];
    const newRect = args.rects[nextIndex];
    if (!oldRect || !newRect || nextIndex === args.index) {
      return null;
    }

    return {
      x: shouldLockHorizontalMovement ? 0 : newRect.left - oldRect.left,
      y: newRect.top - oldRect.top,
      scaleX: newRect.width / oldRect.width,
      scaleY: newRect.height / oldRect.height,
    };
  };
}
