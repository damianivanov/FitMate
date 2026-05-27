import { LuCalendar, LuClock, LuDumbbell, LuLoaderCircle, LuTrash2 } from "react-icons/lu";
import { normalizeUtcIsoString } from "@/lib/helpers";
import type { Workout, WorkoutExercise } from "@/types";

type WorkoutListItemProps = {
  workout: Workout;
  isDeleting: boolean;
  onDelete: (workout: Workout) => void;
  onOpen: (workoutId: number) => void;
};

const WORKOUT_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function getWorkoutExercises(workout: Workout): WorkoutExercise[] {
  return workout.groups
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .flatMap((group) =>
      group.exercises
        .slice()
        .sort((left, right) => left.orderIndex - right.orderIndex));
}

function formatWorkoutDate(value: string): string {
  const date = new Date(normalizeUtcIsoString(value));
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return WORKOUT_DATE_FORMATTER.format(date);
}

function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null) {
    return "In progress";
  }

  const boundedSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(boundedSeconds / 3600);
  const minutes = Math.floor((boundedSeconds % 3600) / 60);

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${minutes}m`;
}

function getWorkoutTitle(workout: Workout): string {
  return workout.title.trim() || "Untitled Workout";
}

function getExerciseDisplayName(exercise: WorkoutExercise): string {
  return exercise.exerciseName || `Exercise #${exercise.exerciseId}`;
}

export function WorkoutListItem({
  workout,
  isDeleting,
  onDelete,
  onOpen,
}: WorkoutListItemProps) {
  const workoutExercises = getWorkoutExercises(workout);
  const imageExercises = workoutExercises.filter((exercise) => exercise.exerciseImageUrl);
  const visibleExercises = imageExercises.slice(0, 6);
  const hiddenExerciseCount = Math.max(0, imageExercises.length - visibleExercises.length);
  const exerciseNames = workoutExercises.map(getExerciseDisplayName);
  const startedAtLabel = formatWorkoutDate(workout.startedAt);
  const durationLabel = formatDuration(workout.durationSeconds);
  const workoutTitle = getWorkoutTitle(workout);

  const handleWorkoutOpen = () => {
    onOpen(workout.id);
  };

  const handleWorkoutDelete = () => {
    onDelete(workout);
  };

  return (
    <article className="liquid-panel w-full rounded-2xl p-4 transition hover:-translate-y-0.5 hover:border-primary-300/60">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={handleWorkoutOpen}
          className="min-w-0 flex-1 cursor-pointer text-left"
          aria-label={`Open ${workoutTitle}`}
        >
          <h2 className="truncate text-base font-bold text-foreground">{workoutTitle}</h2>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          <span className="liquid-primary-chip inline-flex h-9 items-center rounded-full px-3 text-xs font-semibold">
            {workout.exerciseCount} exercise{workout.exerciseCount === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            onClick={handleWorkoutDelete}
            disabled={isDeleting}
            className="liquid-pill inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-danger disabled:cursor-not-allowed disabled:opacity-60"
            aria-label={`Delete ${workoutTitle}`}
            title="Delete"
          >
            {isDeleting ? (
              <LuLoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <LuTrash2 className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={handleWorkoutOpen}
        className="mt-4 block w-full cursor-pointer text-left"
        aria-label={`Open ${workoutTitle}`}
      >
        {workoutExercises.length > 0 ? (
          <div className="space-y-2">
            {visibleExercises.length > 0 ? (
              <div className="flex flex-wrap items-center gap-0 sm:gap-2">
                {visibleExercises.map((exercise) => (
                  <span
                    key={exercise.id}
                    className="inline-flex h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-(--glass-divider) bg-(--glass-bg-soft) first:ml-0"
                  >
                    <img
                      src={exercise.exerciseImageUrl}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </span>
                ))}
                {hiddenExerciseCount > 0 ? (
                  <span className="-ml-2 inline-flex h-11 min-w-11 items-center justify-center rounded-xl border border-(--glass-divider) bg-(--glass-bg-soft) px-2 text-xs font-semibold text-secondary">
                    +{hiddenExerciseCount}
                  </span>
                ) : null}
              </div>
            ) : null}
            <p className="line-clamp-2 text-xs leading-snug text-secondary">
              {exerciseNames.join(", ")}
            </p>
          </div>
        ) : null}

        <div className="mt-4 flex min-w-0 items-center gap-3 overflow-hidden text-xs text-secondary sm:gap-4">
          <span className="inline-flex shrink-0 items-center gap-1.5">
            <LuDumbbell className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="whitespace-nowrap">
              {workout.setCount} set{workout.setCount === 1 ? "" : "s"}
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5">
            <LuClock className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="whitespace-nowrap">{durationLabel}</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5">
            <LuCalendar className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="whitespace-nowrap">{startedAtLabel}</span>
          </span>
        </div>
      </button>
    </article>
  );
}
