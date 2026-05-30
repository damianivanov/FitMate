import type { HTMLAttributes, MouseEvent as ReactMouseEvent } from "react";
import { LuCheck, LuGripVertical, LuTrash2 } from "react-icons/lu";
import { ExerciseSetType } from "@/types";
import { ExerciseSetTypeDropdown } from "./ExerciseSetTypeDropdown";
import { formatPreviousSetLabel, getCompactSetValueText } from "./format";
import type {
  ExerciseBuilderCallbacks,
  ExerciseBuilderCapabilities,
  ExerciseBuilderSetVM,
} from "./types";

type ExerciseSetRowProps = {
  exerciseId: string;
  set: ExerciseBuilderSetVM;
  setNumber: number;
  isDurationEnabled: boolean;
  capabilities: ExerciseBuilderCapabilities;
  callbacks: ExerciseBuilderCallbacks;
  isSetEditMode: boolean;
  dragHandleProps?: HTMLAttributes<HTMLElement>;
  setDragHandleRef?: (element: HTMLElement | null) => void;
  isDragging?: boolean;
  isSetDragDisabled?: boolean;
};

function getSetIndexScaleClassName(setNumber: number): string {
  if (setNumber >= 100) {
    return "scale-75";
  }

  if (setNumber >= 10) {
    return "scale-90";
  }

  return "scale-100";
}

