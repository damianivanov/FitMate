import { useEffect, useMemo } from "react";
import { LuPlus, LuRotateCcw, LuTrash2 } from "react-icons/lu";
import { LookupDropdown } from "@/shared/components";
import { useExerciseLookup } from "@/hooks/useExerciseLookup";
import type { WorkoutExerciseDraft, WorkoutSetDraft } from "../types";
import { ExerciseSetType } from "@/types";
import type { ExerciseLookupModel, MuscleGroup } from "@/types";

type WorkoutExerciseCardProps = {
  item: WorkoutExerciseDraft;
  index: number;
  canRemove: boolean;
  lookupRefreshKey: number;
  muscleGroups: MuscleGroup[];
  onRemoveExercise: (itemId: string) => void;
  onLookupSearchChange: (itemId: string, value: string) => void;
  onMuscleGroupFilterChange: (itemId: string, value: string) => void;
  onSelectExercise: (itemId: string, exercise: ExerciseLookupModel) => void;
  onClearExercise: (itemId: string) => void;
  onExerciseNotesChange: (itemId: string, value: string) => void;
  onAddSet: (itemId: string) => void;
  onRemoveSet: (itemId: string, setId: string) => void;
  onSetChange: (
    itemId: string,
    setId: string,
    field: keyof WorkoutSetDraft,
    value: string | ExerciseSetType,
  ) => void;
  onApplyPreviousSets: (itemId: string) => void;
};

const setTypeOptions = [
  { value: ExerciseSetType.Warmup, label: "Warmup" },
  { value: ExerciseSetType.Working, label: "Working" },
  { value: ExerciseSetType.Dropset, label: "Dropset" },
  { value: ExerciseSetType.Failure, label: "Failure" },
] as const;

