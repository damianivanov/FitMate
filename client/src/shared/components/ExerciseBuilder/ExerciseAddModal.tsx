import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ChangeEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  UIEvent as ReactUIEvent,
} from "react";
import { LuCheck, LuLoader, LuPlus, LuSearch, LuX } from "react-icons/lu";
import { invalidateExerciseLookupCache, useExerciseLookup } from "@/hooks/useExerciseLookup";
import { useMuscleGroups } from "@/hooks/useMuscleGroups";
import { unwrap } from "@/lib/unwrap";
import { exerciseService } from "@/services/exerciseService";
import { Modal } from "@/shared/components/Modal";
import { Dropdown } from "@/shared/components/Inputs";
import { AddExerciseModal } from "@/shared/components/AddExerciseModal";
import {
  emptyExerciseFormValues,
  type ExerciseFormValues,
} from "@/shared/components/exerciseFormValues";
import type { CreateExerciseRequest, ExerciseLookupModel } from "@/types";

const MODAL_EXIT_DURATION_MS = 220;
const LIBRARY_LOOKUP_DEBOUNCE_MS = 140;
const ADD_HIGHLIGHT_DURATION_MS = 420;
const DEFAULT_LIBRARY_LOOKUP_TAKE = 48;

export type ExerciseAddFeedback = {
  text: string;
  tone: "success" | "error";
};

type ExerciseAddModalProps = {
  isOpen: boolean;
  selectedExerciseIds: readonly number[];
  onAddExercise: (exercise: ExerciseLookupModel) => boolean;
  onClose: () => void;
  onRemoveExercise?: (exercise: ExerciseLookupModel) => boolean;
  feedback?: ExerciseAddFeedback | null;
};

