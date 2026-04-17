import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/shared/components";
import type { Exercise, MuscleGroup } from "@/types";

type ExercisePickerModalProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (exerciseId: number) => void;
  exercises: Exercise[];
  muscleGroups: MuscleGroup[];
};

const MODAL_EXIT_DURATION_MS = 220;

function getMuscleChipClassName(isSelected: boolean): string {
  const baseClassName = "rounded-full px-3 py-1 text-xs font-semibold transition";
  const stateClassName = isSelected
    ? "liquid-chip liquid-chip-info"
    : "liquid-pill text-tertiary hover:text-secondary";

  return `${baseClassName} ${stateClassName}`;
}

export default function ExercisePickerModal({
  open,
  onClose,
  onSelect,
  exercises,
  muscleGroups,
}: ExercisePickerModalProps) {
  const [query, setQuery] = useState("");
  const [muscleFilter, setMuscleFilter] = useState<number | null>(null);
  const closeResetTimeoutRef = useRef<number | null>(null);

  const resetFilters = useCallback(() => {
    setQuery("");
    setMuscleFilter(null);
  }, []);

  const clearCloseResetTimeout = useCallback(() => {
    if (closeResetTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(closeResetTimeoutRef.current);
    closeResetTimeoutRef.current = null;
  }, []);

  const scheduleFilterReset = useCallback(() => {
    clearCloseResetTimeout();
    closeResetTimeoutRef.current = window.setTimeout(() => {
      resetFilters();
      closeResetTimeoutRef.current = null;
    }, MODAL_EXIT_DURATION_MS);
  }, [clearCloseResetTimeout, resetFilters]);

  useEffect(() => {
    if (open) {
      clearCloseResetTimeout();
    }
  }, [clearCloseResetTimeout, open]);

  useEffect(() => {
    return () => {
      clearCloseResetTimeout();
    };
  }, [clearCloseResetTimeout]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return exercises.filter((exercise) => {
      if (!normalizedQuery) {
        return !muscleFilter || exercise.primaryMuscleGroupId === muscleFilter;
      }

      const primaryMuscleName = muscleGroups.find((m) => m.id === exercise.primaryMuscleGroupId)?.name;
      const secondaryMuscleName = muscleGroups.find((m) => m.id === exercise.secondaryMuscleGroupId)?.name;
      const searchableValues = [
        exercise.name,
        exercise.slug,
        exercise.description,
        primaryMuscleName,
        secondaryMuscleName,
      ];
      const matchesQuery = searchableValues
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(normalizedQuery));
      const matchesMuscle = !muscleFilter || exercise.primaryMuscleGroupId === muscleFilter;

      return matchesQuery && matchesMuscle;
    });
  }, [exercises, muscleFilter, muscleGroups, query]);

  const getMuscle = (id: number | null | undefined) =>
    muscleGroups.find((m) => m.id === id)?.name ?? "";

  const handleSelect = (exerciseId: number) => {
    onSelect(exerciseId);
    onClose();
    scheduleFilterReset();
  };

  const handleClose = () => {
    onClose();
    scheduleFilterReset();
  };

  return (
    <Modal isOpen={open} onClose={handleClose} title="Add Exercise" maxWidth="md">
      <div className="relative mb-4">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M11 3a8 8 0 100 16 8 8 0 000-16zM21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder="Search by name, slug, or muscle..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          className="liquid-input w-full rounded-xl py-3 pl-11 pr-5 text-sm"
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setMuscleFilter(null)}
          className={getMuscleChipClassName(!muscleFilter)}
        >
          All
        </button>
        {muscleGroups.slice(0, 8).map((muscleGroup) => (
          <button
            key={muscleGroup.id}
            type="button"
            onClick={() => setMuscleFilter(muscleFilter === muscleGroup.id ? null : muscleGroup.id)}
            className={getMuscleChipClassName(muscleFilter === muscleGroup.id)}
          >
            {muscleGroup.name}
          </button>
        ))}
      </div>

      <div className="max-h-85 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No exercises found</p>
        ) : (
          filtered.map((exercise) => (
            <button
              key={exercise.id}
              type="button"
              onClick={() => handleSelect(exercise.id)}
              className="liquid-option flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition"
            >
              <div className="liquid-chip liquid-chip-info flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold">
                {exercise.name
                  .split(" ")
                  .map((word) => word[0])
                  .join("")
                  .slice(0, 2)}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-foreground">{exercise.name}</div>
                <div className="text-xs text-tertiary">
                  {getMuscle(exercise.primaryMuscleGroupId)}
                  {exercise.secondaryMuscleGroupId
                    ? ` · ${getMuscle(exercise.secondaryMuscleGroupId)}`
                    : ""}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </Modal>
  );
}