export function WorkoutExerciseCard({
  item,
  index,
  canRemove,
  lookupRefreshKey,
  muscleGroups,
  onRemoveExercise,
  onLookupSearchChange,
  onMuscleGroupFilterChange,
  onSelectExercise,
  onClearExercise,
  onExerciseNotesChange,
  onAddSet,
  onRemoveSet,
  onSetChange,
  onApplyPreviousSets,
}: WorkoutExerciseCardProps) {
  const muscleGroupFilterId = item.muscleGroupFilterId ? Number(item.muscleGroupFilterId) : undefined;
  const { options, isLoading, error, reload } = useExerciseLookup({
    search: item.lookupSearch,
    muscleGroupId: muscleGroupFilterId,
    enabled: true,
    take: 20,
  });

  useEffect(() => {
    if (lookupRefreshKey <= 0) {
      return;
    }

    void reload();
  }, [lookupRefreshKey, reload]);

  const muscleGroupOptions = useMemo(
    () => [
      { value: "", label: "All muscle groups" },
      ...muscleGroups.map((group) => ({
        value: String(group.id),
        label: group.name,
        imageUrl: group.imageUrl ?? undefined,
      })),
    ],
    [muscleGroups],
  );

  const showLookupSuggestions = Boolean(item.lookupSearch.trim() || item.muscleGroupFilterId);

  return (
    <article className="liquid-surface rounded-3xl p-4 md:p-5">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h3 className="text-lg font-bold text-primary">Exercise {index + 1}</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="liquid-pill rounded-full px-3 py-2 text-xs font-semibold"
            onClick={() => onApplyPreviousSets(item.id)}
            disabled={item.previousSets.length === 0 || item.isLoadingPrevious}
            title={item.previousSets.length === 0 ? "No previous sets found yet" : "Copy previous sets"}
          >
            <span className="inline-flex items-center gap-1">
              <LuRotateCcw className="h-3.5 w-3.5" />
              {item.isLoadingPrevious ? "Loading previous..." : `Use Previous (${item.previousSets.length})`}
            </span>
          </button>

          {canRemove ? (
            <button
              type="button"
              className="liquid-pill liquid-pill-danger rounded-full p-2"
              onClick={() => onRemoveExercise(item.id)}
              aria-label="Remove exercise"
              title="Remove exercise"
            >
              <LuTrash2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-3 md:col-span-2">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="space-y-2">
              <label htmlFor={`exercise-lookup-${item.id}`} className="text-sm font-medium text-secondary">
                Choose Exercise
              </label>
              <input
                id={`exercise-lookup-${item.id}`}
                value={item.lookupSearch}
                onChange={(event) => onLookupSearchChange(item.id, event.target.value)}
                placeholder={item.selectedExercise ? item.selectedExercise.name : "Type to search exercises..."}
                className="liquid-input w-full rounded-full px-3 py-2.5"
              />
            </div>

            <LookupDropdown
              id={`exercise-muscle-filter-${item.id}`}
              label="Filter by Muscle Group"
              value={item.muscleGroupFilterId}
              options={muscleGroupOptions}
              onChange={(value) => onMuscleGroupFilterChange(item.id, value)}
              placeholder="All muscle groups"
              containerClassName="space-y-2 text-sm font-medium text-secondary"
              labelClassName="block rounded-full"
            />
          </div>

          {showLookupSuggestions ? (
            <div className="liquid-surface rounded-2xl p-2">
              {isLoading ? <p className="px-2 py-1 text-xs text-secondary">Searching exercises...</p> : null}
              {error ? <p className="px-2 py-1 text-xs text-danger">{error}</p> : null}
              {!isLoading && !error && options.length === 0 ? (
                <p className="px-2 py-1 text-xs text-secondary">No exercises found.</p>
              ) : null}

              {!isLoading && !error && options.length > 0 ? (
                <div className="liquid-scrollbar max-h-56 space-y-1 overflow-y-auto">
                  {options.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className="liquid-option w-full rounded-2xl px-3 py-2 text-left transition"
                      onClick={() => onSelectExercise(item.id, option)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg">
                          {option.imageUrl ? (
                            <img
                              src={option.imageUrl}
                              alt=""
                              aria-hidden="true"
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-primary">{option.name}</p>
                          <p className="truncate text-xs text-secondary">
                            {option.primaryMuscleGroupName}
                            {option.secondaryMuscleGroupName ? ` | ${option.secondaryMuscleGroupName}` : ""}
                            {option.creatorDisplayName ? ` | by ${option.creatorDisplayName}` : ""}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {item.selectedExercise ? (
            <div className="liquid-soft-surface rounded-2xl px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-primary">
                  Selected: {item.selectedExercise.name}
                </p>
                <button
                  type="button"
                  className="text-xs font-semibold text-secondary underline underline-offset-4"
                  onClick={() => onClearExercise(item.id)}
                >
                  Clear
                </button>
              </div>
              <p className="mt-1 text-xs text-secondary">
                {item.selectedExercise.primaryMuscleGroupName}
                {item.selectedExercise.secondaryMuscleGroupName
                  ? ` | ${item.selectedExercise.secondaryMuscleGroupName}`
                  : ""}
              </p>
              {item.previousWorkoutLabel ? (
                <p className="mt-1 text-xs text-secondary">Last used in: {item.previousWorkoutLabel}</p>
              ) : null}
              {item.previousLoadError ? <p className="mt-1 text-xs text-danger">{item.previousLoadError}</p> : null}
            </div>
          ) : null}
        </div>

        <div className="md:col-span-2">
          <label htmlFor={`exercise-notes-${item.id}`} className="text-sm font-medium text-secondary">
            Exercise Notes
          </label>
          <textarea
            id={`exercise-notes-${item.id}`}
            value={item.notes}
            onChange={(event) => onExerciseNotesChange(item.id, event.target.value)}
            placeholder="Optional notes for this exercise"
            className="liquid-input mt-2 min-h-20 w-full rounded-2xl px-3 py-2.5"
          />
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-secondary">
              <th className="pb-2 pr-3 font-semibold">Set</th>
              <th className="pb-2 pr-3 font-semibold">Type</th>
              <th className="pb-2 pr-3 font-semibold">Weight (kg)</th>
              <th className="pb-2 pr-3 font-semibold">Reps</th>
              <th className="pb-2 pr-3 font-semibold">Notes</th>
              <th className="pb-2 pr-1 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {item.sets.map((setItem, setIndex) => (
              <tr key={setItem.id} className="align-top">
                <td className="py-1 pr-3 text-secondary">{setIndex + 1}</td>
                <td className="py-1 pr-3">
                  <select
                    value={setItem.setType}
                    onChange={(event) =>
                      onSetChange(item.id, setItem.id, "setType", Number(event.target.value) as ExerciseSetType)}
                    className="liquid-input min-w-32 rounded-full px-3 py-2"
                  >
                    {setTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1 pr-3">
                  <input
                    value={setItem.weightKg}
                    onChange={(event) => onSetChange(item.id, setItem.id, "weightKg", event.target.value)}
                    inputMode="decimal"
                    placeholder="e.g. 80"
                    className="liquid-input min-w-24 rounded-full px-3 py-2"
                  />
                </td>
                <td className="py-1 pr-3">
                  <input
                    value={setItem.reps}
                    onChange={(event) => onSetChange(item.id, setItem.id, "reps", event.target.value)}
                    inputMode="numeric"
                    placeholder="e.g. 8"
                    className="liquid-input min-w-20 rounded-full px-3 py-2"
                  />
                </td>
                <td className="py-1 pr-3">
                  <input
                    value={setItem.notes}
                    onChange={(event) => onSetChange(item.id, setItem.id, "notes", event.target.value)}
                    placeholder="Optional"
                    className="liquid-input min-w-48 rounded-full px-3 py-2"
                  />
                </td>
                <td className="py-1 pr-1">
                  <button
                    type="button"
                    onClick={() => onRemoveSet(item.id, setItem.id)}
                    disabled={item.sets.length <= 1}
                    className="liquid-pill liquid-pill-danger rounded-full p-2 disabled:opacity-45"
                    aria-label="Remove set"
                    title="Remove set"
                  >
                    <LuTrash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        className="liquid-pill mt-4 rounded-full px-3 py-2 text-xs font-semibold"
        onClick={() => onAddSet(item.id)}
      >
        <span className="inline-flex items-center gap-1">
          <LuPlus className="h-3.5 w-3.5" />
          Add Set
        </span>
      </button>
    </article>
  );
}

