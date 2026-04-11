import type {
  ExerciseLookupModel,
  CreateWorkoutTemplateExerciseRequest,
  CreateWorkoutTemplateExerciseSetRequest,
} from "@/types";

export type TemplateSetNumericField = Exclude<keyof CreateWorkoutTemplateExerciseSetRequest, "notes">;
export type TemplateSetNumericValue = CreateWorkoutTemplateExerciseSetRequest[TemplateSetNumericField];

export interface TemplateBuilderSetDraftModel extends CreateWorkoutTemplateExerciseSetRequest {
  id: string;
  notes: string;
}

export interface TemplateBuilderExerciseDraftModel extends CreateWorkoutTemplateExerciseRequest {
  id: string;
  exerciseId: number;
  notes: string;
  collapsed: boolean;
  sets: TemplateBuilderSetDraftModel[];
}

export type TemplateBuilderExerciseIndexItem = Pick<
  ExerciseLookupModel,
  | "id"
  | "name"
  | "imageUrl"
  | "primaryMuscleGroupId"
  | "primaryMuscleGroupName"
  | "secondaryMuscleGroupId"
  | "secondaryMuscleGroupName"
>;

export type TemplateBuilderDraftModel = {
  draftVersion: number;
  name: string;
  description: string;
  estimatedDurationMinutes: number;
  isPublic: boolean;
  exercises: TemplateBuilderExerciseDraftModel[];
  exerciseIndex: TemplateBuilderExerciseIndexItem[];
};

export function cloneTemplateBuilderExercises(
  exercises: readonly TemplateBuilderExerciseDraftModel[],
): TemplateBuilderExerciseDraftModel[] {
  return exercises.map((exercise) => ({
    ...exercise,
    sets: exercise.sets.map((set) => ({ ...set })),
  }));
}

export function createTemplateBuilderExerciseIndexItem(
  exercise: Pick<
    ExerciseLookupModel,
    | "id"
    | "name"
    | "imageUrl"
    | "primaryMuscleGroupId"
    | "primaryMuscleGroupName"
    | "secondaryMuscleGroupId"
    | "secondaryMuscleGroupName"
  >,
): TemplateBuilderExerciseIndexItem {
  return {
    id: exercise.id,
    name: exercise.name,
    imageUrl: exercise.imageUrl,
    primaryMuscleGroupId: exercise.primaryMuscleGroupId,
    primaryMuscleGroupName: exercise.primaryMuscleGroupName,
    secondaryMuscleGroupId: exercise.secondaryMuscleGroupId,
    secondaryMuscleGroupName: exercise.secondaryMuscleGroupName,
  };
}

export function upsertTemplateBuilderExerciseIndex(
  currentItems: readonly TemplateBuilderExerciseIndexItem[],
  nextItems: readonly TemplateBuilderExerciseIndexItem[],
): TemplateBuilderExerciseIndexItem[] {
  const itemsById = new Map(currentItems.map((item) => [item.id, item] as const));

  for (const item of nextItems) {
    itemsById.set(item.id, item);
  }

  return Array.from(itemsById.values()).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

export function filterTemplateBuilderExerciseIndex(
  currentItems: readonly TemplateBuilderExerciseIndexItem[],
  activeExerciseIds: readonly number[],
): TemplateBuilderExerciseIndexItem[] {
  const activeIds = new Set(activeExerciseIds);
  const filteredItems = currentItems.filter((item) => activeIds.has(item.id));

  if (filteredItems.length === currentItems.length) {
    return currentItems.slice();
  }

  return filteredItems;
}

export function hasTemplateBuilderDraftContent(draft: TemplateBuilderDraftModel): boolean {
  if (draft.name.trim().length > 0) {
    return true;
  }

  if (draft.description.trim().length > 0) {
    return true;
  }

  if (draft.exercises.length > 0) {
    return true;
  }

  return false;
}