export function ExerciseAddModal({
  isOpen,
  selectedExerciseIds,
  onAddExercise,
  onClose,
  onRemoveExercise,
  feedback,
}: ExerciseAddModalProps) {
  const [librarySearchTerm, setLibrarySearchTerm] = useState("");
  const [selectedMuscleGroupIds, setSelectedMuscleGroupIds] = useState<number[]>([]);
  const [libraryLookupSkip, setLibraryLookupSkip] = useState(0);
  const [libraryExercises, setLibraryExercises] = useState<ExerciseLookupModel[]>([]);
  const [isAddAnimatingByExerciseId, setIsAddAnimatingByExerciseId] = useState<Record<number, boolean>>({});
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreatingExercise, setIsCreatingExercise] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const lastLoadTriggerHeightRef = useRef<number | null>(null);
  const closeResetTimeoutRef = useRef<number | null>(null);
  const addHighlightTimeoutsRef = useRef<Map<number, number>>(new Map());

  const { muscleGroups, error: muscleGroupsError } = useMuscleGroups({ enabled: isOpen });
  const isFeedbackEnabled = feedback !== undefined;

  const muscleGroupOptions = useMemo(
    () => muscleGroups.map((group) => ({
      value: group.id,
      label: group.name,
      imageUrl: group.imageUrl ?? undefined,
    })),
    [muscleGroups],
  );

  const selectedExerciseIdSet = useMemo(
    () => new Set(selectedExerciseIds),
    [selectedExerciseIds],
  );

  const handleLibraryLookupSuccess = useCallback((page: ExerciseLookupModel[]) => {
    if (libraryLookupSkip === 0) {
      setLibraryExercises(page);
      return;
    }

    if (!page.length) {
      return;
    }

    setLibraryExercises((previous) => {
      if (!previous.length) {
        return page;
      }

      const existingIds = new Set(previous.map((exercise) => exercise.id));
      const nextExercises = [...previous];

      for (const exercise of page) {
        if (existingIds.has(exercise.id)) {
          continue;
        }

        existingIds.add(exercise.id);
        nextExercises.push(exercise);
      }

      return nextExercises;
    });
  }, [libraryLookupSkip]);

  const {
    options: libraryExercisePage,
    isLoading: isLoadingLibraryExercises,
    error: libraryLookupError,
    isDebouncing: isDebouncingLibrarySearch,
    reload: reloadLibraryExercises,
  } = useExerciseLookup({
    enabled: isOpen,
    includeWhenSearchEmpty: true,
    search: librarySearchTerm,
    muscleGroupIds: selectedMuscleGroupIds,
    skip: libraryLookupSkip,
    take: DEFAULT_LIBRARY_LOOKUP_TAKE,
    debounceMs: LIBRARY_LOOKUP_DEBOUNCE_MS,
    onSuccess: handleLibraryLookupSuccess,
  });

  const hasMoreLibraryExercises = libraryExercisePage.length === DEFAULT_LIBRARY_LOOKUP_TAKE;
  const isWaitingForLibraryResults = isLoadingLibraryExercises || isDebouncingLibrarySearch;

  const resetModalState = useCallback(() => {
    setLibrarySearchTerm("");
    setSelectedMuscleGroupIds([]);
    setLibraryLookupSkip(0);
    setLibraryExercises([]);
    setIsAddAnimatingByExerciseId({});
    lastLoadTriggerHeightRef.current = null;
  }, []);

  const clearAddHighlight = useCallback((exerciseId?: number) => {
    if (exerciseId !== undefined) {
      const timeoutId = addHighlightTimeoutsRef.current.get(exerciseId);
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
        addHighlightTimeoutsRef.current.delete(exerciseId);
      }

      setIsAddAnimatingByExerciseId((previous) => {
        if (!previous[exerciseId]) {
          return previous;
        }

        const next = { ...previous };
        delete next[exerciseId];
        return next;
      });
      return;
    }

    for (const timeoutId of addHighlightTimeoutsRef.current.values()) {
      window.clearTimeout(timeoutId);
    }
    addHighlightTimeoutsRef.current.clear();
    setIsAddAnimatingByExerciseId({});
  }, []);

  const startAddHighlight = useCallback((exerciseId: number) => {
    clearAddHighlight(exerciseId);
    setIsAddAnimatingByExerciseId((previous) => ({
      ...previous,
      [exerciseId]: true,
    }));

    const timeoutId = window.setTimeout(() => {
      setIsAddAnimatingByExerciseId((previous) => {
        if (!previous[exerciseId]) {
          return previous;
        }

        const next = { ...previous };
        delete next[exerciseId];
        return next;
      });
      addHighlightTimeoutsRef.current.delete(exerciseId);
    }, ADD_HIGHLIGHT_DURATION_MS);

    addHighlightTimeoutsRef.current.set(exerciseId, timeoutId);
  }, [clearAddHighlight]);

  const clearCloseResetTimeout = useCallback(() => {
    if (closeResetTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(closeResetTimeoutRef.current);
    closeResetTimeoutRef.current = null;
  }, []);

  useEffect(() => {
    if (isOpen) {
      clearCloseResetTimeout();
    }

    return () => {
      clearCloseResetTimeout();
      clearAddHighlight();
    };
  }, [clearAddHighlight, clearCloseResetTimeout, isOpen]);

  useEffect(() => {
    lastLoadTriggerHeightRef.current = null;
  }, [isOpen, librarySearchTerm, selectedMuscleGroupIds]);

  const handleLibrarySearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setLibraryLookupSkip(0);
    setLibraryExercises([]);
    setLibrarySearchTerm(event.target.value);
  };

  const handleMuscleFilterSelectionChange = (nextSelectedMuscleGroupIds: number[]) => {
    setLibraryLookupSkip(0);
    setLibraryExercises([]);
    setSelectedMuscleGroupIds(nextSelectedMuscleGroupIds);
  };

  const handleLoadMoreLibraryExercises = () => {
    if (isWaitingForLibraryResults || !hasMoreLibraryExercises) {
      return;
    }

    setLibraryLookupSkip((previous) => previous + DEFAULT_LIBRARY_LOOKUP_TAKE);
  };

  const handleExerciseItemSelect = (exercise: ExerciseLookupModel) => {
    if (selectedExerciseIdSet.has(exercise.id)) {
      return;
    }

    const wasAdded = onAddExercise(exercise);
    if (wasAdded) {
      startAddHighlight(exercise.id);
    }
  };

  const handleExerciseItemKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
    exercise: ExerciseLookupModel,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleExerciseItemSelect(exercise);
    }
  };

  const handleRemoveButtonClick = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>, exercise: ExerciseLookupModel) => {
      event.preventDefault();
      event.stopPropagation();
      if (!onRemoveExercise) {
        return;
      }

      clearAddHighlight(exercise.id);
      onRemoveExercise(exercise);
    },
    [clearAddHighlight, onRemoveExercise],
  );

  const handleExerciseListScroll = (event: ReactUIEvent<HTMLDivElement>) => {
    if (isWaitingForLibraryResults || !hasMoreLibraryExercises) {
      return;
    }

    const containerElement = event.currentTarget;
    const loadMoreThresholdPx = 120;
    const isNearBottom =
      containerElement.scrollTop + containerElement.clientHeight >= containerElement.scrollHeight - loadMoreThresholdPx;

    if (!isNearBottom) {
      return;
    }

    if (lastLoadTriggerHeightRef.current === containerElement.scrollHeight) {
      return;
    }

    lastLoadTriggerHeightRef.current = containerElement.scrollHeight;
    handleLoadMoreLibraryExercises();
  };

  const handleModalClose = () => {
    onClose();
    clearCloseResetTimeout();
    closeResetTimeoutRef.current = window.setTimeout(() => {
      resetModalState();
      closeResetTimeoutRef.current = null;
    }, MODAL_EXIT_DURATION_MS);
  };

  const openCreateExercise = useCallback(() => {
    setCreateError(null);
    setIsCreateOpen(true);
  }, []);

  const closeCreateExercise = useCallback(() => {
    if (isCreatingExercise) {
      return;
    }

    setIsCreateOpen(false);
    setCreateError(null);
  }, [isCreatingExercise]);

  const handleCreateExercise = useCallback(
    async (values: ExerciseFormValues, file?: File) => {
      const payload: CreateExerciseRequest = {
        name: values.name.trim(),
        slug: values.slug.trim(),
        description: values.description.trim() || undefined,
        primaryMuscleGroupId: Number(values.primaryMuscleGroupId),
        secondaryMuscleGroupId: values.secondaryMuscleGroupId
          ? Number(values.secondaryMuscleGroupId)
          : undefined,
        isPublic: values.isPublic,
      };

      if (!payload.name || !payload.primaryMuscleGroupId) {
        setCreateError("Name and primary muscle group are required.");
        return;
      }

      setIsCreatingExercise(true);
      setCreateError(null);

      try {
        const response = await exerciseService.create(payload, file);
        unwrap(response.data, "Unable to create exercise.");

        invalidateExerciseLookupCache();
        setIsCreateOpen(false);
        setLibraryLookupSkip(0);
        setLibraryExercises([]);
        lastLoadTriggerHeightRef.current = null;
        void reloadLibraryExercises();
      } catch (error) {
        setCreateError(error instanceof Error ? error.message : "Unable to create exercise.");
      } finally {
        setIsCreatingExercise(false);
      }
    },
    [reloadLibraryExercises],
  );

  return (
    <>
    <Modal isOpen={isOpen} onClose={handleModalClose} title="Add Exercise" maxWidth="2xl">
      <div className="flex max-h-[80vh] min-h-104 cursor-default flex-col md:min-h-120">
        <div className="relative z-50 px-5 pb-3 pt-4">
          <div className="flex flex-col gap-2">
            <div className="liquid-input flex w-full items-center gap-2 rounded-full px-4 py-3">
              <LuSearch className="h-4 w-4 shrink-0 text-primary" />
              <input
                value={librarySearchTerm}
                onChange={handleLibrarySearchChange}
                placeholder="Search exercises..."
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>

            <div className="flex gap-2">
              <div className="flex-[3]">
                <Dropdown<number>
                  id="exercise-builder-muscle-filter"
                  multiple
                  value={selectedMuscleGroupIds}
                  onChange={handleMuscleFilterSelectionChange}
                  options={muscleGroupOptions}
                  placeholder="Muscles"
                  searchable
                  searchPlaceholder="Search muscle groups..."
                  clearable
                  selectedCheckIconClassName="text-emerald-300"
                  optionsContainerClassName="space-y-1"
                  emptyText="No muscle groups found."
                  disabled={!isOpen}
                  error={muscleGroupsError ?? undefined}
                  hideScrollbar={false}
                  containerClassName="space-y-0"
                />
              </div>

              <button
                type="button"
                onClick={openCreateExercise}
                className="liquid-pill inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-primary"
              >
                <LuPlus className="h-4 w-4" />
                <span className="whitespace-nowrap">New exercise</span>
              </button>
            </div>
          </div>
          {isFeedbackEnabled ? (
            <div className="mt-2 min-h-6 px-3">
              {feedback ? (
                <p
                  className={[
                    "text-center text-xs font-medium",
                    feedback.tone === "error" ? "text-danger" : "text-success",
                  ].join(" ")}
                  aria-live="polite"
                >
                  {feedback.text}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div
          className="liquid-scrollbar relative z-0 flex-1 overflow-y-auto px-5 pb-5"
          onScroll={handleExerciseListScroll}
        >
          {isWaitingForLibraryResults ? (
            <div className="mb-3 flex items-center justify-center px-4 py-4 text-center text-xs text-secondary">
              <LuLoader className="h-4 w-4 animate-spin" aria-label="Loading exercises" />
            </div>
          ) : null}

          {libraryLookupError && !isWaitingForLibraryResults ? (
            <div className="liquid-template-dashed mb-3 rounded-2xl px-4 py-4 text-center text-xs text-danger">
              {libraryLookupError}
            </div>
          ) : null}

          <div className="divide-y space-y-2">
            {libraryExercises.map((exercise) => {
              const isAlreadyAdded = selectedExerciseIdSet.has(exercise.id);
              const isAddAnimating = Boolean(isAddAnimatingByExerciseId[exercise.id]);
              const exerciseItemClassName = [
                "flex items-center gap-3 rounded-3xl px-2 py-3 transition-all duration-300 ease-out",
                isAlreadyAdded
                  ? "cursor-default bg-emerald-300/22 shadow-[inset_0_0_0_1px_rgba(110,231,183,0.55)]"
                  : "cursor-pointer hover:bg-white/4",
                isAddAnimating
                  ? "bg-emerald-400/18 shadow-[inset_0_0_0_1px_rgba(110,231,183,0.78),0_10px_24px_rgba(16,185,129,0.24)] -translate-y-0.5"
                  : "",
              ].join(" ");

              const handleExerciseClick = () => {
                handleExerciseItemSelect(exercise);
              };

              const handleExerciseKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
                handleExerciseItemKeyDown(event, exercise);
              };

              const handleRemoveClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
                handleRemoveButtonClick(event, exercise);
              };

              return (
                <div
                  key={exercise.id}
                  role="button"
                  tabIndex={0}
                  onClick={handleExerciseClick}
                  onKeyDown={handleExerciseKeyDown}
                  className={exerciseItemClassName}
                >
                  {exercise.imageUrl ? (
                    <img
                      src={exercise.imageUrl}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-xl object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-200 text-sm font-bold text-primary">
                      {exercise.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{exercise.name}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span
                      className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                      style={{ backgroundColor: "rgba(255, 115, 55, 0.12)", color: "#FF7337" }}
                    >
                      {exercise.primaryMuscleGroupName}
                    </span>
                    {exercise.secondaryMuscleGroupName ? (
                      <span
                        className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={{ backgroundColor: "rgba(125, 211, 252, 0.12)", color: "#7DD3FC" }}
                      >
                        {exercise.secondaryMuscleGroupName}
                      </span>
                    ) : null}
                  </div>
                  {isAlreadyAdded ? (
                    onRemoveExercise ? (
                      <button
                        type="button"
                        onClick={handleRemoveClick}
                        aria-label={`Remove ${exercise.name}`}
                        className="group relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-emerald-300 transition-colors hover:bg-(--color-danger-soft)"
                      >
                        <LuCheck className="h-5 w-5 transition-all duration-200 group-hover:scale-75 group-hover:opacity-0" />
                        <LuX className="absolute h-5 w-5 text-danger opacity-0 transition-all duration-200 group-hover:opacity-100" />
                      </button>
                    ) : (
                      <LuCheck className="h-5 w-5 shrink-0 text-emerald-300" />
                    )
                  ) : (
                    <LuPlus
                      className={[
                        "h-4 w-4 shrink-0 text-emerald-300 transition-transform duration-200",
                        isAddAnimating ? "scale-110" : "",
                      ].join(" ")}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {!libraryExercises.length && !isWaitingForLibraryResults ? (
            <div className="mt-4 rounded-2xl px-4 py-6 text-center">
              <p className="text-sm font-semibold text-red-400">No exercises found</p>
              <button
                type="button"
                onClick={openCreateExercise}
                className="liquid-pill mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-primary"
              >
                <LuPlus className="h-4 w-4" />
                <span>Create a new exercise</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </Modal>

    <AddExerciseModal
      key={isCreateOpen ? "create-open" : "create-closed"}
      isOpen={isCreateOpen}
      isSaving={isCreatingExercise}
      mode="create"
      maxWidth="lg"
      showVisibilityToggle
      values={emptyExerciseFormValues}
      muscleGroups={muscleGroups}
      error={createError}
      onClose={closeCreateExercise}
      onSubmit={handleCreateExercise}
    />
    </>
  );
}
