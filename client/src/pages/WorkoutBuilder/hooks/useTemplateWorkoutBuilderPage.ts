import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import { unwrap } from "@/lib/unwrap";
import {
  clearWorkoutSessionState,
  saveWorkoutSessionState,
} from "@/lib/workoutSessionStorage";
import { workoutService } from "@/services/workoutService";
import { workoutTemplateService } from "@/services/workoutTemplateService";
import { getExerciseBlockDragOrderIndexes, type ExerciseMetricMode } from "@/shared/components";
import { ExerciseGroupType, type ExerciseLookupModel, type ExerciseSetType, type PreviousExerciseSets } from "@/types";
import {
  buildEmptyWorkoutDraft,
  buildWorkoutDraftFromWorkout,
  buildWorkoutDraftFromTemplate,
  buildWorkoutExerciseGroups,
  buildWorkoutPayload,
  calculateWorkoutSummary,
  createWorkoutExerciseDraftFromLookup,
  createWorkoutSetDraft,
  createWorkoutSetDraftFromPreviousSet,
  findNextIncompleteWorkoutExercise,
  hasMainMetric,
  normalizeWorkoutExerciseOrderIndexes,
  setWorkoutExerciseMetricMode,
  validateWorkoutDraft,
  type WorkoutDraft,
  type WorkoutExerciseDraft,
  type WorkoutSetDraft,
  type WorkoutSetMetricField,
} from "../utils/workoutDraft";

type PreviousSetsByExerciseId = Record<number, PreviousExerciseSets>;

type ActiveQuickSetPopoverContext = {
  field: WorkoutSetMetricField;
  exerciseId: string;
  setId: string;
  set: WorkoutSetDraft;
};

type QuickSetPopoverState = {
  exerciseId: string;
  setId: string;
  field: WorkoutSetMetricField;
};

type GroupAddContext = {
  insertAfterExerciseId: string;
  groupType: ExerciseGroupType;
  clientGroupId: number;
};

const WORKOUT_AUTOSAVE_DEBOUNCE_MS = 800;

function parseTemplateId(value: string | null | undefined): number | null {
  const parsedValue = Number(value);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function getWorkoutTitle(draft: WorkoutDraft | null | undefined): string {
  return draft?.title.trim() || "Untitled Workout";
}

function updateDraftExercise(
  draft: WorkoutDraft,
  exerciseDraftId: string,
  updater: (exercise: WorkoutExerciseDraft) => WorkoutExerciseDraft,
): WorkoutDraft {
  return {
    ...draft,
    exercises: draft.exercises.map((exercise) =>
      exercise.id === exerciseDraftId ? updater(exercise) : exercise,
    ),
  };
}

function normalizeSetOrderIndexes(sets: WorkoutSetDraft[]): WorkoutSetDraft[] {
  return sets.map((set, index) => ({
    ...set,
    orderIndex: index + 1,
  }));
}

function moveArrayItem<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] {
  const nextItems = items.slice();
  const [item] = nextItems.splice(fromIndex, 1);
  if (item === undefined) {
    return items.slice();
  }

  nextItems.splice(toIndex, 0, item);
  return nextItems;
}

function reorderWorkoutSetsForDrag(
  sets: readonly WorkoutSetDraft[],
  activeSetId: string,
  overSetId: string,
): WorkoutSetDraft[] {
  const activeIndex = sets.findIndex((set) => set.id === activeSetId);
  const overIndex = sets.findIndex((set) => set.id === overSetId);
  if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) {
    return sets.slice();
  }

  return normalizeSetOrderIndexes(moveArrayItem(sets, activeIndex, overIndex));
}

function reorderWorkoutExercisesForDrag(
  exercises: readonly WorkoutExerciseDraft[],
  activeExerciseId: string,
  overExerciseId: string,
): WorkoutExerciseDraft[] {
  const items = exercises.map((exercise) => ({
    id: exercise.id,
    groupId: exercise.clientGroupId ?? null,
    groupType: exercise.groupType,
  }));
  const nextIndexes = getExerciseBlockDragOrderIndexes(items, activeExerciseId, overExerciseId);
  return normalizeWorkoutExerciseOrderIndexes(nextIndexes.map((index) => exercises[index]));
}

function getNextWorkoutClientGroupId(exercises: readonly WorkoutExerciseDraft[]): number {
  const groupIds = exercises
    .map((exercise) => exercise.clientGroupId)
    .filter((value): value is number => typeof value === "number");

  return groupIds.length ? Math.max(...groupIds) + 1 : 1;
}

