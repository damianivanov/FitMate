import type { ChangeEvent } from "react";
import { LuArrowLeft, LuLoaderCircle, LuTimer, LuTrash2 } from "react-icons/lu";
import { formatElapsedTime } from "../utils/workoutDraft";

type WorkoutSessionHeaderProps = {
  title: string;
  elapsedSeconds: number;
  isWorkoutStarted: boolean;
  canDeleteWorkout: boolean;
  isDeletingWorkout: boolean;
  isSavingWorkout: boolean;
  onBackClick: () => void;
  onDeleteWorkout: () => void;
  onStartWorkout: () => void;
  onFinishWorkout: () => void;
  onTitleChange: (value: string) => void;
};

export function WorkoutSessionHeader({
  title,
  elapsedSeconds,
  isWorkoutStarted,
  canDeleteWorkout,
  isDeletingWorkout,
  isSavingWorkout,
  onBackClick,
  onDeleteWorkout,
  onStartWorkout,
  onFinishWorkout,
  onTitleChange,
}: WorkoutSessionHeaderProps) {
  const handleTitleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    onTitleChange(event.target.value);
  };
  const handlePrimaryActionClick = isWorkoutStarted ? onFinishWorkout : onStartWorkout;
  const primaryActionLabel = isWorkoutStarted
    ? (isSavingWorkout ? "Saving" : "Finish")
    : (isSavingWorkout ? "Starting" : "Start");

  return (
    <header className="liquid-page-header px-4 py-2 md:px-8 md:py-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBackClick}
          className="liquid-pill flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-primary-700 transition md:h-9 md:w-9"
          aria-label="Back to templates"
        >
          <LuArrowLeft className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1">
          <input
            type="text"
            value={title}
            onChange={handleTitleInputChange}
            className="w-full bg-transparent text-2xl text-center font-extrabold tracking-tight text-foreground outline-none md:text-xl"
            aria-label="Workout title"
          />
        </div>

        <span className="liquid-pill hidden h-8 shrink-0 items-center gap-2 rounded-full px-3 text-sm font-semibold text-secondary sm:inline-flex md:h-9">
          <LuTimer className="h-4 w-4 text-primary" />
          <span className="mono tabular-nums">{formatElapsedTime(elapsedSeconds)}</span>
        </span>

        {canDeleteWorkout ? (
          <button
            type="button"
            onClick={onDeleteWorkout}
            disabled={isDeletingWorkout || isSavingWorkout}
            className="liquid-pill inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-danger disabled:cursor-not-allowed disabled:opacity-60"
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
          className="liquid-primary-btn inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span>{primaryActionLabel}</span>
        </button>
      </div>
    </header>
  );
}
