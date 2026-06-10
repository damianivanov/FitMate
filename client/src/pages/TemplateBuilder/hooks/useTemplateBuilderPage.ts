import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import { toast } from "sonner";
import { unwrap } from "@/lib/unwrap";
import { workoutTemplateService } from "@/services/workoutTemplateService";
import {
  clearTemplateBuilderDraft,
  loadTemplateBuilderDraft,
  saveTemplateBuilderDraft,
} from "@/services/templateBuilderDraftStorage";
import type { ExerciseMetricMode, QuickSetFieldKey } from "@/shared/components";
import { ExerciseGroupType, type ExerciseLookupModel, type ExerciseSetType } from "@/types";
import {
  areTemplateDraftsEquivalent,
  buildEmptyTemplateDraft,
  buildTemplateDraftFromTemplate,
  buildTemplatePayload,
  cloneTemplateDraft,
  createTemplateExerciseFromLookup,
  createTemplateSetDraftFromPrevious,
  getNextTemplateClientGroupId,
  hasTemplateDraftContent,
  reorderTemplateExercisesForDrag,
  setTemplateExerciseMetricMode,
  type TemplateDraft,
  type TemplateExerciseDraft,
  type TemplateSetDraft,
} from "../utils/templateDraft";

const DRAFT_RESTORED_TOAST_ID = "template-builder-draft-restored";

type QuickSetPopoverState = {
  exerciseId: string;
  setId: string;
  field: QuickSetFieldKey;
};

type GroupAddContext = {
  insertAfterExerciseId: string;
  groupType: ExerciseGroupType;
  groupId: number;
};

type ActiveQuickSetPopoverContext = {
  field: QuickSetFieldKey;
  exerciseId: string;
  setId: string;
  set: TemplateSetDraft;
};

function parseTemplateRouteState(templateIdParam: string | undefined): {
  isEditMode: boolean;
  templateId: number | null;
} {
  const parsed = Number(templateIdParam);
  if (Number.isInteger(parsed) && parsed > 0) {
    return { isEditMode: true, templateId: parsed };
  }

  return { isEditMode: false, templateId: null };
}

function updateDraftExercise(
  draft: TemplateDraft,
  exerciseId: string,
  updater: (exercise: TemplateExerciseDraft) => TemplateExerciseDraft,
): TemplateDraft {
  return {
    ...draft,
    exercises: draft.exercises.map((exercise) =>
      exercise.id === exerciseId ? updater(exercise) : exercise),
  };
}