export function useTemplateWorkoutBuilderPage() {
  const navigate = useNavigate();
  const { workoutId: workoutIdParam } = useParams<{ workoutId?: string }>();
  const [searchParams] = useSearchParams();
  const templateIdParam = searchParams.get("templateId");
  const workoutId = useMemo(
    () => parseTemplateId(workoutIdParam),
    [workoutIdParam],
  );
  const templateId = useMemo(
    () => parseTemplateId(templateIdParam),
    [templateIdParam],
  );
  const [draft, setDraft] = useState<WorkoutDraft | null>(null);
  const [previousSetsByExerciseId, setPreviousSetsByExerciseId] = useState<PreviousSetsByExerciseId>({});
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(true);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [isSavingWorkout, setIsSavingWorkout] = useState(false);
  const [isDeletingWorkout, setIsDeletingWorkout] = useState(false);
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [quickSetPopover, setQuickSetPopover] = useState<QuickSetPopoverState | null>(null);
  const [quickSetPopoverAnchorElement, setQuickSetPopoverAnchorElement] = useState<HTMLElement | null>(null);
  const [isAddExerciseModalOpen, setIsAddExerciseModalOpen] = useState(false);
  const [groupAddContext, setGroupAddContext] = useState<GroupAddContext | null>(null);
  const [collapsedExerciseIds, setCollapsedExerciseIds] = useState<Set<string>>(() => new Set());
  const [scrollToExerciseId, setScrollToExerciseId] = useState<string | null>(null);
  const draftRef = useRef<WorkoutDraft | null>(null);
  const draftSavePromiseRef = useRef<Promise<void> | null>(null);
  const isDraftSaveInFlightRef = useRef(false);
  const isDeletingWorkoutRef = useRef(false);
  const hasPendingDraftSaveRef = useRef(false);
  const hasShownDraftSaveErrorRef = useRef(false);
  const draftWorkoutIdRef = useRef<number | undefined>(undefined);
  const startWorkoutPromiseRef = useRef<Promise<number | null> | null>(null);

  const loadPreviousSetsForDraft = useCallback(async (nextDraft: WorkoutDraft) => {
    const exerciseIds = Array.from(
      new Set(nextDraft.exercises.map((exercise) => exercise.exerciseId)),
    );

    if (!exerciseIds.length) {
      return;
    }

    try {
      const previousSetsResponse = await workoutService.getPreviousSets(exerciseIds);
      const previousSetsResult = previousSetsResponse.data;
      if (!previousSetsResult.success || !previousSetsResult.data) {
        return;
      }

      const nextPreviousSetsByExerciseId: PreviousSetsByExerciseId = {};
      previousSetsResult.data.items.forEach((item) => {
        nextPreviousSetsByExerciseId[item.exerciseId] = item;
      });
      setPreviousSetsByExerciseId(nextPreviousSetsByExerciseId);
    } catch {
      setPreviousSetsByExerciseId({});
    }
  }, []);

  const loadTemplateWorkout = useCallback(async () => {
    if (workoutId) {
      setIsLoadingTemplate(true);
      setTemplateError(null);
      setDraft(null);
      setPreviousSetsByExerciseId({});
      setQuickSetPopover(null);
      setQuickSetPopoverAnchorElement(null);
      draftWorkoutIdRef.current = undefined;

      try {
        const response = await workoutService.getById(workoutId);
        const result = response.data;
        if (!result.success || !result.data) {
          throw new Error(result.error ?? "Unable to load workout.");
        }

        const nextDraft = buildWorkoutDraftFromWorkout(result.data);
        draftWorkoutIdRef.current = nextDraft.workoutId;
        setDraft(nextDraft);
        await loadPreviousSetsForDraft(nextDraft);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load workout.";
        setDraft(null);
        setTemplateError(message);
      } finally {
        setIsLoadingTemplate(false);
      }

      return;
    }

    if (!templateId) {
      setPreviousSetsByExerciseId({});
      setTemplateError(null);
      setIsLoadingTemplate(false);
      draftWorkoutIdRef.current = undefined;
      setDraft(buildEmptyWorkoutDraft());
      return;
    }

    setIsLoadingTemplate(true);
    setTemplateError(null);
    setDraft(null);
    setPreviousSetsByExerciseId({});
    setQuickSetPopover(null);
    setQuickSetPopoverAnchorElement(null);
    draftWorkoutIdRef.current = undefined;

    try {
      const response = await workoutTemplateService.getByIdWithListFallback(templateId);
      const result = response.data;
      if (!result.success || !result.data) {
        throw new Error(result.error ?? "Unable to load template.");
      }

      const nextTemplate = result.data;
      const nextDraft = buildWorkoutDraftFromTemplate(nextTemplate);
      setDraft(nextDraft);

      await loadPreviousSetsForDraft(nextDraft);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load template.";
      setDraft(null);
      setTemplateError(message);
    } finally {
      setIsLoadingTemplate(false);
    }
  }, [loadPreviousSetsForDraft, templateId, workoutId]);

  const clearWorkoutSessionStorage = useCallback((workoutDraft: WorkoutDraft | null | undefined) => {
    const workoutTemplateId = workoutDraft?.workoutTemplateId ?? templateId;
    clearWorkoutSessionState(workoutTemplateId);
  }, [templateId]);

  const getPersistedWorkoutId = useCallback((candidate: WorkoutDraft | null | undefined): number | undefined => (
    candidate?.workoutId ?? draftWorkoutIdRef.current ?? workoutId ?? undefined
  ), [workoutId]);

  const canUpdateWorkout = useCallback((candidate: WorkoutDraft | null): boolean => (
    Boolean(candidate && getPersistedWorkoutId(candidate))
  ), [getPersistedWorkoutId]);

  const saveWorkoutToBackend = useCallback((draftOverride?: WorkoutDraft) => {
    if (isDeletingWorkoutRef.current) {
      return Promise.resolve();
    }

    if (isDraftSaveInFlightRef.current) {
      hasPendingDraftSaveRef.current = true;
      return draftSavePromiseRef.current ?? Promise.resolve();
    }

    let preferredDraft = draftOverride;
    const savePromise = (async () => {
      isDraftSaveInFlightRef.current = true;

      try {
        do {
          hasPendingDraftSaveRef.current = false;
          const currentDraft = preferredDraft ?? draftRef.current;
          preferredDraft = undefined;
          if (!currentDraft || isDeletingWorkoutRef.current) {
            return;
          }

          const savedWorkoutId = getPersistedWorkoutId(currentDraft);
          if (!savedWorkoutId) {
            return;
          }

          if (startWorkoutPromiseRef.current) {
            hasPendingDraftSaveRef.current = true;
            return;
          }

          try {
            const payload = buildWorkoutPayload({
              ...currentDraft,
              workoutId: savedWorkoutId,
            });
            const response = await workoutService.update(savedWorkoutId, payload);
            const savedWorkout = unwrap(response.data, "Unable to auto-save workout.");

            const updatedWorkoutId = savedWorkout.workoutId;
            draftWorkoutIdRef.current = updatedWorkoutId;
            hasShownDraftSaveErrorRef.current = false;
            if (currentDraft.startedAt) {
              saveWorkoutSessionState(
                currentDraft.workoutTemplateId,
                currentDraft.startedAt,
                updatedWorkoutId,
              );
            }
            setDraft((latestDraft) =>
              latestDraft && latestDraft.workoutId !== updatedWorkoutId
                ? { ...latestDraft, workoutId: updatedWorkoutId }
                : latestDraft,
            );
          } catch (error) {
            if (!hasShownDraftSaveErrorRef.current) {
              const message = error instanceof Error
                ? error.message
                : "Unable to auto-save workout.";
              toast.error(message);
              hasShownDraftSaveErrorRef.current = true;
            }
          }
        } while (hasPendingDraftSaveRef.current);
      } finally {
        isDraftSaveInFlightRef.current = false;
        draftSavePromiseRef.current = null;
      }
    })();

    draftSavePromiseRef.current = savePromise;
    return savePromise;
  }, [getPersistedWorkoutId]);

  const createWorkoutFromDraft = useCallback(async (
    draftOverride?: WorkoutDraft,
    startedAtOverride?: string,
    errorMessage = "Unable to create workout.",
    showSavingState = false,
  ) => {
    if (isDeletingWorkoutRef.current) {
      return null;
    }

    const currentDraft = draftOverride ?? draftRef.current ?? draft;
    if (!currentDraft) {
      return null;
    }

    const existingWorkoutId = getPersistedWorkoutId(currentDraft);
    if (existingWorkoutId) {
      const nextDraft = {
        ...currentDraft,
        workoutId: existingWorkoutId,
        startedAt: startedAtOverride ?? currentDraft.startedAt,
      };

      setDraft((latestDraft) =>
        latestDraft
          ? { ...latestDraft, workoutId: existingWorkoutId, startedAt: nextDraft.startedAt }
          : nextDraft,
      );

      await saveWorkoutToBackend(nextDraft);

      if (nextDraft.startedAt) {
        saveWorkoutSessionState(nextDraft.workoutTemplateId, nextDraft.startedAt, existingWorkoutId);
      }

      if (!workoutId) {
        navigate(`/workouts/${existingWorkoutId}`, { replace: true });
      }

      return existingWorkoutId;
    }

    if (startWorkoutPromiseRef.current) {
      hasPendingDraftSaveRef.current = true;
      const inFlightCreatePromise = startWorkoutPromiseRef.current;
      const createdWorkoutId = await inFlightCreatePromise;
      if (startWorkoutPromiseRef.current === inFlightCreatePromise) {
        startWorkoutPromiseRef.current = null;
      }
      if (createdWorkoutId && startedAtOverride) {
        const latestDraft = draftRef.current ?? currentDraft;
        const nextDraft = {
          ...latestDraft,
          workoutId: createdWorkoutId,
          startedAt: latestDraft.startedAt ?? startedAtOverride,
        };
        setDraft((current) => (current ? { ...current, workoutId: createdWorkoutId, startedAt: nextDraft.startedAt } : nextDraft));
        await saveWorkoutToBackend(nextDraft);
      }

      return createdWorkoutId;
    }

    const createPromise = (async () => {
      if (showSavingState) {
        setIsSavingWorkout(true);
      }

      try {
        if (draftSavePromiseRef.current) {
          try {
            await draftSavePromiseRef.current;
          } catch {
            // Creation below will surface any persistence error.
          }
        }

        const baseDraft = draftOverride ?? draftRef.current ?? currentDraft;
        const nextDraft = {
          ...baseDraft,
          startedAt: startedAtOverride ?? baseDraft.startedAt,
          workoutId: undefined,
        };

        const response = await workoutService.create(buildWorkoutPayload(nextDraft));
        const savedWorkout = unwrap(response.data, errorMessage);
        const savedWorkoutId = savedWorkout.workoutId;

        draftWorkoutIdRef.current = savedWorkoutId;
        hasShownDraftSaveErrorRef.current = false;

        if (nextDraft.startedAt) {
          saveWorkoutSessionState(nextDraft.workoutTemplateId, nextDraft.startedAt, savedWorkoutId);
        }

        setDraft((latestDraft) =>
          latestDraft
            ? { ...latestDraft, workoutId: savedWorkoutId, startedAt: nextDraft.startedAt ?? latestDraft.startedAt }
            : { ...nextDraft, workoutId: savedWorkoutId },
        );

        if (!workoutId) {
          navigate(`/workouts/${savedWorkoutId}`, { replace: true });
        }

        return savedWorkoutId;
      } catch (error) {
        const message = error instanceof Error ? error.message : errorMessage;
        toast.error(message);
        return null;
      } finally {
        if (showSavingState) {
          setIsSavingWorkout(false);
        }
      }
    })();

    startWorkoutPromiseRef.current = createPromise;
    const createdWorkoutId = await createPromise;
    startWorkoutPromiseRef.current = null;

    if (createdWorkoutId && hasPendingDraftSaveRef.current) {
      void saveWorkoutToBackend();
    }

    return createdWorkoutId;
  }, [draft, getPersistedWorkoutId, navigate, saveWorkoutToBackend, workoutId]);

  useEffect(() => {
    void loadTemplateWorkout();
  }, [loadTemplateWorkout]);

  useEffect(() => {
    draftRef.current = draft;

    if (!draft || isLoadingTemplate || templateError || isDeletingWorkout) {
      return;
    }

    if (!canUpdateWorkout(draft)) {
      return;
    }

    // Debounce so rapid edits (typing the title/notes) don't fire a request per keystroke.
    const timerId = window.setTimeout(() => {
      void saveWorkoutToBackend();
    }, WORKOUT_AUTOSAVE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [canUpdateWorkout, draft, isDeletingWorkout, isLoadingTemplate, saveWorkoutToBackend, templateError]);

  useEffect(() => {
    const startedAt = draft?.startedAt;
    if (!startedAt) {
      setElapsedSeconds(0);
      return;
    }

    const startedAtMs = new Date(startedAt).getTime();
    if (!Number.isFinite(startedAtMs)) {
      setElapsedSeconds(0);
      return;
    }

    const refreshElapsedSeconds = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)));
    };

    refreshElapsedSeconds();
    const intervalId = window.setInterval(refreshElapsedSeconds, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [draft?.startedAt]);

  const summary = useMemo(
    () => (draft ? calculateWorkoutSummary(draft) : null),
    [draft],
  );

  const groups = useMemo(
    () => (draft ? buildWorkoutExerciseGroups(draft) : []),
    [draft],
  );

  const activeQuickSetPopoverContext = useMemo<ActiveQuickSetPopoverContext | null>(() => {
    if (!draft || !quickSetPopover) {
      return null;
    }

    const activeExercise = draft.exercises.find((exercise) => exercise.id === quickSetPopover.exerciseId);
    if (!activeExercise) {
      return null;
    }

    const activeSet = activeExercise.sets.find((set) => set.id === quickSetPopover.setId);
    if (!activeSet) {
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

  const handleBackClick = useCallback(() => {
    clearWorkoutSessionStorage(draftRef.current ?? draft);

    navigate(templateId ? "/templates" : "/workouts");
  }, [clearWorkoutSessionStorage, draft, navigate, templateId]);

  const handleDeleteWorkoutRequest = useCallback(() => {
    const currentDraft = draftRef.current ?? draft;
    const workoutIdToDelete = currentDraft?.workoutId ?? draftWorkoutIdRef.current ?? workoutId;
    if (!workoutIdToDelete || isDeletingWorkoutRef.current) {
      return;
    }

    setIsDeleteConfirmationOpen(true);
  }, [draft, workoutId]);

  const handleCancelDeleteWorkout = useCallback(() => {
    if (isDeletingWorkoutRef.current) {
      return;
    }

    setIsDeleteConfirmationOpen(false);
  }, []);

  const handleConfirmDeleteWorkout = useCallback(async () => {
    const currentDraft = draftRef.current ?? draft;
    const workoutIdToDelete = currentDraft?.workoutId ?? draftWorkoutIdRef.current ?? workoutId;
    if (!workoutIdToDelete || isDeletingWorkoutRef.current) {
      return;
    }

    isDeletingWorkoutRef.current = true;
    setIsDeletingWorkout(true);

    try {
      if (draftSavePromiseRef.current) {
        await draftSavePromiseRef.current;
      }

      const latestDraft = draftRef.current ?? currentDraft;
      const latestWorkoutId = latestDraft?.workoutId ?? draftWorkoutIdRef.current ?? workoutIdToDelete;
      const response = await workoutService.remove(latestWorkoutId);
      unwrap(response.data, "Unable to delete workout.");

      clearWorkoutSessionStorage(latestDraft);
      setIsDeleteConfirmationOpen(false);
      toast.success("Workout deleted.");
      navigate("/workouts", { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete workout.";
      toast.error(message);
    } finally {
      isDeletingWorkoutRef.current = false;
      setIsDeletingWorkout(false);
    }
  }, [clearWorkoutSessionStorage, draft, navigate, workoutId]);

  const handleTitleChange = useCallback((value: string) => {
    setDraft((current) => {
      const nextDraft = current ? { ...current, title: value } : current;
      draftRef.current = nextDraft;
      return nextDraft;
    });
  }, []);

  const handleTitleCommit = useCallback(() => {
    const currentDraft = draftRef.current ?? draft;
    if (!currentDraft) {
      return;
    }

    if (getPersistedWorkoutId(currentDraft)) {
      void saveWorkoutToBackend(currentDraft);
      return;
    }

    void createWorkoutFromDraft(currentDraft);
  }, [createWorkoutFromDraft, draft, getPersistedWorkoutId, saveWorkoutToBackend]);

  const handleWorkoutNotesChange = useCallback((value: string) => {
    setDraft((current) => {
      const nextDraft = current ? { ...current, notes: value } : current;
      draftRef.current = nextDraft;
      return nextDraft;
    });
  }, []);

  const handleWorkoutNotesCommit = useCallback(() => {
    const currentDraft = draftRef.current ?? draft;
    if (!currentDraft) {
      return;
    }

    if (getPersistedWorkoutId(currentDraft)) {
      void saveWorkoutToBackend(currentDraft);
      return;
    }

    void createWorkoutFromDraft(currentDraft);
  }, [createWorkoutFromDraft, draft, getPersistedWorkoutId, saveWorkoutToBackend]);

  const handleExerciseNotesChange = useCallback((exerciseDraftId: string, value: string) => {
    setDraft((current) =>
      current
        ? updateDraftExercise(current, exerciseDraftId, (exercise) => ({
            ...exercise,
            notes: value,
          }))
        : current,
    );
  }, []);

  const handleExerciseMetricModeChange = useCallback((exerciseDraftId: string, metricMode: ExerciseMetricMode) => {
    setDraft((current) =>
      current
        ? updateDraftExercise(current, exerciseDraftId, (exercise) =>
            setWorkoutExerciseMetricMode(exercise, metricMode))
        : current,
    );

    const nextMetricField = metricMode === "duration" ? "durationSeconds" : "reps";
    setQuickSetPopover((current) => {
      if (!current || current.exerciseId !== exerciseDraftId) {
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

  const handleSetFieldChange = useCallback((
    exerciseDraftId: string,
    setDraftId: string,
    field: WorkoutSetMetricField,
    value: number,
  ) => {
    setDraft((current) =>
      current
        ? updateDraftExercise(current, exerciseDraftId, (exercise) => ({
            ...exercise,
            sets: exercise.sets.map((set) =>
              set.id === setDraftId
                ? {
                    ...set,
                    [field]: value,
                  }
                : set,
            ),
          }))
        : current,
    );
  }, []);

  const handleSetTypeChange = useCallback((
    exerciseDraftId: string,
    setDraftId: string,
    setType: ExerciseSetType,
  ) => {
    setDraft((current) =>
      current
        ? updateDraftExercise(current, exerciseDraftId, (exercise) => ({
            ...exercise,
            sets: exercise.sets.map((set) =>
              set.id === setDraftId ? { ...set, setType } : set,
            ),
          }))
        : current,
    );
  }, []);

  const handleSetCompletedToggle = useCallback((exerciseDraftId: string, setDraftId: string) => {
    const currentDraft = draftRef.current;
    const targetExercise = currentDraft?.exercises.find((exercise) => exercise.id === exerciseDraftId);
    const targetSet = targetExercise?.sets.find((set) => set.id === setDraftId);

    if (targetSet && !targetSet.isCompleted && !hasMainMetric(targetSet)) {
      toast.error("Add a weight, reps, or duration before completing this set.");
      return;
    }

    setDraft((current) =>
      current
        ? updateDraftExercise(current, exerciseDraftId, (exercise) => ({
            ...exercise,
            sets: exercise.sets.map((set) =>
              set.id === setDraftId ? { ...set, isCompleted: !set.isCompleted } : set,
            ),
          }))
        : current,
    );

    if (!currentDraft || !targetExercise || !targetSet || targetSet.isCompleted) {
      return;
    }

    const willCompleteExercise = targetExercise.sets.every(
      (set) => set.id === setDraftId || set.isCompleted,
    );
    if (!willCompleteExercise) {
      return;
    }

    const nextExercise = findNextIncompleteWorkoutExercise(currentDraft.exercises, targetExercise);

    setCollapsedExerciseIds((collapsed) => {
      const next = new Set(collapsed);
      next.add(exerciseDraftId);
      if (nextExercise) {
        next.delete(nextExercise.id);
      }

      return next;
    });

    setScrollToExerciseId(nextExercise ? nextExercise.id : null);
  }, []);

  const handleExerciseScrolled = useCallback(() => {
    setScrollToExerciseId(null);
  }, []);

  const handleAddSet = useCallback((exerciseDraftId: string) => {
    setDraft((current) =>
      current
        ? updateDraftExercise(current, exerciseDraftId, (exercise) => ({
            ...exercise,
            sets: [...exercise.sets, createWorkoutSetDraft(exercise)],
          }))
        : current,
    );
  }, []);

  const handleApplyPreviousSets = useCallback((exerciseDraftId: string) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      const exercise = current.exercises.find((item) => item.id === exerciseDraftId);
      const previousSets = exercise ? previousSetsByExerciseId[exercise.exerciseId] : undefined;
      if (!exercise || !previousSets || previousSets.sets.length === 0) {
        return current;
      }

      return updateDraftExercise(current, exerciseDraftId, (item) => ({
        ...item,
        sets: previousSets.sets.map((previousSet, index) =>
          createWorkoutSetDraftFromPreviousSet(previousSet, index),
        ),
      }));
    });
  }, [previousSetsByExerciseId]);

  const handleRemoveSet = useCallback((exerciseDraftId: string, setDraftId: string) => {
    const exercise = draft?.exercises.find((item) => item.id === exerciseDraftId);
    if (exercise && exercise.sets.length <= 1) {
      toast.error("Exercise needs at least one set.");
      return;
    }

    setDraft((current) =>
      current
        ? updateDraftExercise(current, exerciseDraftId, (item) => ({
            ...item,
            sets: normalizeSetOrderIndexes(item.sets.filter((set) => set.id !== setDraftId)),
          }))
        : current,
    );

    setQuickSetPopover((current) => {
      if (current?.exerciseId !== exerciseDraftId || current.setId !== setDraftId) {
        return current;
      }

      setQuickSetPopoverAnchorElement(null);
      return null;
    });
  }, [draft]);

  const handleAddExerciseModalOpen = useCallback(() => {
    setGroupAddContext(null);
    setIsAddExerciseModalOpen(true);
  }, []);

  const startWorkoutSession = useCallback(async (draftOverride?: WorkoutDraft) => {
    if (isDeletingWorkoutRef.current) {
      return null;
    }

    const currentDraft = draftOverride ?? draftRef.current ?? draft;
    if (!currentDraft) {
      return null;
    }

    const savedWorkoutId = getPersistedWorkoutId(currentDraft);
    if (currentDraft.startedAt && savedWorkoutId) {
      return savedWorkoutId;
    }

    const startedAt = currentDraft.startedAt ?? new Date().toISOString();
    const nextDraft = {
      ...currentDraft,
      startedAt,
      workoutId: savedWorkoutId,
    };

    if (startWorkoutPromiseRef.current) {
      setIsSavingWorkout(true);
      try {
        const inFlightCreatePromise = startWorkoutPromiseRef.current;
        const createdWorkoutId = await inFlightCreatePromise;
        if (startWorkoutPromiseRef.current === inFlightCreatePromise) {
          startWorkoutPromiseRef.current = null;
        }
        if (!createdWorkoutId) {
          return null;
        }

        const latestDraft = draftRef.current ?? currentDraft;
        const startedDraft = {
          ...latestDraft,
          workoutId: createdWorkoutId,
          startedAt: latestDraft.startedAt ?? startedAt,
        };
        setDraft((current) =>
          current
            ? { ...current, workoutId: createdWorkoutId, startedAt: startedDraft.startedAt }
            : startedDraft,
        );
        await saveWorkoutToBackend(startedDraft);
        return createdWorkoutId;
      } finally {
        setIsSavingWorkout(false);
      }
    }

    if (!savedWorkoutId) {
      return await createWorkoutFromDraft(nextDraft, startedAt, "Unable to start workout.", true);
    }

    const startPromise = (async () => {
      setIsSavingWorkout(true);
      try {
        if (draftSavePromiseRef.current) {
          try {
            await draftSavePromiseRef.current;
          } catch {
            // The update below will surface any persistence error.
          }
        }

        const response = await workoutService.update(savedWorkoutId, buildWorkoutPayload(nextDraft));
        const savedWorkout = unwrap(response.data, "Unable to start workout.");
        const updatedWorkoutId = savedWorkout.workoutId;
        draftWorkoutIdRef.current = updatedWorkoutId;
        hasShownDraftSaveErrorRef.current = false;
        saveWorkoutSessionState(nextDraft.workoutTemplateId, startedAt, updatedWorkoutId);
        setDraft((latestDraft) =>
          latestDraft
            ? { ...latestDraft, startedAt, workoutId: updatedWorkoutId }
            : { ...nextDraft, workoutId: updatedWorkoutId },
        );

        if (!workoutId) {
          navigate(`/workouts/${updatedWorkoutId}`, { replace: true });
        }

        return updatedWorkoutId;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to start workout.";
        toast.error(message);
        return null;
      } finally {
        setIsSavingWorkout(false);
      }
    })();

    startWorkoutPromiseRef.current = startPromise;
    const startedWorkoutId = await startPromise;
    startWorkoutPromiseRef.current = null;
    return startedWorkoutId;
  }, [createWorkoutFromDraft, draft, getPersistedWorkoutId, navigate, saveWorkoutToBackend, workoutId]);

  const handleAddExerciseModalClose = useCallback(() => {
    setIsAddExerciseModalOpen(false);
    setGroupAddContext(null);
  }, []);

  const handleAddExerciseToGroup = useCallback((
    insertAfterExerciseId: string,
    groupType: ExerciseGroupType,
    clientGroupId: number,
  ) => {
    setGroupAddContext({
      insertAfterExerciseId,
      groupType,
      clientGroupId,
    });
    setIsAddExerciseModalOpen(true);
  }, []);

  const handleAddExercise = useCallback((exercise: ExerciseLookupModel) => {
    let wasAdded = false;
    let nextGroupAddContext: GroupAddContext | null = null;
    let nextDraftToPersist: WorkoutDraft | null = null;

    setDraft((current) => {
      if (!current) {
        return current;
      }

      if (current.exercises.some((item) => item.exerciseId === exercise.id)) {
        toast.error("Exercise is already in this workout.");
        return current;
      }

      wasAdded = true;
      const nextExercise = createWorkoutExerciseDraftFromLookup(exercise, current.exercises.length + 1);
      let nextExercises: WorkoutExerciseDraft[];

      if (groupAddContext) {
        nextExercise.groupType = groupAddContext.groupType;
        nextExercise.clientGroupId = groupAddContext.clientGroupId;

        const anchorIndex = current.exercises.findIndex((item) => item.id === groupAddContext.insertAfterExerciseId);
        nextExercises = [...current.exercises];
        if (anchorIndex < 0) {
          nextExercises.push(nextExercise);
        } else {
          nextExercises.splice(anchorIndex + 1, 0, nextExercise);
        }
      } else {
        nextExercises = [...current.exercises, nextExercise];
      }

      const normalizedExercises = normalizeWorkoutExerciseOrderIndexes(nextExercises);

      if (groupAddContext) {
        nextGroupAddContext = {
          ...groupAddContext,
          insertAfterExerciseId: nextExercise.id,
        };
      }

      nextDraftToPersist = {
        ...current,
        exercises: normalizedExercises,
      };
      draftRef.current = nextDraftToPersist;

      return nextDraftToPersist;
    });

    if (wasAdded) {
      if (nextDraftToPersist) {
        void createWorkoutFromDraft(nextDraftToPersist);
      }

      void workoutService.getPreviousSets([exercise.id]).then((response) => {
        const result = response.data;
        if (!result.success || !result.data) {
          return;
        }

        const previousSets = result.data.items[0];
        if (!previousSets) {
          return;
        }

        setPreviousSetsByExerciseId((current) => ({
          ...current,
          [previousSets.exerciseId]: previousSets,
        }));
      });

      if (nextGroupAddContext) {
        setGroupAddContext(nextGroupAddContext);
      }
    }

    return wasAdded;
  }, [createWorkoutFromDraft, groupAddContext]);

  const handleExerciseGroupingChange = useCallback((exerciseDraftId: string, groupType: ExerciseGroupType) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      const targetExercise = current.exercises.find((exercise) => exercise.id === exerciseDraftId);
      if (!targetExercise) {
        return current;
      }

      if (groupType === ExerciseGroupType.Straight) {
        const targetClientGroupId = targetExercise.clientGroupId;
        return {
          ...current,
          exercises: normalizeWorkoutExerciseOrderIndexes(current.exercises.map((exercise) =>
            targetClientGroupId !== undefined && exercise.clientGroupId === targetClientGroupId
              ? {
                  ...exercise,
                  groupType: ExerciseGroupType.Straight,
                  clientGroupId: undefined,
                }
              : exercise)),
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

      const nextClientGroupId = getNextWorkoutClientGroupId(current.exercises);
      return {
        ...current,
        exercises: current.exercises.map((exercise) =>
          exercise.id === exerciseDraftId
            ? {
                ...exercise,
                groupType,
                clientGroupId: nextClientGroupId,
              }
            : exercise),
      };
    });
  }, []);

  const handleRemoveExercise = useCallback((exerciseDraftId: string) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      const nextExercises = current.exercises.filter((exercise) => exercise.id !== exerciseDraftId);
      if (nextExercises.length === current.exercises.length) {
        return current;
      }

      return {
        ...current,
        exercises: normalizeWorkoutExerciseOrderIndexes(nextExercises),
      };
    });

    setQuickSetPopover((current) => {
      if (current?.exerciseId !== exerciseDraftId) {
        return current;
      }

      setQuickSetPopoverAnchorElement(null);
      return null;
    });
  }, []);

  const handleSetReorder = useCallback((
    exerciseDraftId: string,
    activeSetId: string,
    overSetId: string,
  ) => {
    setDraft((current) =>
      current
        ? updateDraftExercise(current, exerciseDraftId, (exercise) => ({
            ...exercise,
            sets: reorderWorkoutSetsForDrag(exercise.sets, activeSetId, overSetId),
          }))
        : current,
    );
  }, []);

  const handleExerciseReorder = useCallback((activeExerciseId: string, overExerciseId: string) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            exercises: reorderWorkoutExercisesForDrag(current.exercises, activeExerciseId, overExerciseId),
          }
        : current,
    );
  }, []);

  const handleToggleExerciseCollapse = useCallback((exerciseDraftId: string) => {
    setCollapsedExerciseIds((current) => {
      const next = new Set(current);
      if (next.has(exerciseDraftId)) {
        next.delete(exerciseDraftId);
      } else {
        next.add(exerciseDraftId);
      }

      return next;
    });
  }, []);

  const handleSetGroupCollapse = useCallback((exerciseDraftIds: string[], collapsed: boolean) => {
    setCollapsedExerciseIds((current) => {
      const next = new Set(current);
      exerciseDraftIds.forEach((exerciseDraftId) => {
        if (collapsed) {
          next.add(exerciseDraftId);
        } else {
          next.delete(exerciseDraftId);
        }
      });

      return next;
    });
  }, []);

  const handleQuickSetPopoverOpen = useCallback((
    exerciseDraftId: string,
    setDraftId: string,
    field: WorkoutSetMetricField,
    anchorElement: HTMLElement,
  ) => {
    setQuickSetPopoverAnchorElement(anchorElement);
    setQuickSetPopover({
      exerciseId: exerciseDraftId,
      setId: setDraftId,
      field,
    });
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

    setDraft((current) =>
      current
        ? updateDraftExercise(current, activeQuickSetPopoverContext.exerciseId, (exercise) => ({
            ...exercise,
            sets: exercise.sets.map((set) => ({
              ...set,
              [activeQuickSetPopoverContext.field]: value,
            })),
          }))
        : current,
    );
  }, [activeQuickSetPopoverContext]);

  const handleStartWorkout = useCallback(async () => {
    if (isSavingWorkout || isDeletingWorkout) {
      return;
    }

    await startWorkoutSession();
  }, [isDeletingWorkout, isSavingWorkout, startWorkoutSession]);

  const handleFinishWorkout = useCallback(async () => {
    if (!draft || isSavingWorkout || isDeletingWorkout) {
      return;
    }

    const validationError = validateWorkoutDraft(draft);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsSavingWorkout(true);

    try {
      let latestDraft = draftRef.current ?? draft;
      let workoutIdToFinish = getPersistedWorkoutId(latestDraft);
      if (!workoutIdToFinish) {
        workoutIdToFinish = await createWorkoutFromDraft(
          latestDraft,
          latestDraft.startedAt ?? new Date().toISOString(),
          "Unable to save workout.",
        ) ?? undefined;
      }

      if (!workoutIdToFinish) {
        throw new Error("Unable to save workout.");
      }

      await saveWorkoutToBackend({
        ...latestDraft,
        workoutId: workoutIdToFinish,
      });

      latestDraft = draftRef.current ?? latestDraft;
      const payload = buildWorkoutPayload({
        ...latestDraft,
        workoutId: workoutIdToFinish,
      }, new Date());
      const response = await workoutService.finish(workoutIdToFinish, payload);
      const savedWorkout = unwrap(response.data, "Unable to save workout.");

      toast.success(
        `Workout saved: ${savedWorkout.exerciseCount} exercises, ${savedWorkout.setCount} sets.`,
      );
      clearWorkoutSessionState(latestDraft.workoutTemplateId);
      navigate("/workouts", { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save workout.";
      toast.error(message);
    } finally {
      setIsSavingWorkout(false);
    }
  }, [
    createWorkoutFromDraft,
    draft,
    getPersistedWorkoutId,
    isDeletingWorkout,
    isSavingWorkout,
    navigate,
    saveWorkoutToBackend,
  ]);

  const state = useMemo(
    () => ({
      draft,
      groups,
      summary,
      elapsedSeconds,
      isWorkoutStarted: Boolean(draft?.startedAt),
      previousSetsByExerciseId,
      isLoadingTemplate,
      templateError,
      isSavingWorkout,
      isDeletingWorkout,
      canDeleteWorkout: Boolean(draft?.workoutId ?? draftWorkoutIdRef.current ?? workoutId),
      deleteConfirmationWorkoutTitle: getWorkoutTitle(draft),
      isDeleteConfirmationOpen,
      activeQuickSetPopoverContext,
      quickSetPopoverAnchorElement,
      isAddExerciseModalOpen,
      collapsedExerciseIds,
      scrollToExerciseId,
    }),
    [
      draft,
      groups,
      summary,
      elapsedSeconds,
      previousSetsByExerciseId,
      isLoadingTemplate,
      templateError,
      isSavingWorkout,
      isDeletingWorkout,
      workoutId,
      isDeleteConfirmationOpen,
      activeQuickSetPopoverContext,
      quickSetPopoverAnchorElement,
      isAddExerciseModalOpen,
      collapsedExerciseIds,
      scrollToExerciseId,
    ],
  );

  const actions = useMemo(
    () => ({
      handleBackClick,
      handleCancelDeleteWorkout,
      handleConfirmDeleteWorkout,
      handleDeleteWorkoutRequest,
      handleRetryLoad: loadTemplateWorkout,
      handleAddExerciseModalOpen,
      handleAddExerciseModalClose,
      handleAddExercise,
      handleAddExerciseToGroup,
      handleRemoveExercise,
      handleExerciseGroupingChange,
      handleTitleChange,
      handleTitleCommit,
      handleWorkoutNotesChange,
      handleWorkoutNotesCommit,
      handleExerciseNotesChange,
      handleExerciseMetricModeChange,
      handleSetTypeChange,
      handleSetCompletedToggle,
      handleAddSet,
      handleApplyPreviousSets,
      handleRemoveSet,
      handleSetReorder,
      handleExerciseReorder,
      handleToggleExerciseCollapse,
      handleSetGroupCollapse,
      handleExerciseScrolled,
      handleQuickSetPopoverOpen,
      handleQuickSetPopoverClose,
      handleQuickSetValueChange,
      handleQuickSetApplyToAll,
      handleStartWorkout,
      handleFinishWorkout,
    }),
    [
      handleBackClick,
      handleCancelDeleteWorkout,
      handleConfirmDeleteWorkout,
      handleDeleteWorkoutRequest,
      loadTemplateWorkout,
      handleAddExerciseModalOpen,
      handleAddExerciseModalClose,
      handleAddExercise,
      handleAddExerciseToGroup,
      handleRemoveExercise,
      handleExerciseGroupingChange,
      handleTitleChange,
      handleTitleCommit,
      handleWorkoutNotesChange,
      handleWorkoutNotesCommit,
      handleExerciseNotesChange,
      handleExerciseMetricModeChange,
      handleSetTypeChange,
      handleSetCompletedToggle,
      handleAddSet,
      handleApplyPreviousSets,
      handleRemoveSet,
      handleSetReorder,
      handleExerciseReorder,
      handleToggleExerciseCollapse,
      handleSetGroupCollapse,
      handleExerciseScrolled,
      handleQuickSetPopoverOpen,
      handleQuickSetPopoverClose,
      handleQuickSetValueChange,
      handleQuickSetApplyToAll,
      handleStartWorkout,
      handleFinishWorkout,
    ],
  );

  return { state, actions };
}
