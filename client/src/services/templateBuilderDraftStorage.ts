import { ExerciseGroupType } from "@/types";
import {
  DRAFT_STORAGE_KEYS,
  clearDraftStorage,
  isArrayOf,
  isBoolean,
  isNumber,
  isObject,
  isOptionalNumber,
  isOptionalString,
  isString,
  isValue,
  loadDraftStorage,
  saveDraftStorage,
} from "@/lib/draftStorage";
import type {
  TemplateBuilderDraftModel,
  TemplateBuilderExerciseDraftModel,
  TemplateBuilderExerciseIndexItem,
  TemplateBuilderSetDraftModel,
} from "@/pages/TemplateBuilder/models/templateBuilderDraft";

const TEMPLATE_BUILDER_DRAFT_STORAGE_KEY = DRAFT_STORAGE_KEYS.templateBuilder;
const TEMPLATE_BUILDER_DRAFT_STORAGE_VERSION = 1;
const INITIAL_DRAFT_VERSION = 0;

type TemplateBuilderDraftBody = Omit<TemplateBuilderDraftModel, "draftVersion">;

function isTemplateSetNumericValue(value: unknown): value is number | undefined {
  return isOptionalNumber(value);
}

function isExerciseGroupType(value: unknown): value is ExerciseGroupType {
  return isValue(value, [
    ExerciseGroupType.Straight,
    ExerciseGroupType.Superset,
    ExerciseGroupType.Circuit,
  ] as const);
}

function isTemplateSetDraft(value: unknown): value is TemplateBuilderSetDraftModel {
  if (!isObject(value)) {
    return false;
  }

  return (
    isString(value.id)
    && isTemplateSetNumericValue(value.weightKg)
    && isTemplateSetNumericValue(value.reps)
    && isTemplateSetNumericValue(value.durationSeconds)
    && isTemplateSetNumericValue(value.distanceMeters)
    && isTemplateSetNumericValue(value.rpe)
    && isTemplateSetNumericValue(value.restSeconds)
    && isString(value.notes)
  );
}

function isTemplateExerciseDraft(value: unknown): value is TemplateBuilderExerciseDraftModel {
  if (!isObject(value)) {
    return false;
  }

  return (
    isString(value.id)
    && isNumber(value.exerciseId)
    && isExerciseGroupType(value.groupType)
    && isString(value.notes)
    && isBoolean(value.collapsed)
    && isArrayOf(value.sets, isTemplateSetDraft)
  );
}

function isTemplateExerciseIndexItem(value: unknown): value is TemplateBuilderExerciseIndexItem {
  if (!isObject(value)) {
    return false;
  }

  return (
    isNumber(value.id)
    && isString(value.name)
    && isOptionalString(value.imageUrl)
    && isNumber(value.primaryMuscleGroupId)
    && isString(value.primaryMuscleGroupName)
    && isOptionalNumber(value.secondaryMuscleGroupId)
    && isOptionalString(value.secondaryMuscleGroupName)
  );
}

function isDraftVersion(value: unknown): value is number {
  return isNumber(value) && value >= 0;
}

function isTemplateBuilderDraftBody(value: unknown): value is TemplateBuilderDraftBody {
  if (!isObject(value)) {
    return false;
  }

  return (
    isString(value.name)
    && isString(value.description)
    && isNumber(value.estimatedDurationMinutes)
    && isBoolean(value.isPublic)
    && isArrayOf(value.exercises, isTemplateExerciseDraft)
    && isArrayOf(value.exerciseIndex, isTemplateExerciseIndexItem)
  );
}

function isCurrentTemplateBuilderDraftModel(value: unknown): value is TemplateBuilderDraftModel {
  return (
    isObject(value)
    && isDraftVersion(value.draftVersion)
    && isTemplateBuilderDraftBody(value)
  );
}

function isLegacyVisibility(value: unknown): value is "private" | "public" {
  return value === "private" || value === "public";
}

function normalizeTemplateBuilderDraft(rawValue: unknown): TemplateBuilderDraftModel | null {
  if (isCurrentTemplateBuilderDraftModel(rawValue)) {
    return rawValue;
  }

  if (isTemplateBuilderDraftBody(rawValue)) {
    return {
      draftVersion: INITIAL_DRAFT_VERSION,
      ...rawValue,
    };
  }

  if (!isObject(rawValue)) {
    return null;
  }

  if (
    !isString(rawValue.templateName)
    || !isString(rawValue.templateDescription)
    || !isNumber(rawValue.durationMinutes)
    || !isLegacyVisibility(rawValue.visibility)
    || !isArrayOf(rawValue.exercises, isTemplateExerciseDraft)
    || !isArrayOf(rawValue.exerciseIndex, isTemplateExerciseIndexItem)
  ) {
    return null;
  }

  return {
    draftVersion: INITIAL_DRAFT_VERSION,
    name: rawValue.templateName,
    description: rawValue.templateDescription,
    estimatedDurationMinutes: rawValue.durationMinutes,
    isPublic: rawValue.visibility === "public",
    exercises: rawValue.exercises,
    exerciseIndex: rawValue.exerciseIndex,
  };
}

export function loadTemplateBuilderDraft(): TemplateBuilderDraftModel | null {
  const rawDraft = loadDraftStorage<unknown>({
    key: TEMPLATE_BUILDER_DRAFT_STORAGE_KEY,
    version: TEMPLATE_BUILDER_DRAFT_STORAGE_VERSION,
  });

  if (!rawDraft) {
    return null;
  }

  const draft = normalizeTemplateBuilderDraft(rawDraft);
  if (!draft) {
    clearDraftStorage(TEMPLATE_BUILDER_DRAFT_STORAGE_KEY);
    return null;
  }

  if (!isCurrentTemplateBuilderDraftModel(rawDraft)) {
    saveTemplateBuilderDraft(draft);
  }

  return draft;
}

export function saveTemplateBuilderDraft(draft: TemplateBuilderDraftModel): boolean {
  return saveDraftStorage(
    TEMPLATE_BUILDER_DRAFT_STORAGE_KEY,
    draft,
    TEMPLATE_BUILDER_DRAFT_STORAGE_VERSION,
  );
}

export function loadTemplateBuilderExerciseIndex(): TemplateBuilderExerciseIndexItem[] {
  const draft = loadTemplateBuilderDraft();
  return draft?.exerciseIndex ?? [];
}

export function clearTemplateBuilderDraft(): void {
  clearDraftStorage(TEMPLATE_BUILDER_DRAFT_STORAGE_KEY);
}
