import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { exerciseService } from "@/services/exerciseService";
import { workoutTemplateService } from "@/services/workoutTemplateService";
import type { ExerciseLookupModel } from "@/types";
import {
  cloneTemplateBuilderExercises,
  type TemplateBuilderDraftModel,
  type TemplateBuilderSetDraftModel as TemplateSetDraft,
} from "../models/templateBuilderDraft";
import {
  TemplateBuilderMode,
  useTemplateBuilderStore,
  type QuickSetField,
} from "../store/templateBuilderStore";
import { useTemplateDraft, type HandleRestoreTemplateDraft } from "./useTemplateDraft";
import { buildTemplatePayload } from "../utils/buildTemplatePayload";
import { buildTemplateBuilderDraftFromTemplate } from "../utils/templateModelToDraft";

const ADD_EXERCISE_FEEDBACK_DURATION_MS = 2000;
const DRAFT_AUTOSAVE_INTERVAL_MS = 5000;
const DRAFT_RESTORED_TOAST_ID = "template-builder-draft-restored";

type ActiveQuickSetPopoverContext = {
  field: QuickSetField;
  exerciseId: string;
  setId: string;
  set: TemplateSetDraft;
};

function parseTemplateRouteState(templateIdParam: string | undefined): {
  mode: TemplateBuilderMode;
  templateId: number | null;
} {
  const parsedTemplateId = Number(templateIdParam);
  if (Number.isInteger(parsedTemplateId) && parsedTemplateId > 0) {
    return {
      mode: TemplateBuilderMode.Edit,
      templateId: parsedTemplateId,
    };
  }

  return {
    mode: TemplateBuilderMode.Create,
    templateId: null,
  };
}