export function useTemplateBuilderPage() {
  const { templateId: templateIdParam } = useParams<{ templateId?: string }>();
  const routeState = useMemo(() => parseTemplateRouteState(templateIdParam), [templateIdParam]);
  const { isEditMode, templateId } = routeState;

  const [draft, setDraft] = useState<TemplateDraft | null>(null);
  const [collapsedExerciseIds, setCollapsedExerciseIds] = useState<Set<string>>(() => new Set());
  const [quickSetPopover, setQuickSetPopover] = useState<QuickSetPopoverState | null>(null);
  const [quickSetPopoverAnchorElement, setQuickSetPopoverAnchorElement] = useState<HTMLElement | null>(null);
  const [groupAddContext, setGroupAddContext] = useState<GroupAddContext | null>(null);
  const [isAddExerciseModalOpen, setIsAddExerciseModalOpen] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);
  const [templateLoadError, setTemplateLoadError] = useState<string | null>(null);
  const [loadedTemplateDraft, setLoadedTemplateDraft] = useState<TemplateDraft | null>(null);
  const [isDraftHydrated, setIsDraftHydrated] = useState(false);
  const draftRef = useRef<TemplateDraft | null>(null);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    let isCancelled = false;
    setQuickSetPopover(null);
    setQuickSetPopoverAnchorElement(null);
    setGroupAddContext(null);
    setCollapsedExerciseIds(new Set());

    if (isEditMode && templateId !== null) {
      setIsDraftHydrated(true);
      setIsLoadingTemplate(true);
      setTemplateLoadError(null);
      setDraft(null);
      setLoadedTemplateDraft(null);

      void (async () => {
        try {
          const response = await workoutTemplateService.getByIdWithListFallback(templateId);
          if (isCancelled) {
            return;
          }

          const loadedTemplate = unwrap(response.data, "Unable to load template.");
          const templateDraft = buildTemplateDraftFromTemplate(loadedTemplate);
          setDraft(templateDraft);
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
      })();

      return () => {
        isCancelled = true;
      };
    }

    setIsLoadingTemplate(false);
    setTemplateLoadError(null);
    setLoadedTemplateDraft(null);

    const persistedDraft = loadTemplateBuilderDraft();
    if (persistedDraft && hasTemplateDraftContent(persistedDraft)) {
      setDraft(persistedDraft);
      toast.success("Restored unsaved template draft.", { id: DRAFT_RESTORED_TOAST_ID });
    } else {
      setDraft(buildEmptyTemplateDraft());
    }
    setIsDraftHydrated(true);

    return () => {
      isCancelled = true;
    };
  }, [isEditMode, templateId]);

  useEffect(() => {
    if (isEditMode || !isDraftHydrated || !draft) {
      return;
    }

    if (hasTemplateDraftContent(draft)) {
      saveTemplateBuilderDraft(draft);
    } else {
      clearTemplateBuilderDraft();
    }
  }, [draft, isDraftHydrated, isEditMode]);

  const activeQuickSetPopoverContext = useMemo<ActiveQuickSetPopoverContext | null>(() => {
    if (!draft || !quickSetPopover) {
      return null;
    }

    const activeExercise = draft.exercises.find((exercise) => exercise.id === quickSetPopover.exerciseId);
    const activeSet = activeExercise?.sets.find((set) => set.id === quickSetPopover.setId);
    if (!activeExercise || !activeSet) {
      return null;
    }

    return {
      field: quickSetPopover.field,
      exerciseId: activeExercise.id,
      setId: activeSet.id,
      set: activeSet,
    };
  }, [draft, quickSetPopover]);

  useEffect(() => {
    if (!quickSetPopover || activeQuickSetPopoverContext) {
      return;
    }

    setQuickSetPopover(null);
    setQuickSetPopoverAnchorElement(null);
  }, [activeQuickSetPopoverContext, quickSetPopover]);

  const handleNameChange = useCallback((value: string) => {
    setDraft((current) => (current ? { ...current, name: value } : current));
  }, []);

  const handleDescriptionChange = useCallback((value: string) => {
    setDraft((current) => (current ? { ...current, description: value } : current));
  }, []);

  const handleDurationChange = useCallback((value: number) => {
    setDraft((current) => (current ? { ...current, estimatedDurationMinutes: value } : current));
  }, []);

  const handleIsPublicChange = useCallback((value: boolean) => {
    setDraft((current) => (current ? { ...current, isPublic: value } : current));
  }, []);

  const handleAddExercise = useCallback((exercise: ExerciseLookupModel): boolean => {
    const current = draftRef.current;
    if (!current) {
      return false;
    }

    if (current.exercises.some((item) => item.exerciseId === exercise.id)) {
      toast.error("Exercise is already in this template.");
      return false;
    }

    const nextExercise = createTemplateExerciseFromLookup(exercise);
    const context = groupAddContext;
    if (context) {
      nextExercise.groupType = context.groupType;
      nextExercise.clientGroupId = context.groupId;
    }

    setDraft((latest) => {
      if (!latest) {
        return latest;
      }

      if (!context) {
        return { ...latest, exercises: [...latest.exercises, nextExercise] };
      }

      const anchorIndex = latest.exercises.findIndex((item) => item.id === context.insertAfterExerciseId);
      const nextExercises = [...latest.exercises];
      if (anchorIndex < 0) {
        nextExercises.push(nextExercise);
      } else {
        nextExercises.splice(anchorIndex + 1, 0, nextExercise);
      }

      return { ...latest, exercises: nextExercises };
    });

    toast.success(`${exercise.name} added to this template.`);
    if (context) {
      setGroupAddContext({ ...context, insertAfterExerciseId: nextExercise.id });
    }

    return true;
  }, [groupAddContext]);

  const handleRemoveLibraryExercise = useCallback((exercise: ExerciseLookupModel): boolean => {
    const current = draftRef.current;
    if (!current || !current.exercises.some((item) => item.exerciseId === exercise.id)) {
      return false;
    }

    const removedDraftIds = new Set(
      current.exercises
        .filter((item) => item.exerciseId === exercise.id)
        .map((item) => item.id),
    );

    setDraft((latest) =>
      latest
        ? { ...latest, exercises: latest.exercises.filter((item) => item.exerciseId !== exercise.id) }
        : latest,
    );
    setCollapsedExerciseIds((latest) => {
      const next = new Set(latest);
      let changed = false;
      removedDraftIds.forEach((id) => {
        changed = next.delete(id) || changed;
      });
      return changed ? next : latest;
    });
    setQuickSetPopover((latest) => {
      if (!latest || !removedDraftIds.has(latest.exerciseId)) {
        return latest;
      }

      setQuickSetPopoverAnchorElement(null);
      return null;
    });

    toast.success(`${exercise.name} removed from this template.`);
    return true;
  }, []);

  const handleAddExerciseModalOpen = useCallback(() => {
    setGroupAddContext(null);
    setIsAddExerciseModalOpen(true);
  }, []);

  const handleAddExerciseToGroup = useCallback((
    insertAfterExerciseId: string,
    groupType: ExerciseGroupType,
    groupId: number,
  ) => {
    setGroupAddContext({ insertAfterExerciseId, groupType, groupId });
    setIsAddExerciseModalOpen(true);
  }, []);

  const handleAddExerciseModalClose = useCallback(() => {
    setIsAddExerciseModalOpen(false);
    setGroupAddContext(null);
  }, []);

  const handleRemoveExercise = useCallback((exerciseId: string) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      const nextExercises = current.exercises.filter((exercise) => exercise.id !== exerciseId);
      if (nextExercises.length === current.exercises.length) {
        return current;
      }

      return { ...current, exercises: nextExercises };
    });
    setCollapsedExerciseIds((current) => {
      if (!current.has(exerciseId)) {
        return current;
      }

      const next = new Set(current);
      next.delete(exerciseId);
      return next;
    });
    setQuickSetPopover((current) => {
      if (current?.exerciseId !== exerciseId) {
        return current;
      }

      setQuickSetPopoverAnchorElement(null);
      return null;
    });
    setGroupAddContext((current) =>
      current?.insertAfterExerciseId === exerciseId ? null : current);
  }, []);

  const handleExerciseGroupingChange = useCallback((exerciseId: string, groupType: ExerciseGroupType) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      const targetExercise = current.exercises.find((exercise) => exercise.id === exerciseId);
      if (!targetExercise) {
        return current;
      }

      if (groupType === ExerciseGroupType.Straight) {
        const targetGroupId = targetExercise.clientGroupId;
        return {
          ...current,
          exercises: current.exercises.map((exercise) =>
            targetGroupId !== undefined && exercise.clientGroupId === targetGroupId
              ? { ...exercise, groupType: ExerciseGroupType.Straight, clientGroupId: undefined }
              : exercise),
        };
      }

      if (targetExercise.clientGroupId !== undefined) {
        return {
          ...current,
          exercises: current.exercises.map((exercise) =>
            exercise.clientGroupId === targetExercise.clientGroupId
              ? { ...exercise, groupType }
              : exercise),
        };
      }

      const nextGroupId = getNextTemplateClientGroupId(current.exercises);
      return {
        ...current,
        exercises: current.exercises.map((exercise) =>
          exercise.id === exerciseId
            ? { ...exercise, groupType, clientGroupId: nextGroupId }
            : exercise),
      };
    });
  }, []);

  const handleExerciseNotesChange = useCallback((exerciseId: string, value: string) => {
    setDraft((current) =>
      current ? updateDraftExercise(current, exerciseId, (exercise) => ({ ...exercise, notes: value })) : current);
  }, []);

  const handleExerciseMetricModeChange = useCallback((exerciseId: string, metricMode: ExerciseMetricMode) => {
    setDraft((current) =>
      current
        ? updateDraftExercise(current, exerciseId, (exercise) =>
            setTemplateExerciseMetricMode(exercise, metricMode))
        : current);

    const nextMetricField = metricMode === "duration" ? "durationSeconds" : "reps";
    setQuickSetPopover((current) => {
      if (!current || current.exerciseId !== exerciseId) {
        return current;
      }

      const isMetricField =
        current.field === "reps"
        || current.field === "durationSeconds";
      if (!isMetricField || current.field === nextMetricField) {
        return current;
      }

      setQuickSetPopoverAnchorElement(null);
      return null;
    });
  }, []);

  const handleAddSet = useCallback((exerciseId: string) => {
    setDraft((current) =>
      current
        ? updateDraftExercise(current, exerciseId, (exercise) => ({
            ...exercise,
            sets: [...exercise.sets, createTemplateSetDraftFromPrevious(exercise.sets[exercise.sets.length - 1])],
          }))
        : current);
  }, []);

  const handleRemoveSet = useCallback((exerciseId: string, setId: string) => {
    const exercise = draftRef.current?.exercises.find((item) => item.id === exerciseId);
    if (exercise && exercise.sets.length <= 1) {
      toast.error("Exercise needs at least one set.");
      return;
    }

    setDraft((current) =>
      current
        ? updateDraftExercise(current, exerciseId, (item) => ({
            ...item,
            sets: item.sets.filter((set) => set.id !== setId),
          }))
        : current);
    setQuickSetPopover((current) => {
      if (current?.exerciseId !== exerciseId || current.setId !== setId) {
        return current;
      }

      setQuickSetPopoverAnchorElement(null);
      return null;
    });
  }, []);

  const handleSetTypeChange = useCallback((exerciseId: string, setId: string, setType: ExerciseSetType) => {
    setDraft((current) =>
      current
        ? updateDraftExercise(current, exerciseId, (exercise) => ({
            ...exercise,
            sets: exercise.sets.map((set) => (set.id === setId ? { ...set, setType } : set)),
          }))
        : current);
  }, []);

  const handleSetReorder = useCallback((exerciseId: string, activeSetId: string, overSetId: string) => {
    setDraft((current) =>
      current
        ? updateDraftExercise(current, exerciseId, (exercise) => {
            const activeIndex = exercise.sets.findIndex((set) => set.id === activeSetId);
            const overIndex = exercise.sets.findIndex((set) => set.id === overSetId);
            if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) {
              return exercise;
            }

            const nextSets = exercise.sets.slice();
            const [movedSet] = nextSets.splice(activeIndex, 1);
            if (!movedSet) {
              return exercise;
            }

            nextSets.splice(overIndex, 0, movedSet);
            return { ...exercise, sets: nextSets };
          })
        : current);
  }, []);

  const handleSetFieldChange = useCallback((
    exerciseId: string,
    setId: string,
    field: QuickSetFieldKey,
    value: number,
  ) => {
    setDraft((current) =>
      current
        ? updateDraftExercise(current, exerciseId, (exercise) => ({
            ...exercise,
            sets: exercise.sets.map((set) => (set.id === setId ? { ...set, [field]: value } : set)),
          }))
        : current);
  }, []);

  const handleExerciseReorder = useCallback((activeExerciseId: string, overExerciseId: string) => {
    setDraft((current) =>
      current
        ? { ...current, exercises: reorderTemplateExercisesForDrag(current.exercises, activeExerciseId, overExerciseId) }
        : current);
  }, []);

  const handleToggleExerciseCollapse = useCallback((exerciseId: string) => {
    setCollapsedExerciseIds((current) => {
      const next = new Set(current);
      if (next.has(exerciseId)) {
        next.delete(exerciseId);
      } else {
        next.add(exerciseId);
      }

      return next;
    });
  }, []);

  const handleSetGroupCollapse = useCallback((exerciseIds: string[], collapsed: boolean) => {
    setCollapsedExerciseIds((current) => {
      const next = new Set(current);
      exerciseIds.forEach((exerciseId) => {
        if (collapsed) {
          next.add(exerciseId);
        } else {
          next.delete(exerciseId);
        }
      });

      return next;
    });
  }, []);

  const handleQuickSetPopoverOpen = useCallback((
    exerciseId: string,
    setId: string,
    field: QuickSetFieldKey,
    anchorElement: HTMLElement,
  ) => {
    setQuickSetPopoverAnchorElement(anchorElement);
    setQuickSetPopover({ exerciseId, setId, field });
  }, []);

  const handleQuickSetPopoverClose = useCallback(() => {
    setQuickSetPopover(null);
    setQuickSetPopoverAnchorElement(null);
  }, []);

  const handleQuickSetValueChange = useCallback((value: number) => {
    if (!activeQuickSetPopoverContext) {
      return;
    }

    handleSetFieldChange(
      activeQuickSetPopoverContext.exerciseId,
      activeQuickSetPopoverContext.setId,
      activeQuickSetPopoverContext.field,
      value,
    );
  }, [activeQuickSetPopoverContext, handleSetFieldChange]);

  const handleQuickSetApplyToAll = useCallback((value: number) => {
    if (!activeQuickSetPopoverContext) {
      return;
    }

    const { exerciseId, field } = activeQuickSetPopoverContext;
    setDraft((current) =>
      current
        ? updateDraftExercise(current, exerciseId, (exercise) => ({
            ...exercise,
            sets: exercise.sets.map((set) => ({ ...set, [field]: value })),
          }))
        : current);
  }, [activeQuickSetPopoverContext]);

  const handleDiscardClick = useCallback(() => {
    if (isEditMode && loadedTemplateDraft) {
      setDraft(cloneTemplateDraft(loadedTemplateDraft));
      setCollapsedExerciseIds(new Set());
      toast.success("Template changes discarded.");
      return;
    }

    setDraft(buildEmptyTemplateDraft());
    setCollapsedExerciseIds(new Set());
    clearTemplateBuilderDraft();
    toast.success("Template reset to initial draft.");
  }, [isEditMode, loadedTemplateDraft]);

  const handleSaveTemplateClick = useCallback(async () => {
    const current = draftRef.current;
    if (!current || isSavingTemplate) {
      return;
    }

    setIsSavingTemplate(true);

    try {
      const payload = buildTemplatePayload(current);
      const response = isEditMode && templateId !== null
        ? await workoutTemplateService.update(templateId, payload)
        : await workoutTemplateService.create(payload);
      const savedTemplate = unwrap(
        response.data,
        isEditMode ? "Could not update template." : "Could not save template.",
      );

      toast.success(
        `Template ${isEditMode ? "updated" : "saved"}: ${savedTemplate.name} (${savedTemplate.exerciseCount} exercises, ${savedTemplate.setCount} sets).`,
      );

      if (isEditMode) {
        setLoadedTemplateDraft(cloneTemplateDraft(current));
      } else {
        clearTemplateBuilderDraft();
      }
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : isEditMode
          ? "Could not update template."
          : "Could not save template.";
      toast.error(message);
    } finally {
      setIsSavingTemplate(false);
    }
  }, [isEditMode, isSavingTemplate, templateId]);

  const hasUnsavedTemplateChanges = useMemo(() => {
    if (!isEditMode) {
      return true;
    }

    if (!draft || !loadedTemplateDraft) {
      return false;
    }

    return !areTemplateDraftsEquivalent(draft, loadedTemplateDraft);
  }, [isEditMode, draft, loadedTemplateDraft]);

  const isBuilderLoading = isEditMode ? isLoadingTemplate : !isDraftHydrated;
  const isSaveTemplateDisabled =
    isEditMode && (isLoadingTemplate || templateLoadError !== null || !hasUnsavedTemplateChanges);
  const saveTemplateLabel = isEditMode ? "Update" : "Save";

  const state = useMemo(
    () => ({
      draft,
      collapsedExerciseIds,
      isBuilderLoading,
      templateLoadError,
      isSaveTemplateDisabled,
      saveTemplateLabel,
      isSavingTemplate,
      isAddExerciseModalOpen,
      activeQuickSetPopoverContext,
      quickSetPopoverAnchorElement,
    }),
    [
      draft,
      collapsedExerciseIds,
      isBuilderLoading,
      templateLoadError,
      isSaveTemplateDisabled,
      saveTemplateLabel,
      isSavingTemplate,
      isAddExerciseModalOpen,
      activeQuickSetPopoverContext,
      quickSetPopoverAnchorElement,
    ],
  );

  const actions = useMemo(
    () => ({
      handleNameChange,
      handleDescriptionChange,
      handleDurationChange,
      handleIsPublicChange,
      handleAddExercise,
      handleRemoveLibraryExercise,
      handleAddExerciseModalOpen,
      handleAddExerciseToGroup,
      handleAddExerciseModalClose,
      handleRemoveExercise,
      handleExerciseGroupingChange,
      handleExerciseNotesChange,
      handleExerciseMetricModeChange,
      handleAddSet,
      handleRemoveSet,
      handleSetTypeChange,
      handleSetReorder,
      handleSetFieldChange,
      handleExerciseReorder,
      handleToggleExerciseCollapse,
      handleSetGroupCollapse,
      handleQuickSetPopoverOpen,
      handleQuickSetPopoverClose,
      handleQuickSetValueChange,
      handleQuickSetApplyToAll,
      handleDiscardClick,
      handleSaveTemplateClick,
    }),
    [
      handleNameChange,
      handleDescriptionChange,
      handleDurationChange,
      handleIsPublicChange,
      handleAddExercise,
      handleRemoveLibraryExercise,
      handleAddExerciseModalOpen,
      handleAddExerciseToGroup,
      handleAddExerciseModalClose,
      handleRemoveExercise,
      handleExerciseGroupingChange,
      handleExerciseNotesChange,
      handleExerciseMetricModeChange,
      handleAddSet,
      handleRemoveSet,
      handleSetTypeChange,
      handleSetReorder,
      handleSetFieldChange,
      handleExerciseReorder,
      handleToggleExerciseCollapse,
      handleSetGroupCollapse,
      handleQuickSetPopoverOpen,
      handleQuickSetPopoverClose,
      handleQuickSetValueChange,
      handleQuickSetApplyToAll,
      handleDiscardClick,
      handleSaveTemplateClick,
    ],
  );

  return { state, actions };
}
