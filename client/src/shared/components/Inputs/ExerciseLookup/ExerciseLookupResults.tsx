import type { ExerciseLookupModel } from "@/types";

type ExerciseLookupOptionViewModel = {
  option: ExerciseLookupModel;
  metaLabel: string;
  isOwnedByCurrentUser: boolean;
};

type ExerciseLookupResultsProps = {
  isLoading: boolean;
  error: string | null;
  hasQuery: boolean;
  options: ExerciseLookupOptionViewModel[];
  onSelectExercise: (exercise: ExerciseLookupModel) => void;
};

function buildImageFallbackLabel(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return "?";
  }

  return trimmed.slice(0, 1).toUpperCase();
}

export function ExerciseLookupResults({
  isLoading,
  error,
  hasQuery,
  options,
  onSelectExercise,
}: ExerciseLookupResultsProps) {
  if (!hasQuery) {
    return null;
  }

  const createSelectHandler = (exercise: ExerciseLookupModel) => {
    return () => {
      onSelectExercise(exercise);
    };
  };

  return (
    <div className="liquid-surface rounded-[24px] p-2.5">
      {isLoading ? <p className="px-2 py-1 text-xs text-secondary">Searching exercises...</p> : null}
      {error ? <p className="px-2 py-1 text-xs text-danger">{error}</p> : null}

      {!isLoading && !error && options.length === 0 ? (
        <p className="px-2 py-1 text-xs text-secondary">No exercises found.</p>
      ) : null}

      {!isLoading && !error && options.length > 0 ? (
        <div className="liquid-scrollbar max-h-64 space-y-2 overflow-y-auto pr-1">
          {options.map(({ option, metaLabel, isOwnedByCurrentUser }) => (
            <div
              key={option.id}
              className="liquid-soft-surface flex items-center gap-3 rounded-2xl p-3"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-100 text-xs font-bold text-primary">
                {option.imageUrl ? (
                  <img
                    src={option.imageUrl}
                    alt=""
                    aria-hidden="true"
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  buildImageFallbackLabel(option.name)
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">{option.name}</p>
                  {isOwnedByCurrentUser ? (
                    <span className="liquid-chip liquid-chip-info rounded-full px-2 py-0.5 text-[10px] font-bold uppercase">
                      Yours
                    </span>
                  ) : null}
                </div>
                <p className="truncate text-xs text-secondary">{metaLabel}</p>
              </div>

              <button
                type="button"
                className="liquid-pill liquid-pill-primary rounded-full px-3 py-1.5 text-xs font-semibold"
                onClick={createSelectHandler(option)}
              >
                Insert
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
