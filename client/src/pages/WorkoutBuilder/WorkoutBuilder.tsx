import { useCallback, useState } from "react";
import { LuPlus } from "react-icons/lu";
import { invalidateExerciseLookupCache } from "@/hooks/useExerciseLookup";
import { useMuscleGroups } from "@/hooks/useMuscleGroups";
import { exerciseService } from "@/services/exerciseService";
import { workoutService } from "@/services/workoutService";
import type {
  CreateExerciseRequest,
  CreateWorkoutRequest,
  ExerciseLookupModel,
  ExerciseSetType,
} from "@/types";
import { CreateExerciseModal, type CreateExerciseFormValues } from "./components/CreateExerciseModal";
import { WorkoutExerciseCard } from "./components/WorkoutExerciseCard";
import { createWorkoutExerciseDraft, createWorkoutSetDraft } from "./types";
import type { WorkoutExerciseDraft, WorkoutSetDraft } from "./types";

function parseOptionalDecimal(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const normalized = trimmed.replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return parsed;
}

function parseOptionalInt(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed)) {
    return undefined;
  }

  return parsed;
}

function toCreateExercisePayload(values: CreateExerciseFormValues): CreateExerciseRequest {
  return {
    name: values.name.trim(),
    slug: values.slug.trim(),
    description: values.description.trim() || undefined,
    primaryMuscleGroupId: Number(values.primaryMuscleGroupId),
    secondaryMuscleGroupId: values.secondaryMuscleGroupId
      ? Number(values.secondaryMuscleGroupId)
      : undefined,
  };
}

function mapPreviousSetsToDrafts(previousSets: WorkoutExerciseDraft["previousSets"]): WorkoutSetDraft[] {
  if (previousSets.length === 0) {
    return [createWorkoutSetDraft()];
  }

  return previousSets.map((setItem) =>
    createWorkoutSetDraft({
      setType: setItem.setType,
      weightKg: setItem.weightKg !== undefined ? String(setItem.weightKg) : "",
      reps: setItem.reps !== undefined ? String(setItem.reps) : "",
      notes: setItem.notes ?? "",
    }),
  );
}

