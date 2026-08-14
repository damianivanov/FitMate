import type { ChangeEvent } from "react";
import { LuArrowLeft, LuChevronDown, LuLoaderCircle, LuTimer, LuTrash2 } from "react-icons/lu";
import { formatElapsedTime } from "../utils/workoutDraft";
import { WorkoutHeaderLeadingAction } from "./workoutSessionHeaderActions";

type WorkoutSessionHeaderProps = {
  title: string;
  elapsedSeconds: number;
  isWorkoutStarted: boolean;
  canDeleteWorkout: boolean;
  isDeletingWorkout: boolean;
  isSavingWorkout: boolean;
  leadingAction?: WorkoutHeaderLeadingAction;
  onBackClick: () => void;
  onDeleteWorkout: () => void;
  onStartWorkout: () => void;
  onFinishWorkout: () => void;
  onTitleChange: (value: string) => void;
  onTitleCommit: () => void;
};

export function WorkoutSessionHeader({
  title,
  elapsedSeconds,
  isWorkoutStarted,
  canDeleteWorkout,
  isDeletingWorkout,
  isSavingWorkout,
  leadingAction = WorkoutHeaderLeadingAction.Back,
  onBackClick,
  onDeleteWorkout,
  onStartWorkout,
  onFinishWorkout,
  onTitleChange,
  onTitleCommit,
}: WorkoutSessionHeaderProps) {
  const isMinimizeAction = leadingAction === WorkoutHeaderLeadingAction.Minimize;
  const handleTitleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    onTitleChange(event.target.value);
  };

  const handleTitleInputBlur = () => {
    onTitleCommit();
  };

  const handlePrimaryActionClick = isWorkoutStarted ? onFinishWorkout : onStartWorkout;
  const primaryActionLabel = isWorkoutStarted
    ? (isSavingWorkout ? "Saving" : "Finish")
    : (isSavingWorkout ? "Starting" : "Start");

  return (
    <header className="wb-header">
      <button
        type="button"
        onClick={onBackClick}
        className="app-round-btn liquid-press"
        aria-label={isMinimizeAction ? "Minimize workout" : "Back to templates"}
      >
        {isMinimizeAction ? (
          <LuChevronDown className="h-5 w-5" />
        ) : (
          <LuArrowLeft className="h-5 w-5" />
        )}
      </button>

      <input
        type="text"
        value={title}
        onChange={handleTitleInputChange}
        onBlur={handleTitleInputBlur}
        className="wb-title"
        aria-label="Workout title"
      />

      <div className="wb-header-actions">
        {isWorkoutStarted ? (
          <span className="wb-elapsed">
            <LuTimer className="h-4 w-4" />
            <b className="mono">{formatElapsedTime(elapsedSeconds)}</b>
          </span>
        ) : null}

        {canDeleteWorkout ? (
          <button
            type="button"
            onClick={onDeleteWorkout}
            disabled={isDeletingWorkout || isSavingWorkout}
            className="bd-discard"
            aria-label="Delete workout"
            title="Delete workout"
          >
            {isDeletingWorkout ? (
              <LuLoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <LuTrash2 className="h-4 w-4" />
            )}
          </button>
        ) : null}

        <button
          type="button"
          onClick={handlePrimaryActionClick}
          disabled={isSavingWorkout || isDeletingWorkout}
          className="native-header-save"
        >
          {primaryActionLabel}
        </button>
      </div>
    </header>
  );
}
