import type { ExerciseLookupModel } from "@/types";
import {
  DRAFT_STORAGE_KEYS,
  clearDraftStorage,
  loadDraftStorage,
  saveDraftStorage,
} from "@/lib/draftStorage";
import type { TemplateBuilderDraftModel } from "@/pages/TemplateBuilder/models/templateBuilderDraft";
import {
  type TemplateBuilderDraftContent,
  normalizeTemplateBuilderExerciseGroups,
  populateTemplateBuilderExerciseGroupIds,
} from "@/pages/TemplateBuilder/models/templateBuilderDraft";

// the version number should be incremented whenever the shape of the persisted draft data changes in a non-backwards-compatible way
const TEMPLATE_BUILDER_DRAFT_STORAGE_VERSION = 2; 
const INITIAL_DRAFT_VERSION = 0;
const TEMPLATE_BUILDER_DRAFT_STORAGE_KEY = DRAFT_STORAGE_KEYS.templateBuilder;

type PersistedTemplateBuilderDraft = TemplateBuilderDraftContent & {
  draftVersion?: number;
};

function finalizeTemplateBuilderDraft(
  draft: TemplateBuilderDraftModel,
): TemplateBuilderDraftModel {
  const populatedExercises = populateTemplateBuilderExerciseGroupIds(draft.exercises);
  const normalizedExercises = normalizeTemplateBuilderExerciseGroups(populatedExercises);

  return {
    ...draft,
    exercises: normalizedExercises,
  };
}

function normalizePersistedTemplateBuilderDraft(
  persistedDraft: PersistedTemplateBuilderDraft,
): TemplateBuilderDraftModel {
  return {
    draftVersion: persistedDraft.draftVersion ?? INITIAL_DRAFT_VERSION,
    name: persistedDraft.name,
    description: persistedDraft.description,
    estimatedDurationMinutes: persistedDraft.estimatedDurationMinutes,
    isPublic: persistedDraft.isPublic,
    exercises: persistedDraft.exercises,
    exerciseIndex: persistedDraft.exerciseIndex,
  };
}

export function loadTemplateBuilderDraft(): TemplateBuilderDraftModel | null {
  const persistedDraft = loadDraftStorage<PersistedTemplateBuilderDraft>({
    key: TEMPLATE_BUILDER_DRAFT_STORAGE_KEY,
    version: TEMPLATE_BUILDER_DRAFT_STORAGE_VERSION,
  });

  if (!persistedDraft) {
    return null;
  }

  try {
    const draft = finalizeTemplateBuilderDraft(
      normalizePersistedTemplateBuilderDraft(persistedDraft),
    );

    if (persistedDraft.draftVersion === undefined) {
      saveTemplateBuilderDraft(draft);
    }

    return draft;
  } catch {
    clearDraftStorage(TEMPLATE_BUILDER_DRAFT_STORAGE_KEY);
    return null;
  }
}

export function saveTemplateBuilderDraft(draft: TemplateBuilderDraftModel): boolean {
  const persistedDraft: PersistedTemplateBuilderDraft = draft;

  return saveDraftStorage(
    TEMPLATE_BUILDER_DRAFT_STORAGE_KEY,
    persistedDraft,
    TEMPLATE_BUILDER_DRAFT_STORAGE_VERSION,
  );
}

export function loadTemplateBuilderExerciseIndex(): ExerciseLookupModel[] {
  const draft = loadTemplateBuilderDraft();
  return draft?.exerciseIndex ?? [];
}

export function clearTemplateBuilderDraft(): void {
  clearDraftStorage(TEMPLATE_BUILDER_DRAFT_STORAGE_KEY);
}
