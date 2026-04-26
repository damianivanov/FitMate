import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ChangeEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  UIEvent as ReactUIEvent,
} from "react";
import { LuCheck, LuLoader, LuPlus, LuSearch, LuX } from "react-icons/lu";
import { useExerciseLookup } from "@/hooks/useExerciseLookup";
import { useMuscleGroups } from "@/hooks/useMuscleGroups";
import { Dropdown, Modal } from "@/shared/components";
import type { ExerciseLookupModel } from "@/types";
import { useTemplateBuilderStore } from "../store/templateBuilderStore";

const MODAL_EXIT_DURATION_MS = 220;
const LIBRARY_LOOKUP_DEBOUNCE_MS = 140;
const ADD_HIGHLIGHT_DURATION_MS = 420;
const DEFAULT_LIBRARY_LOOKUP_TAKE = 48;

function getSingleSelectedMuscleGroupId(ids: number[]): number | undefined {
  return ids.length === 1 ? ids[0] : undefined;
}

export function AddExerciseModal() {
  const isOpen = useTemplateBuilderStore((state) => state.isAddExerciseModalOpen);
  const exercises = useTemplateBuilderStore((state) => state.exercises);
  const feedback = useTemplateBuilderStore((state) => state.addExerciseFeedback);
  const closeAddExerciseModal = useTemplateBuilderStore((state) => state.closeAddExerciseModal);
  const addLibraryExercise = useTemplateBuilderStore((state) => state.addLibraryExercise);
  const removeLibraryExercise = useTemplateBuilderStore((state) => state.removeLibraryExercise);

  const [librarySearchTerm, setLibrarySearchTerm] = useState("");
  const [selectedMuscleGroupIds, setSelectedMuscleGroupIds] = useState<number[]>([]);
  const [libraryLookupSkip, setLibraryLookupSkip] = useState(0);
  const [libraryExercises, setLibraryExercises] = useState<ExerciseLookupModel[]>([]);
  const [isAddAnimatingByExerciseId, setIsAddAnimatingByExerciseId] = useState<Record<number, boolean>>({});
  const lastLoadTriggerHeightRef = useRef<number | null>(null);
  const closeResetTimeoutRef = useRef<number | null>(null);
  const addHighlightTimeoutsRef = useRef<Map<number, number>>(new Map());

  const { muscleGroups, error: muscleGroupsError } = useMuscleGroups({ enabled: isOpen });

  const selectedExerciseIds = useMemo(
    () => exercises.map((exercise) => exercise.exerciseId),
    [exercises],
  );

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

  const singleMuscleGroupId = selectedMuscleGroupIds.length === 1 ? selectedMuscleGroupIds[0] : undefined;
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
  } = useExerciseLookup({
    enabled: isOpen,
    includeWhenSearchEmpty: true,
    search: librarySearchTerm,
    muscleGroupId: singleMuscleGroupId,
    skip: libraryLookupSkip,
    take: DEFAULT_LIBRARY_LOOKUP_TAKE,
    debounceMs: LIBRARY_LOOKUP_DEBOUNCE_MS,
    onSuccess: handleLibraryLookupSuccess,
  });

  const hasMoreLibraryExercises = libraryExercisePage.length === DEFAULT_LIBRARY_LOOKUP_TAKE;
  const isWaitingForLibraryResults = isLoadingLibraryExercises || isDebouncingLibrarySearch;

  const filteredLibraryExercises = useMemo(() => {
    if (selectedMuscleGroupIds.length <= 1) {
      return libraryExercises;
    }

    const selectedIds = new Set(selectedMuscleGroupIds);
    return libraryExercises.filter((exercise) => selectedIds.has(exercise.primaryMuscleGroupId));
  }, [libraryExercises, selectedMuscleGroupIds]);

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
    const previousLookupMuscleGroupId = getSingleSelectedMuscleGroupId(selectedMuscleGroupIds);
    const nextLookupMuscleGroupId = getSingleSelectedMuscleGroupId(nextSelectedMuscleGroupIds);
    const lookupFilterChanged = previousLookupMuscleGroupId !== nextLookupMuscleGroupId;

    if (libraryLookupSkip > 0 || lookupFilterChanged) {
      setLibraryLookupSkip(0);
    }

    if (lookupFilterChanged) {
      setLibraryExercises([]);
    }

    setSelectedMuscleGroupIds(nextSelectedMuscleGroupIds);
  };

  const handleLoadMoreLibraryExercises = () => {
    if (isWaitingForLibraryResults || !hasMoreLibraryExercises) {
      return;
    }

    setLibraryLookupSkip((previous) => previous + DEFAULT_LIBRARY_LOOKUP_TAKE);
  };

  const handleExerciseItemClick = (exercise: ExerciseLookupModel) => {
    if (selectedExerciseIdSet.has(exercise.id)) {
      return;
    }

    const wasAdded = addLibraryExercise(exercise);
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
      if (selectedExerciseIdSet.has(exercise.id)) {
        return;
      }

      const wasAdded = addLibraryExercise(exercise);
      if (wasAdded) {
        startAddHighlight(exercise.id);
      }
    }
  };

  const handleRemoveButtonClick = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>, exercise: ExerciseLookupModel) => {
      event.preventDefault();
      event.stopPropagation();
      clearAddHighlight(exercise.id);
      removeLibraryExercise(exercise);
    },
    [clearAddHighlight, removeLibraryExercise],
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
    closeAddExerciseModal();
    clearCloseResetTimeout();
    closeResetTimeoutRef.current = window.setTimeout(() => {
      resetModalState();
      closeResetTimeoutRef.current = null;
    }, MODAL_EXIT_DURATION_MS);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleModalClose} title="Add Exercise" maxWidth="2xl">
      <div className="flex max-h-[80vh] min-h-104 cursor-default flex-col md:min-h-120">
        <div className="relative z-50 px-5 pb-3 pt-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="liquid-input flex w-full flex-1 items-center gap-2 rounded-full px-4 py-3">
              <LuSearch className="h-4 w-4 shrink-0 text-primary" />
              <input
                value={librarySearchTerm}
                onChange={handleLibrarySearchChange}
                placeholder="Search exercises..."
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>

            <div className="w-full sm:w-64 sm:shrink-0">
              <Dropdown<number>
                id="add-exercise-muscle-filter"
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
          </div>
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
            {filteredLibraryExercises.map((exercise) => {
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
                handleExerciseItemClick(exercise);
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
                  <span
                    className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: "rgba(255, 115, 55, 0.12)", color: "#FF7337" }}
                  >
                    {exercise.primaryMuscleGroupName}
                  </span>
                  {isAlreadyAdded ? (
                    <button
                      type="button"
                      onClick={handleRemoveClick}
                      aria-label={`Remove ${exercise.name} from template`}
                      className="group relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-emerald-300 transition-colors hover:bg-(--color-danger-soft)"
                    >
                      <LuCheck className="h-5 w-5 transition-all duration-200 group-hover:scale-75 group-hover:opacity-0" />
                      <LuX className="absolute h-5 w-5 text-danger opacity-0 transition-all duration-200 group-hover:opacity-100" />
                    </button>
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

          {!filteredLibraryExercises.length && !isWaitingForLibraryResults ? (
            <div className="mt-4 rounded-2xl px-4 py-6 text-center">
              <p className="text-sm font-semibold text-red-400">No exercises found</p>
              <p className="mt-1 text-xs text-red-200">You can create a new exercise.</p>
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
