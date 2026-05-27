import type { HTMLAttributes, MouseEvent as ReactMouseEvent } from "react";
import { LuCheck, LuGripVertical, LuTrash2 } from "react-icons/lu";
import { ExerciseSetType, type PreviousExerciseSet } from "@/types";
import {
  formatPreviousSetLabel,
  getCompactSetValueText,
  type WorkoutSetDraft,
  type WorkoutSetMetricField,
} from "../utils/workoutDraft";
import { ExerciseSetTypeDropdown } from "./ExerciseSetTypeDropdown";

type WorkoutSetRowProps = {
  exerciseDraftId: string;
  set: WorkoutSetDraft;
  setNumber: number;
  previousSet?: PreviousExerciseSet;
  isDurationEnabled: boolean;
  onSetTypeChange: (
    exerciseDraftId: string,
    setDraftId: string,
    setType: ExerciseSetType,
  ) => void;
  onSetCompletedToggle: (exerciseDraftId: string, setDraftId: string) => void;
  onRemoveSet: (exerciseDraftId: string, setDraftId: string) => void;
  onOpenQuickSetPopover: (
    exerciseDraftId: string,
    setDraftId: string,
    field: WorkoutSetMetricField,
    anchorElement: HTMLElement,
  ) => void;
  dragHandleProps?: HTMLAttributes<HTMLElement>;
  setDragHandleRef?: (element: HTMLElement | null) => void;
  isDragging?: boolean;
  isSetEditMode?: boolean;
  isSetDragDisabled?: boolean;
};

export function WorkoutSetRow({
  exerciseDraftId,
  set,
  setNumber,
  previousSet,
  isDurationEnabled,
  onSetTypeChange,
  onSetCompletedToggle,
  onRemoveSet,
  onOpenQuickSetPopover,
  dragHandleProps,
  setDragHandleRef,
  isDragging = false,
  isSetEditMode = false,
  isSetDragDisabled = false,
}: WorkoutSetRowProps) {
  const previousSetLabel = formatPreviousSetLabel(previousSet) ?? "-";
  const activeMetricField = isDurationEnabled ? "durationSeconds" : "reps";
  const activeMetricValue = isDurationEnabled ? set.durationSeconds : set.reps;

  const handleCompletedChange = () => {
    onSetCompletedToggle(exerciseDraftId, set.id);
  };

  const handleRemoveClick = () => {
    onRemoveSet(exerciseDraftId, set.id);
  };

  const handleSetTypeChange = (setType: ExerciseSetType) => {
    onSetTypeChange(exerciseDraftId, set.id, setType);
  };

  const handleWeightClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    onOpenQuickSetPopover(exerciseDraftId, set.id, "weightKg", event.currentTarget);
  };

  const handleMetricClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    onOpenQuickSetPopover(exerciseDraftId, set.id, activeMetricField, event.currentTarget);
  };

  return (
    <div
      className={[
        "liquid-divider flex items-center pe-2 py-1.5 transition-[background-color,border-color,opacity] gap-2 md:py-2",
        set.isCompleted ? "rounded-xl bg-success/10" : "",
        isDragging ? "opacity-30" : "opacity-100",
      ].join(" ")}
    >
      {!isSetEditMode ? (
        <button
          type="button"
          ref={(element) => setDragHandleRef?.(element)}
          {...(dragHandleProps ?? {})}
          className={[
            "inline-flex h-8 w-7 shrink-0 touch-none items-center justify-center rounded-full text-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300",
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
      ) : null}

      {isSetEditMode ? (
        <div className="w-20 shrink-0">
          <ExerciseSetTypeDropdown
            value={set.setType}
            setNumber={setNumber}
            onChange={handleSetTypeChange}
          />
        </div>
      ) : null}

      <div
        className={[
          "grid min-w-0 gap-1 md:gap-2",
          isSetEditMode ? "w-full max-w-56 grid-cols-2" : "flex-1 grid-cols-3",
        ].join(" ")}
      >
        <button
          type="button"
          onClick={handleWeightClick}
          className={[
            "liquid-input flex h-8 min-w-0 cursor-pointer items-center justify-center rounded-lg px-1 text-center text-sm font-extrabold tabular-nums md:h-9 md:px-2",
            set.isCompleted ? "border-success! bg-success! text-white shadow-none hover:bg-success!" : "",
          ].join(" ")}
          aria-label={`Set weight for set ${setNumber}`}
        >
          {getCompactSetValueText(set.weightKg)}
        </button>

        <button
          type="button"
          onClick={handleMetricClick}
          className={[
            "liquid-input flex h-8 min-w-0 cursor-pointer items-center justify-center rounded-lg px-1 text-center text-sm font-extrabold tabular-nums md:h-9 md:px-2",
            set.isCompleted ? "border-success! bg-success! text-white shadow-none hover:bg-success!" : "",
          ].join(" ")}
          aria-label={`Set ${isDurationEnabled ? "duration" : "reps"} for set ${setNumber}`}
        >
          {getCompactSetValueText(activeMetricValue)}
        </button>

        {!isSetEditMode ? (
          <span
            className={[
              "liquid-input flex h-8 min-w-0 items-center justify-center truncate rounded-lg px-1 text-center text-2xs font-extrabold text-secondary md:h-9 md:px-2 md:text-sm",
              set.isCompleted ? "border-success/60! bg-success/20! text-success" : "",
            ].join(" ")}
            title={`Last completed set: ${previousSetLabel}`}
          >
            {previousSetLabel}
          </span>
        ) : null}
      </div>

      {!isSetEditMode ? (
        <button
          type="button"
          onClick={handleCompletedChange}
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

      {isSetEditMode ? (
        <button
          type="button"
          onClick={handleRemoveClick}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-(--input-border) bg-(--glass-bg-input) text-danger transition hover:bg-red-100/20 hover:text-danger md:h-9 md:w-9"
          aria-label={`Remove set ${setNumber}`}
        >
          <LuTrash2 className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