export function ExerciseSetRow({
  exerciseId,
  set,
  setNumber,
  isDurationEnabled,
  capabilities,
  callbacks,
  isSetEditMode,
  dragHandleProps,
  setDragHandleRef,
  isDragging = false,
  isSetDragDisabled = false,
}: ExerciseSetRowProps) {
  const activeMetricField = isDurationEnabled ? "durationSeconds" : "reps";
  const activeMetricValue = isDurationEnabled ? set.durationSeconds : set.reps;

  const handleWeightClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    callbacks.onOpenQuickSetPopover(exerciseId, set.id, "weightKg", event.currentTarget);
  };

  const handleMetricClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    callbacks.onOpenQuickSetPopover(exerciseId, set.id, activeMetricField, event.currentTarget);
  };

  const handleRestClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    callbacks.onOpenQuickSetPopover(exerciseId, set.id, "restSeconds", event.currentTarget);
  };

  const handleCompletedClick = () => {
    callbacks.onSetCompletedToggle?.(exerciseId, set.id);
  };

  const handleRemoveClick = () => {
    callbacks.onRemoveSet(exerciseId, set.id);
  };

  const handleSetTypeChange = (setType: ExerciseSetType) => {
    callbacks.onSetTypeChange?.(exerciseId, set.id, setType);
  };

  const gripButton = capabilities.allowSetDnd ? (
    <button
      type="button"
      ref={(element) => setDragHandleRef?.(element)}
      {...(dragHandleProps ?? {})}
      className={[
        "inline-flex h-8 w-8 shrink-0 touch-none items-center justify-center rounded-full text-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300",
        isSetDragDisabled
          ? "cursor-default opacity-40"
          : "cursor-grab hover:bg-white/8 hover:text-primary active:cursor-grabbing",
      ].join(" ")}
      aria-disabled={isSetDragDisabled}
      aria-label={isSetDragDisabled ? `Set ${setNumber} cannot be reordered` : `Drag to reorder set ${setNumber}`}
      title={isSetDragDisabled ? "Add another set to reorder" : "Drag to reorder"}
    >
      <LuGripVertical className="h-4 w-4" />
    </button>
  ) : null;

  const indexLabel = (
    <span
      className={`mono inline-block w-7 shrink-0 origin-center whitespace-nowrap text-center text-2xs font-semibold text-primary ${getSetIndexScaleClassName(setNumber)}`}
    >
      #{setNumber}
    </span>
  );

  const removeButton = (
    <button
      type="button"
      onClick={handleRemoveClick}
      className={
        capabilities.showCompletionCheckbox
          ? "flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-(--input-border) bg-(--glass-bg-input) text-danger transition hover:bg-red-100/20 hover:text-danger md:h-9 md:w-9"
          : "flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-danger transition hover:bg-red-100/20 hover:text-danger md:h-9 md:w-9"
      }
      aria-label={`Remove set ${setNumber}`}
    >
      <LuTrash2 className="h-4 w-4 sm:h-5 sm:w-5" />
    </button>
  );

  if (isSetEditMode) {
    const compactParts = [
      getCompactSetValueText(set.weightKg),
      getCompactSetValueText(activeMetricValue),
    ];
    if (capabilities.showRestColumn) {
      compactParts.push(getCompactSetValueText(set.restSeconds));
    }
    const compactValueText = compactParts.join("  /  ");
    const compactValueTitle = `Weight / ${isDurationEnabled ? "Duration" : "Reps"}${capabilities.showRestColumn ? " / Rest" : ""}`;
    const compactUnitParts = ["kg", isDurationEnabled ? "sec" : "reps"];
    if (capabilities.showRestColumn) {
      compactUnitParts.push("sec");
    }
    const compactUnitsText = compactUnitParts.join("  /  ");

    return (
      <div
        className={[
          "flex items-center gap-2 rounded-xl px-1 py-1.5 transition-[background-color,opacity]",
          set.isCompleted ? "bg-success/10" : "",
          isDragging ? "opacity-30" : "opacity-100",
        ].join(" ")}
      >
        {gripButton}
        {indexLabel}
        {capabilities.showSetTypeDropdown ? (
          <div className="w-20 shrink-0">
            <ExerciseSetTypeDropdown
              value={set.setType ?? ExerciseSetType.Working}
              setNumber={setNumber}
              onChange={handleSetTypeChange}
            />
          </div>
        ) : null}
        <div
          className="flex min-w-0 flex-1 flex-col items-center justify-center"
          title={compactValueTitle}
        >
          <span className="w-full truncate text-center text-sm font-semibold tabular-nums text-secondary">
            {compactValueText}
          </span>
          <span className="w-full truncate text-center text-2xs font-medium tracking-wide text-muted">
            {compactUnitsText}
          </span>
        </div>
        {removeButton}
      </div>
    );
  }

  const showRest = capabilities.showRestColumn;
  const showPrevious = capabilities.showPreviousColumn;
  const thirdColumnShown = showRest || showPrevious;
  const showCompletion = capabilities.showCompletionCheckbox;
  const previousLabel = formatPreviousSetLabel(set.previousSet) ?? "-";

  const metricButtonClass = [
    "liquid-input w-full cursor-pointer rounded-md px-1 py-2 text-center text-xs font-semibold tabular-nums sm:rounded-lg sm:px-2 sm:py-1.5 sm:text-sm",
    set.isCompleted ? "border-success! bg-success! text-white shadow-none hover:bg-success!" : "",
  ].join(" ");

  const gridClass = [
    "grid min-w-0 flex-1 gap-1 sm:gap-2",
    thirdColumnShown ? "grid-cols-3" : "grid-cols-2",
  ].join(" ");

  return (
    <div
      className={[
        "flex items-center justify-between gap-2 py-1 transition-[background-color,border-color,opacity] sm:py-1.5",
        set.isCompleted ? "rounded-xl bg-success/10" : "",
        isDragging ? "opacity-30" : "opacity-100",
      ].join(" ")}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {gripButton ?? indexLabel}

        <div className={gridClass}>
          <button
            type="button"
            onClick={handleWeightClick}
            className={metricButtonClass}
            aria-label={`Set weight for set ${setNumber}`}
          >
            {getCompactSetValueText(set.weightKg)}
          </button>

          <button
            type="button"
            onClick={handleMetricClick}
            className={metricButtonClass}
            aria-label={`Set ${isDurationEnabled ? "duration" : "reps"} for set ${setNumber}`}
          >
            {getCompactSetValueText(activeMetricValue)}
          </button>

          {showRest ? (
            <button
              type="button"
              onClick={handleRestClick}
              className={`${metricButtonClass} text-secondary`}
              aria-label={`Set rest for set ${setNumber}`}
            >
              {getCompactSetValueText(set.restSeconds)}
            </button>
          ) : null}

          {showPrevious ? (
            <span
              className={[
                "liquid-input flex w-full min-w-0 items-center justify-center truncate rounded-md px-1 py-2 text-center text-2xs font-semibold text-secondary sm:rounded-lg sm:px-2 sm:py-1.5 sm:text-sm",
                set.isCompleted ? "border-success/60! bg-success/20! text-success" : "",
              ].join(" ")}
              title={`Last completed set: ${previousLabel}`}
            >
              {previousLabel}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex h-8 w-8 shrink-0 items-center justify-center md:h-9 md:w-9">
        {showCompletion ? (
          <button
            type="button"
            onClick={handleCompletedClick}
            className={[
              "inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border transition hover:bg-success/10 md:h-9 md:w-9",
              set.isCompleted
                ? "border-success bg-success text-white hover:bg-success"
                : "border-(--input-border) bg-(--glass-bg-input) text-muted",
            ].join(" ")}
            aria-label={set.isCompleted ? `Mark set ${setNumber} incomplete` : `Mark set ${setNumber} complete`}
          >
            <LuCheck className={["h-4 w-4", set.isCompleted ? "" : "opacity-50"].join(" ")} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
