import { Link } from "react-router";
import { LuDumbbell, LuRepeat2 } from "react-icons/lu";
import type { WorkoutCalendarDayModel } from "@/types";
import { formatMonthDuration, formatSelectedDayLabel, type CalendarCell } from "../utils/calendar";

type CalendarDayDetailProps = {
  selectedCell: CalendarCell | null;
  workouts: WorkoutCalendarDayModel[];
  isReusing: boolean;
  onReuse: (workout: WorkoutCalendarDayModel) => void;
  className?: string;
};

function formatWorkoutMeta(workout: WorkoutCalendarDayModel): string {
  const parts = [
    formatMonthDuration(workout.durationSeconds),
    `${workout.exerciseCount} exercise${workout.exerciseCount === 1 ? "" : "s"}`,
    `${workout.setCount} set${workout.setCount === 1 ? "" : "s"}`,
  ];
  if (workout.totalVolumeKg != null) {
    parts.push(`${Math.round(workout.totalVolumeKg).toLocaleString()} kg`);
  }

  return parts.join(" · ");
}

export function CalendarDayDetail({
  selectedCell,
  workouts,
  isReusing,
  onReuse,
  className,
}: CalendarDayDetailProps) {
  const count = workouts.length;

  return (
    <section className={className}>
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-base font-semibold text-foreground">
          {selectedCell ? formatSelectedDayLabel(selectedCell.date) : "No day selected"}
          {selectedCell?.isToday ? <span className="ml-2 text-xs font-normal text-secondary">Today</span> : null}
        </h2>
        {selectedCell ? (
          <span className="text-xs font-semibold text-secondary">
            {count > 0 ? `${count} session${count === 1 ? "" : "s"}` : "Rest day"}
          </span>
        ) : null}
      </div>

      {count > 0 ? (
        <div className="space-y-2.5">
          {workouts.map((workout) => (
            <article
              key={workout.workoutId}
              className="liquid-panel flex items-center gap-3 rounded-2xl p-3 sm:p-4"
            >
              <Link
                to={`/workouts/${workout.workoutId}/summary`}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-100/15 text-primary">
                  <LuDumbbell className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {workout.title.trim() || "Untitled Workout"}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-secondary">
                    {formatWorkoutMeta(workout)}
                  </span>
                </span>
              </Link>
              <button
                type="button"
                onClick={() => onReuse(workout)}
                disabled={isReusing}
                aria-label={`Reuse ${workout.title.trim() || "workout"}`}
                className="liquid-pill inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-60"
              >
                <LuRepeat2 className="h-4 w-4" />
              </button>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
