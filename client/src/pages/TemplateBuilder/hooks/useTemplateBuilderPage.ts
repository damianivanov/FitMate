import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { exerciseService } from "@/services/exerciseService";
import { workoutTemplateService } from "@/services/workoutTemplateService";
import type { WorkoutTemplateModel } from "@/types";
import {
  cloneTemplateBuilderExercises,
  type TemplateBuilderSetDraftModel as TemplateSetDraft,
} from "../models/templateBuilderDraft";
import {
  TemplateBuilderMode,
  useTemplateBuilderStore,
  type QuickSetField,
} from "../store/templateBuilderStore";
import { useTemplateDraft, type HandleRestoreTemplateDraft } from "./useTemplateDraft";
import { buildTemplatePayload } from "../utils/buildTemplatePayload";

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
  const [lastSavedTemplate, setLastSavedTemplate] = useState<WorkoutTemplateModel | null>(null);

  const routeState = useMemo(
    () => parseTemplateRouteState(templateIdParam),
    [templateIdParam],
  );

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
    markCurrentDraftAsSaved,
    resetDraft,
  } = useTemplateDraft({
    draftContent,
    draftContentFingerprint,
    onRestoreDraft: handleRestoreDraft,
    autosaveIntervalMs: DRAFT_AUTOSAVE_INTERVAL_MS,
  });

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
    resetBuilderState();
    setLastSavedTemplate(null);
    toast.success("Template reset to initial draft.");
    resetDraft();
  }, [resetBuilderState, resetDraft, setLastSavedTemplate]);

  const handleSaveTemplateClick = useCallback(async () => {
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
      const response = await workoutTemplateService.create(payload);
      if (!response.data.success || !response.data.data) {
        toast.error(response.data.error ?? "Could not save template.");
        return;
      }

      setLastSavedTemplate(response.data.data);
      toast.success(
        `Template saved: ${response.data.data.name} (${response.data.data.exerciseCount} exercises, ${response.data.data.setCount} sets).`,
      );
      markCurrentDraftAsSaved({ clearPersistedDraft: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save template.";
      toast.error(message);
    } finally {
      setIsSavingTemplate(false);
    }
  }, [
    durationEnabledExerciseIds,
    durationMinutes,
    exercises,
    isPublic,
    markCurrentDraftAsSaved,
    setIsSavingTemplate,
    setLastSavedTemplate,
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
    lastSavedTemplate,
    activeQuickSetPopoverContext,
    quickSetPopoverAnchorElement,
    handleQuickSetPopoverOpen,
    handleQuickSetPopoverClose,
    handleQuickSetValueChange,
    handleQuickSetApplyToAll,
  };
}
