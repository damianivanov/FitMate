import type { MuscleGroup } from "@/types";

type MuscleGroupChipSelectorProps = {
  label: string;
  muscleGroups: MuscleGroup[];
  selectedMuscleGroupId: string;
  onSelect: (nextValue: string) => void;
};

function getChipClassName(isActive: boolean): string {
  const stateClassName = isActive ? "liquid-pill-primary-active" : "liquid-pill-primary";
  return `liquid-pill ${stateClassName} inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold`;
}

function buildFallbackLabel(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return "?";
  }

  return trimmed.slice(0, 1).toUpperCase();
}

export function MuscleGroupChipSelector({
  label,
  muscleGroups,
  selectedMuscleGroupId,
  onSelect,
}: MuscleGroupChipSelectorProps) {
  const handleAllSelect = () => {
    onSelect("");
  };

  const createSelectHandler = (groupId: string) => {
    return () => {
      onSelect(groupId);
    };
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-secondary">{label}</p>
      <div className="liquid-scrollbar flex w-full items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          className={getChipClassName(selectedMuscleGroupId === "")}
          onClick={handleAllSelect}
        >
          All
        </button>

        {muscleGroups.map((group) => {
          const groupId = String(group.id);
          const isActive = selectedMuscleGroupId === groupId;

          return (
            <button
              key={group.id}
              type="button"
              className={getChipClassName(isActive)}
              onClick={createSelectHandler(groupId)}
            >
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-100 text-xs font-bold text-primary">
                {group.imageUrl ? (
                  <img
                    src={group.imageUrl}
                    alt=""
                    aria-hidden="true"
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  buildFallbackLabel(group.name)
                )}
              </span>
              <span className="truncate">{group.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
