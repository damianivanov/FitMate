import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ChangeEvent,
  KeyboardEvent as ReactKeyboardEvent,
  UIEvent as ReactUIEvent,
} from "react";
import { LuCheck, LuLoader, LuPlus, LuSearch } from "react-icons/lu";
import { useExerciseLookup } from "@/hooks/useExerciseLookup";
import { useMuscleGroups } from "@/hooks/useMuscleGroups";
import { Dropdown, Modal } from "@/shared/components";
import type { ExerciseLookupModel } from "@/types";

const LIBRARY_LOOKUP_DEBOUNCE_MS = 140;
const DEFAULT_LIBRARY_LOOKUP_TAKE = 48;

type WorkoutAddExerciseModalProps = {
  isOpen: boolean;
  selectedExerciseIds: readonly number[];
  onAddExercise: (exercise: ExerciseLookupModel) => boolean;
  onClose: () => void;
};

function getSingleSelectedMuscleGroupId(ids: number[]): number | undefined {
  return ids.length === 1 ? ids[0] : undefined;
}

export function WorkoutAddExerciseModal({
  isOpen,
  selectedExerciseIds,
  onAddExercise,
  onClose,
}: WorkoutAddExerciseModalProps) {
  const [librarySearchTerm, setLibrarySearchTerm] = useState("");
  const [selectedMuscleGroupIds, setSelectedMuscleGroupIds] = useState<number[]>([]);
  const [libraryLookupSkip, setLibraryLookupSkip] = useState(0);
  const [libraryExercises, setLibraryExercises] = useState<ExerciseLookupModel[]>([]);
  const [addedExerciseIds, setAddedExerciseIds] = useState<Set<number>>(() => new Set());
  const lastLoadTriggerHeightRef = useRef<number | null>(null);
  const { muscleGroups, error: muscleGroupsError } = useMuscleGroups({ enabled: isOpen });

  const selectedExerciseIdSet = useMemo(
    () => new Set(selectedExerciseIds),
    [selectedExerciseIds],
  );

  const muscleGroupOptions = useMemo(
    () => muscleGroups.map((group) => ({
      value: group.id,
      label: group.name,
      imageUrl: group.imageUrl ?? undefined,
    })),
    [muscleGroups],
  );

  const singleMuscleGroupId = getSingleSelectedMuscleGroupId(selectedMuscleGroupIds);

  const handleLibraryLookupSuccess = useCallback((page: ExerciseLookupModel[]) => {
    if (libraryLookupSkip === 0) {
      setLibraryExercises(page);
      return;
    }

    setLibraryExercises((previous) => {
      const existingIds = new Set(previous.map((exercise) => exercise.id));
      const nextExercises = [...previous];
      page.forEach((exercise) => {
        if (!existingIds.has(exercise.id)) {
          existingIds.add(exercise.id);
          nextExercises.push(exercise);
        }
      });
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

  useEffect(() => {
    lastLoadTriggerHeightRef.current = null;
  }, [isOpen, librarySearchTerm, selectedMuscleGroupIds]);

  const resetModalState = () => {
    setLibrarySearchTerm("");
    setSelectedMuscleGroupIds([]);
    setLibraryLookupSkip(0);
    setLibraryExercises([]);
    setAddedExerciseIds(new Set());
    lastLoadTriggerHeightRef.current = null;
  };

  const handleModalClose = () => {
    resetModalState();
    onClose();
  };

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

  const handleExerciseSelect = (exercise: ExerciseLookupModel) => {
    if (selectedExerciseIdSet.has(exercise.id)) {
      return;
    }

    const wasAdded = onAddExercise(exercise);
    if (!wasAdded) {
      return;
    }

    setAddedExerciseIds((current) => {
      const next = new Set(current);
      next.add(exercise.id);
      return next;
    });
  };

  const handleExerciseListScroll = (event: ReactUIEvent<HTMLDivElement>) => {
    if (isWaitingForLibraryResults || !hasMoreLibraryExercises) {
      return;
    }

    const containerElement = event.currentTarget;
    const loadMoreThresholdPx = 120;
    const isNearBottom =
      containerElement.scrollTop + containerElement.clientHeight >= containerElement.scrollHeight - loadMoreThresholdPx;

    if (!isNearBottom || lastLoadTriggerHeightRef.current === containerElement.scrollHeight) {
      return;
    }

    lastLoadTriggerHeightRef.current = containerElement.scrollHeight;
    handleLoadMoreLibraryExercises();
  };

  const createExerciseClickHandler = (exercise: ExerciseLookupModel) => () => {
    handleExerciseSelect(exercise);
  };

  const createExerciseKeyDownHandler = (exercise: ExerciseLookupModel) =>
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      handleExerciseSelect(exercise);
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
                id="workout-add-exercise-muscle-filter"
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
              const wasJustAdded = addedExerciseIds.has(exercise.id);
              const exerciseItemClassName = [
                "flex items-center gap-3 rounded-3xl px-2 py-3 transition-all duration-300 ease-out",
                isAlreadyAdded
                  ? "cursor-default bg-emerald-300/22 shadow-[inset_0_0_0_1px_rgba(110,231,183,0.55)]"
                  : "cursor-pointer hover:bg-white/4",
                wasJustAdded
                  ? "bg-emerald-400/18 shadow-[inset_0_0_0_1px_rgba(110,231,183,0.78),0_10px_24px_rgba(16,185,129,0.24)] -translate-y-0.5"
                  : "",
              ].join(" ");

              return (
                <div
                  key={exercise.id}
                  role="button"
                  tabIndex={0}
                  onClick={createExerciseClickHandler(exercise)}
                  onKeyDown={createExerciseKeyDownHandler(exercise)}
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
                    <LuCheck className="h-5 w-5 shrink-0 text-emerald-300" />
                  ) : (
                    <LuPlus className="h-4 w-4 shrink-0 text-emerald-300 transition-transform duration-200" />
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