export function useTemplateBuilderPage() {
  const { templateId: templateIdParam } = useParams<{ templateId?: string }>();

  const initializeMode = useTemplateBuilderStore((state) => state.initializeMode);
  const resetBuilderState = useTemplateBuilderStore((state) => state.resetBuilderState);
  const populateFromDraft = useTemplateBuilderStore((state) => state.populateFromDraft);
  const upsertExerciseIndex = useTemplateBuilderStore((state) => state.upsertExerciseIndex);
  const filterExerciseIndexByActiveExercises = useTemplateBuilderStore(
    (state) => state.filterExerciseIndexByActiveExercises,
  );
  const setAddExerciseFeedback = useTemplateBuilderStore((state) => state.setAddExerciseFeedback);
  const openQuickSetPopover = useTemplateBuilderStore((state) => state.openQuickSetPopover);
  const closeQuickSetPopover = useTemplateBuilderStore((state) => state.closeQuickSetPopover);
  const setSetFieldValue = useTemplateBuilderStore((state) => state.setSetFieldValue);
  const applyFieldToAllSets = useTemplateBuilderStore((state) => state.applyFieldToAllSets);

  const templateName = useTemplateBuilderStore((state) => state.templateName);
  const templateDescription = useTemplateBuilderStore((state) => state.templateDescription);
  const durationMinutes = useTemplateBuilderStore((state) => state.durationMinutes);
  const isPublic = useTemplateBuilderStore((state) => state.isPublic);
  const exercises = useTemplateBuilderStore((state) => state.exercises);
  const exerciseIndex = useTemplateBuilderStore((state) => state.exerciseIndex);
  const addExerciseFeedback = useTemplateBuilderStore((state) => state.addExerciseFeedback);
  const durationEnabledExerciseIds = useTemplateBuilderStore((state) => state.durationEnabledExerciseIds);
  const quickSetPopover = useTemplateBuilderStore((state) => state.quickSetPopover);
  const [quickSetPopoverAnchorElement, setQuickSetPopoverAnchorElement] = useState<HTMLElement | null>(null);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [loadedTemplateDraft, setLoadedTemplateDraft] = useState<TemplateBuilderDraftModel | null>(null);
  const [templateLoadError, setTemplateLoadError] = useState<string | null>(null);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);

  const routeState = useMemo(
    () => parseTemplateRouteState(templateIdParam),
    [templateIdParam],
  );
  const isCreateMode = routeState.mode === TemplateBuilderMode.Create;
  const isEditMode = routeState.mode === TemplateBuilderMode.Edit;

  useEffect(() => {
    initializeMode(routeState.mode, routeState.templateId);
    resetBuilderState();
  }, [initializeMode, resetBuilderState, routeState.mode, routeState.templateId]);

  const draftContentFingerprint = useMemo(
    () =>
      JSON.stringify({
        name: templateName,
        description: templateDescription,
        estimatedDurationMinutes: durationMinutes,
        isPublic,
        exercises,
        exerciseIndex,
      }),
    [durationMinutes, exerciseIndex, exercises, isPublic, templateDescription, templateName],
  );

  const draftContent = useMemo(
    () => ({
      name: templateName,
      description: templateDescription,
      estimatedDurationMinutes: durationMinutes,
      isPublic,
      exercises: cloneTemplateBuilderExercises(exercises),
      exerciseIndex: [...exerciseIndex],
    }),
    [durationMinutes, exerciseIndex, exercises, isPublic, templateDescription, templateName],
  );

  const handleRestoreDraft = useCallback<HandleRestoreTemplateDraft>(
    async (restoredDraft, isCancelled) => {
      const restoredExercises = cloneTemplateBuilderExercises(restoredDraft.exercises);
      if (isCancelled()) {
        return;
      }

      populateFromDraft({
        ...restoredDraft,
        exercises: restoredExercises,
      });
      toast.success("Restored unsaved template draft.", { id: DRAFT_RESTORED_TOAST_ID });

      const restoredExerciseIds = Array.from(
        new Set(
          restoredExercises
            .map((exercise) => exercise.exerciseId)
            .filter((exerciseId) => exerciseId > 0),
        ),
      );

      if (!restoredExerciseIds.length) {
        return;
      }

      try {
        const response = await exerciseService.getByIds(restoredExerciseIds);
        if (isCancelled()) {
          return;
        }

        const result = response.data;
        if (!result.success || !result.data || !result.data.length) {
          return;
        }

        upsertExerciseIndex(result.data);
      } catch {
        // Keep local draft index data if lookup refresh fails.
      }
    },
    [populateFromDraft, upsertExerciseIndex],
  );

  const {
    isDraftHydrated,
    markCurrentDraftAsSaved,
    resetDraft,
  } = useTemplateDraft({
    draftContent,
    draftContentFingerprint,
    onRestoreDraft: handleRestoreDraft,
    autosaveIntervalMs: DRAFT_AUTOSAVE_INTERVAL_MS,
    enabled: isCreateMode,
  });

  useEffect(() => {
    const templateId = routeState.templateId;
    if (!isEditMode || !templateId) {
      setIsLoadingTemplate(false);
      setTemplateLoadError(null);
      setLoadedTemplateDraft(null);
      return;
    }

    let isCancelled = false;

    const loadTemplate = async () => {
      setIsLoadingTemplate(true);
      setTemplateLoadError(null);
      setLoadedTemplateDraft(null);

      try {
        const response = await workoutTemplateService.getByIdWithListFallback(templateId);
        const result = response.data;
        if (!result.success || !result.data) {
          throw new Error(result.error ?? "Unable to load template.");
        }

        const template = result.data;
        const exerciseIds = Array.from(
          new Set(
            template.groups
              .flatMap((group) => group.exercises)
              .map((exercise) => exercise.exerciseId)
              .filter((exerciseId) => exerciseId > 0),
          ),
        );
        let exerciseLookups: ExerciseLookupModel[] = [];

        if (exerciseIds.length) {
          try {
            const exerciseResponse = await exerciseService.getByIds(exerciseIds);
            const exerciseResult = exerciseResponse.data;
            if (exerciseResult.success && exerciseResult.data) {
              exerciseLookups = exerciseResult.data;
            }
          } catch {
            exerciseLookups = [];
          }
        }

        if (isCancelled) {
          return;
        }

        const templateDraft = buildTemplateBuilderDraftFromTemplate(template, exerciseLookups);
        populateFromDraft(templateDraft);
        setLoadedTemplateDraft(templateDraft);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : "Unable to load template.";
        setTemplateLoadError(message);
        toast.error(message);
      } finally {
        if (!isCancelled) {
          setIsLoadingTemplate(false);
        }
      }
    };

    void loadTemplate();

    return () => {
      isCancelled = true;
    };
  }, [isEditMode, populateFromDraft, routeState.templateId]);

  const activeQuickSetPopoverContext = useMemo<ActiveQuickSetPopoverContext | null>(() => {
    if (!quickSetPopover) {
      return null;
    }

    const activeExercise = exercises.find((exercise) => exercise.id === quickSetPopover.exerciseId);
    if (!activeExercise) {
      return null;
    }

    const activeSet = activeExercise.sets.find((setItem) => setItem.id === quickSetPopover.setId);
    if (!activeSet) {
      return null;
    }

    return {
      field: quickSetPopover.field,
      exerciseId: activeExercise.id,
      setId: activeSet.id,
      set: activeSet,
    };
  }, [exercises, quickSetPopover]);

  useEffect(() => {
    filterExerciseIndexByActiveExercises();
  }, [exercises, filterExerciseIndexByActiveExercises]);

  useEffect(() => {
    if (!addExerciseFeedback) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setAddExerciseFeedback(null);
    }, ADD_EXERCISE_FEEDBACK_DURATION_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [addExerciseFeedback, setAddExerciseFeedback]);

  useEffect(() => {
    if (!quickSetPopover || activeQuickSetPopoverContext) {
      return;
    }

    setQuickSetPopoverAnchorElement(null);
    closeQuickSetPopover();
  }, [activeQuickSetPopoverContext, closeQuickSetPopover, quickSetPopover]);

  useEffect(() => {
    if (quickSetPopover) {
      return;
    }

    setQuickSetPopoverAnchorElement(null);
  }, [quickSetPopover]);

  const handleDiscardClick = useCallback(() => {
    if (isEditMode && loadedTemplateDraft) {
      populateFromDraft(loadedTemplateDraft);
      toast.success("Template changes discarded.");
      return;
    }

    resetBuilderState();
    toast.success("Template reset to initial draft.");
    resetDraft();
  }, [isEditMode, loadedTemplateDraft, populateFromDraft, resetBuilderState, resetDraft]);

  const handleSaveTemplateClick = useCallback(async () => {
    const templateId = routeState.templateId;
    const isUpdatingTemplate = isEditMode && templateId !== null;
    const payload = buildTemplatePayload({
      templateName,
      templateDescription,
      durationMinutes,
      isPublic,
      exercises,
      durationEnabledExerciseIds,
    });

    setIsSavingTemplate(true);

    try {
      const response = isUpdatingTemplate && templateId !== null
        ? await workoutTemplateService.update(templateId, payload)
        : await workoutTemplateService.create(payload);
      if (!response.data.success || !response.data.data) {
        toast.error(response.data.error ?? (isUpdatingTemplate ? "Could not update template." : "Could not save template."));
        return;
      }

      toast.success(
        `Template ${isUpdatingTemplate ? "updated" : "saved"}: ${response.data.data.name} (${response.data.data.exerciseCount} exercises, ${response.data.data.setCount} sets).`,
      );
      if (isUpdatingTemplate) {
        setLoadedTemplateDraft({
          draftVersion: 0,
          ...draftContent,
        });
      } else {
        markCurrentDraftAsSaved({ clearPersistedDraft: true });
      }
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : isUpdatingTemplate
          ? "Could not update template."
          : "Could not save template.";
      toast.error(message);
    } finally {
      setIsSavingTemplate(false);
    }
  }, [
    durationEnabledExerciseIds,
    durationMinutes,
    exercises,
    draftContent,
    isPublic,
    isEditMode,
    markCurrentDraftAsSaved,
    routeState.templateId,
    setIsSavingTemplate,
    setLoadedTemplateDraft,
    templateDescription,
    templateName,
  ]);

  const handleQuickSetPopoverClose = useCallback(() => {
    setQuickSetPopoverAnchorElement(null);
    closeQuickSetPopover();
  }, [closeQuickSetPopover]);

  const handleQuickSetPopoverOpen = useCallback((
    exerciseId: string,
    setId: string,
    field: QuickSetField,
    anchorElement: HTMLElement,
  ) => {
    setQuickSetPopoverAnchorElement(anchorElement);
    openQuickSetPopover(exerciseId, setId, field);
  }, [openQuickSetPopover]);

  const handleQuickSetValueChange = useCallback((value: number) => {
    if (!activeQuickSetPopoverContext) {
      return;
    }

    setSetFieldValue(
      activeQuickSetPopoverContext.exerciseId,
      activeQuickSetPopoverContext.setId,
      activeQuickSetPopoverContext.field,
      value,
    );
  }, [activeQuickSetPopoverContext, setSetFieldValue]);

  const handleQuickSetApplyToAll = useCallback((value: number) => {
    if (!activeQuickSetPopoverContext) {
      return;
    }

    applyFieldToAllSets(
      activeQuickSetPopoverContext.exerciseId,
      activeQuickSetPopoverContext.field,
      value,
    );
  }, [activeQuickSetPopoverContext, applyFieldToAllSets]);

  return {
    handleDiscardClick,
    handleSaveTemplateClick,
    isSavingTemplate,
    isBuilderLoading: isEditMode ? isLoadingTemplate : !isDraftHydrated,
    templateLoadError,
    isSaveTemplateDisabled: isEditMode && (isLoadingTemplate || templateLoadError !== null),
    saveTemplateLabel: isEditMode ? "Update" : "Save",
    activeQuickSetPopoverContext,
    quickSetPopoverAnchorElement,
    handleQuickSetPopoverOpen,
    handleQuickSetPopoverClose,
    handleQuickSetValueChange,
    handleQuickSetApplyToAll,
  };
}