export default function WorkoutBuilder() {
  const [workoutStartedAt, setWorkoutStartedAt] = useState<Date>(() => new Date());
  const { muscleGroups, isLoading: isMuscleGroupsLoading, error: muscleGroupError } = useMuscleGroups();
  const [workoutTitle, setWorkoutTitle] = useState("");
  const [workoutNotes, setWorkoutNotes] = useState("");
  const [exerciseItems, setExerciseItems] = useState<WorkoutExerciseDraft[]>([createWorkoutExerciseDraft()]);
  const [isSavingWorkout, setIsSavingWorkout] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageSuccess, setPageSuccess] = useState<string | null>(null);
  const [isCreateExerciseModalOpen, setIsCreateExerciseModalOpen] = useState(false);
  const [isCreatingExercise, setIsCreatingExercise] = useState(false);
  const [createExerciseError, setCreateExerciseError] = useState<string | null>(null);
  const [lookupRefreshKey, setLookupRefreshKey] = useState(0);

  const addExerciseCard = () => {
    setExerciseItems((current) => [...current, createWorkoutExerciseDraft()]);
  };

  const removeExerciseCard = useCallback((itemId: string) => {
    setExerciseItems((current) => {
      if (current.length <= 1) {
        return current;
      }

      return current.filter((item) => item.id !== itemId);
    });
  }, []);

  const updateExerciseItem = useCallback((itemId: string, update: (item: WorkoutExerciseDraft) => WorkoutExerciseDraft) => {
    setExerciseItems((current) =>
      current.map((item) => (item.id === itemId ? update(item) : item)),
    );
  }, []);

  const loadPreviousSets = useCallback(async (itemId: string, exerciseId: number) => {
    updateExerciseItem(itemId, (item) => ({
      ...item,
      isLoadingPrevious: true,
      previousLoadError: null,
      previousSets: [],
      previousWorkoutLabel: null,
    }));

    const applyIfStillSelected = (
      item: WorkoutExerciseDraft,
      updater: (current: WorkoutExerciseDraft) => WorkoutExerciseDraft,
    ) => {
      if (item.selectedExercise?.id !== exerciseId) {
        return item;
      }

      return updater(item);
    };

    try {
      const response = await workoutService.getPreviousSets([exerciseId]);
      const result = response.data;

      if (!result.success || !result.data) {
        updateExerciseItem(itemId, (item) =>
          applyIfStillSelected(item, (current) => ({
            ...current,
            isLoadingPrevious: false,
            previousLoadError: result.error ?? "Unable to load previous sets.",
          })),
        );
        return;
      }

      const previousItem = result.data.items.find((item) => item.exerciseId === exerciseId);
      if (!previousItem) {
        updateExerciseItem(itemId, (item) =>
          applyIfStillSelected(item, (current) => ({
            ...current,
            isLoadingPrevious: false,
            previousLoadError: null,
            previousSets: [],
            previousWorkoutLabel: null,
          })),
        );
        return;
      }

      const workoutDate = new Date(previousItem.workoutStartedAt).toLocaleDateString();

      updateExerciseItem(itemId, (item) =>
        applyIfStillSelected(item, (current) => ({
          ...current,
          isLoadingPrevious: false,
          previousLoadError: null,
          previousSets: previousItem.sets,
          previousWorkoutLabel: `${previousItem.workoutTitle} (${workoutDate})`,
        })),
      );
    } catch {
      updateExerciseItem(itemId, (item) =>
        applyIfStillSelected(item, (current) => ({
          ...current,
          isLoadingPrevious: false,
          previousLoadError: "Unable to load previous sets.",
        })),
      );
    }
  }, [updateExerciseItem]);

  const onLookupSearchChange = useCallback((itemId: string, value: string) => {
    updateExerciseItem(itemId, (item) => ({
      ...item,
      lookupSearch: value,
    }));
  }, [updateExerciseItem]);

  const onMuscleGroupFilterChange = useCallback((itemId: string, value: string) => {
    updateExerciseItem(itemId, (item) => ({
      ...item,
      muscleGroupFilterId: value,
    }));
  }, [updateExerciseItem]);

  const onSelectExercise = useCallback((itemId: string, exercise: ExerciseLookupModel) => {
    updateExerciseItem(itemId, (item) => ({
      ...item,
      selectedExercise: exercise,
      lookupSearch: "",
      previousSets: [],
      previousWorkoutLabel: null,
      previousLoadError: null,
    }));

    void loadPreviousSets(itemId, exercise.id);
  }, [loadPreviousSets, updateExerciseItem]);

  const onClearExercise = useCallback((itemId: string) => {
    updateExerciseItem(itemId, (item) => ({
      ...item,
      selectedExercise: null,
      previousSets: [],
      previousWorkoutLabel: null,
      previousLoadError: null,
    }));
  }, [updateExerciseItem]);

  const onExerciseNotesChange = useCallback((itemId: string, value: string) => {
    updateExerciseItem(itemId, (item) => ({
      ...item,
      notes: value,
    }));
  }, [updateExerciseItem]);

  const onAddSet = useCallback((itemId: string) => {
    updateExerciseItem(itemId, (item) => ({
      ...item,
      sets: [...item.sets, createWorkoutSetDraft()],
    }));
  }, [updateExerciseItem]);

  const onRemoveSet = useCallback((itemId: string, setId: string) => {
    updateExerciseItem(itemId, (item) => {
      if (item.sets.length <= 1) {
        return item;
      }

      return {
        ...item,
        sets: item.sets.filter((setItem) => setItem.id !== setId),
      };
    });
  }, [updateExerciseItem]);

  const onSetChange = useCallback((
    itemId: string,
    setId: string,
    field: keyof WorkoutSetDraft,
    value: string | ExerciseSetType,
  ) => {
    updateExerciseItem(itemId, (item) => ({
      ...item,
      sets: item.sets.map((setItem) => {
        if (setItem.id !== setId) {
          return setItem;
        }

        return {
          ...setItem,
          [field]: value,
        };
      }),
    }));
  }, [updateExerciseItem]);

  const onApplyPreviousSets = useCallback((itemId: string) => {
    updateExerciseItem(itemId, (item) => ({
      ...item,
      sets: mapPreviousSetsToDrafts(item.previousSets),
    }));
  }, [updateExerciseItem]);

  const resetWorkoutForm = () => {
    setWorkoutStartedAt(new Date());
    setWorkoutTitle("");
    setWorkoutNotes("");
    setExerciseItems([createWorkoutExerciseDraft()]);
  };

  const saveWorkout = async () => {
    setPageError(null);
    setPageSuccess(null);

    const title = workoutTitle.trim();
    if (!title) {
      setPageError("Workout title is required.");
      return;
    }

    for (let exerciseIndex = 0; exerciseIndex < exerciseItems.length; exerciseIndex++) {
      const exerciseItem = exerciseItems[exerciseIndex];
      if (!exerciseItem.selectedExercise) {
        setPageError(`Exercise #${exerciseIndex + 1} is not selected.`);
        return;
      }

      for (let setIndex = 0; setIndex < exerciseItem.sets.length; setIndex++) {
        const setItem = exerciseItem.sets[setIndex];
        const weightValue = setItem.weightKg.trim();
        const repsValue = setItem.reps.trim();

        if (!weightValue && !repsValue) {
          setPageError(`Exercise #${exerciseIndex + 1}, set #${setIndex + 1}: add weight, reps, or both.`);
          return;
        }

        if (weightValue && parseOptionalDecimal(weightValue) === undefined) {
          setPageError(`Exercise #${exerciseIndex + 1}, set #${setIndex + 1}: invalid weight.`);
          return;
        }

        if (repsValue && parseOptionalInt(repsValue) === undefined) {
          setPageError(`Exercise #${exerciseIndex + 1}, set #${setIndex + 1}: reps must be an integer.`);
          return;
        }
      }
    }

    const payload: CreateWorkoutRequest = {
      title,
      notes: workoutNotes.trim() || undefined,
      startedAt: workoutStartedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      exercises: exerciseItems.map((exerciseItem) => ({
        exerciseId: exerciseItem.selectedExercise?.id ?? 0,
        notes: exerciseItem.notes.trim() || undefined,
        sets: exerciseItem.sets.map((setItem) => ({
          setType: setItem.setType,
          weightKg: parseOptionalDecimal(setItem.weightKg),
          reps: parseOptionalInt(setItem.reps),
          notes: setItem.notes.trim() || undefined,
        })),
      })),
    };

    setIsSavingWorkout(true);

    try {
      const response = await workoutService.create(payload);
      const result = response.data;
      if (!result.success || !result.data) {
        setPageError(result.error ?? "Unable to save workout.");
        return;
      }

      setPageSuccess(
        `Workout saved: ${result.data.exerciseCount} exercises, ${result.data.setCount} sets, total volume ${result.data.totalVolumeKg ?? 0} kg.`,
      );
      resetWorkoutForm();
    } catch {
      setPageError("Unable to save workout.");
    } finally {
      setIsSavingWorkout(false);
    }
  };

  const openCreateExerciseModal = () => {
    setCreateExerciseError(null);
    setIsCreateExerciseModalOpen(true);
  };

  const closeCreateExerciseModal = () => {
    setCreateExerciseError(null);
    setIsCreateExerciseModalOpen(false);
  };

  const saveCreatedExercise = async (values: CreateExerciseFormValues) => {
    const payload = toCreateExercisePayload(values);
    if (!payload.name || !payload.slug || !payload.primaryMuscleGroupId) {
      setCreateExerciseError("Name, slug, and primary muscle group are required.");
      return;
    }

    setIsCreatingExercise(true);
    setCreateExerciseError(null);

    try {
      const response = await exerciseService.createGlobal(payload);
      const result = response.data;
      if (!result.success || !result.data) {
        setCreateExerciseError(result.error ?? "Unable to create exercise.");
        return;
      }

      invalidateExerciseLookupCache();
      setLookupRefreshKey((current) => current + 1);
      setPageSuccess(`Exercise "${result.data.name}" was created globally with you as creator.`);
      closeCreateExerciseModal();
    } catch {
      setCreateExerciseError("Unable to create exercise.");
    } finally {
      setIsCreatingExercise(false);
    }
  };

  const visiblePageError = pageError ?? muscleGroupError;
  const workoutStartedLabel = workoutStartedAt.toLocaleString();

  return (
    <div className="w-full flex-1 px-5 py-8">
      <div className="mx-auto w-full max-w-[79dvw] space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-extrabold text-primary">Workout Builder</h1>
          <p className="text-sm text-secondary">
            Create workouts, add sets quickly, pull previous working sets, and extend the global exercise catalog.
          </p>
        </header>

        <section className="liquid-surface rounded-3xl p-5 md:p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="workout-title" className="text-sm font-medium text-secondary">Workout Title</label>
              <input
                id="workout-title"
                value={workoutTitle}
                onChange={(event) => setWorkoutTitle(event.target.value)}
                placeholder="Push Day A"
                className="liquid-input mt-2 w-full rounded-full px-3 py-2.5"
              />
            </div>

            <div className="liquid-soft-surface rounded-2xl px-4 py-3 text-sm text-secondary">
              <p className="font-semibold text-primary">Workout started at</p>
              <p>{workoutStartedLabel}</p>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="workout-notes" className="text-sm font-medium text-secondary">Session Notes</label>
              <textarea
                id="workout-notes"
                value={workoutNotes}
                onChange={(event) => setWorkoutNotes(event.target.value)}
                placeholder="How did this workout feel?"
                className="liquid-input mt-2 min-h-24 w-full rounded-2xl px-3 py-2.5"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="liquid-pill rounded-full px-4 py-2.5 text-sm font-semibold"
              onClick={addExerciseCard}
            >
              <span className="inline-flex items-center gap-1.5">
                <LuPlus className="h-4 w-4" />
                Add Exercise
              </span>
            </button>

            <button
              type="button"
              className="liquid-pill rounded-full px-4 py-2.5 text-sm font-semibold"
              onClick={openCreateExerciseModal}
            >
              Create New Global Exercise
            </button>

            <button
              type="button"
              className="liquid-primary-btn rounded-full px-5 py-2.5 text-sm font-semibold"
              onClick={saveWorkout}
              disabled={isSavingWorkout || isMuscleGroupsLoading}
            >
              {isSavingWorkout ? "Saving workout..." : "Save Workout"}
            </button>
          </div>

          {visiblePageError ? <p className="mt-4 text-sm text-danger">{visiblePageError}</p> : null}
          {pageSuccess ? <p className="mt-4 text-sm text-emerald-700">{pageSuccess}</p> : null}
        </section>

        <section className="space-y-4">
          {exerciseItems.map((item, index) => (
            <WorkoutExerciseCard
              key={item.id}
              item={item}
              index={index}
              canRemove={exerciseItems.length > 1}
              lookupRefreshKey={lookupRefreshKey}
              muscleGroups={muscleGroups}
              onRemoveExercise={removeExerciseCard}
              onLookupSearchChange={onLookupSearchChange}
              onMuscleGroupFilterChange={onMuscleGroupFilterChange}
              onSelectExercise={onSelectExercise}
              onClearExercise={onClearExercise}
              onExerciseNotesChange={onExerciseNotesChange}
              onAddSet={onAddSet}
              onRemoveSet={onRemoveSet}
              onSetChange={onSetChange}
              onApplyPreviousSets={onApplyPreviousSets}
            />
          ))}
        </section>
      </div>

      <CreateExerciseModal
        isOpen={isCreateExerciseModalOpen}
        isSaving={isCreatingExercise}
        muscleGroups={muscleGroups}
        error={createExerciseError}
        onClose={closeCreateExerciseModal}
        onSubmit={saveCreatedExercise}
      />
    </div>
  );
}

