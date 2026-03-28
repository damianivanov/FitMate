import type { ReactNode } from "react";
import type { ExerciseLookupModel } from "@/types";

type SelectedExerciseSummaryProps = {
  selectedExercise: ExerciseLookupModel;
  selectedLabelPrefix: string;
  metaLabel: string;
  onClearSelection: () => void;
  selectedExtra?: ReactNode;
};

export function SelectedExerciseSummary({
  selectedExercise,
  selectedLabelPrefix,
  metaLabel,
  onClearSelection,
  selectedExtra,
}: SelectedExerciseSummaryProps) {
  return (
    <div className="liquid-template-dashed rounded-2xl px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">
          {selectedLabelPrefix} {selectedExercise.name}
        </p>
        <button
          type="button"
          className="liquid-pill rounded-full px-3 py-1 text-xs font-semibold"
          onClick={onClearSelection}
        >
          Clear
        </button>
      </div>
      <p className="mt-1 text-xs text-secondary">{metaLabel}</p>
      {selectedExtra}
    </div>
  );
}
