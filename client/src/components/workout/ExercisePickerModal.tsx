import { useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import type { Exercise, MuscleGroup } from "@/types/workout";

type ExercisePickerModalProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (exerciseId: number) => void;
  exercises: Exercise[];
  muscleGroups: MuscleGroup[];
};

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

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return exercises.filter((e) => {
      const matchesQuery =
        e.name.toLowerCase().includes(q) ||
        e.equipment.toLowerCase().includes(q) ||
        muscleGroups.find((m) => m.id === e.primaryMuscleGroupId)?.name.toLowerCase().includes(q);
      const matchesMuscle = !muscleFilter || e.primaryMuscleGroupId === muscleFilter;
      return matchesQuery && matchesMuscle;
    });
  }, [exercises, muscleGroups, query, muscleFilter]);

  const getMuscle = (id: number | null) =>
    muscleGroups.find((m) => m.id === id)?.name ?? "";

  const handleSelect = (exerciseId: number) => {
    onSelect(exerciseId);
    onClose();
    setQuery("");
    setMuscleFilter(null);
  };

  const handleClose = () => {
    onClose();
    setQuery("");
    setMuscleFilter(null);
  };

  return (
    <Modal open={open} onClose={handleClose} title="Add Exercise" size="md">
      {/* Search */}
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
          placeholder="Search by name, muscle, equipment..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          className="liquid-input w-full rounded-xl py-3 pl-11 pr-5 text-sm"
        />
      </div>

      {/* Muscle group chips */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setMuscleFilter(null)}
          className={getMuscleChipClassName(!muscleFilter)}
        >
          All
        </button>
        {muscleGroups.slice(0, 8).map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMuscleFilter(muscleFilter === m.id ? null : m.id)}
            className={getMuscleChipClassName(muscleFilter === m.id)}
          >
            {m.name}
          </button>
        ))}
      </div>

      {/* Exercise list */}
      <div className="max-h-[340px] overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No exercises found</p>
        ) : (
          filtered.map((ex) => (
            <button
              key={ex.id}
              type="button"
              onClick={() => handleSelect(ex.id)}
              className="liquid-option flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition"
            >
              <div className="liquid-chip liquid-chip-info flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold">
                {ex.name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-foreground">{ex.name}</div>
                <div className="text-xs text-tertiary">
                  {getMuscle(ex.primaryMuscleGroupId)} · {ex.equipment} · {ex.mechanic}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </Modal>
  );
}



