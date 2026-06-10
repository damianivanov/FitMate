import type { WorkoutCalendarDayModel } from "@/types";
import { WEEKDAY_LABELS, isFutureDate, type CalendarCell } from "../utils/calendar";

type CalendarGridProps = {
  cells: CalendarCell[];
  workoutsByDay: Map<string, WorkoutCalendarDayModel[]>;
  selectedKey: string | null;
  onSelectDay: (dayKey: string) => void;
};

const CELL_BASE_CLASS =
  "relative flex aspect-square min-h-11 items-center justify-center rounded-2xl text-sm transition";

function DayDots({ count, light }: { count: number; light: boolean }) {
  if (count <= 0) {
    return null;
  }

  return (
    <span className="absolute bottom-1.5 left-1/2 flex -translate-x-1/2 items-center gap-[3px]">
      {Array.from({ length: Math.min(count, 3) }).map((_, index) => (
        <span
          key={index}
          className={`h-[5px] w-[5px] rounded-full ${light ? "bg-white" : "bg-primary"}`}
        />
      ))}
    </span>
  );
}

export function CalendarGrid({ cells, workoutsByDay, selectedKey, onSelectDay }: CalendarGridProps) {
  return (
    <div className="liquid-panel rounded-3xl p-3 sm:p-4">
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="pb-1 text-center text-2xs font-semibold uppercase tracking-widest text-muted"
          >
            {label}
          </div>
        ))}

        {cells.map((cell) => {
          if (!cell.isCurrentMonth) {
            return (
              <div
                key={cell.dayKey}
                className={`${CELL_BASE_CLASS} text-(--text-disabled) opacity-50`}
                aria-hidden="true"
              >
                {cell.dayOfMonth}
              </div>
            );
          }

          if (isFutureDate(cell.date)) {
            return (
              <div key={cell.dayKey} className={`${CELL_BASE_CLASS} text-secondary`} aria-hidden="true">
                <span className="leading-none">{cell.dayOfMonth}</span>
              </div>
            );
          }

          const workouts = workoutsByDay.get(cell.dayKey) ?? [];
          const hasWorkout = workouts.length > 0;
          const isSelected = cell.dayKey === selectedKey;

          const classes = [CELL_BASE_CLASS, "cursor-pointer"];
          if (cell.isToday) {
            classes.push("bg-primary font-bold text-white shadow-[0_6px_18px_-4px_var(--primary-400)]");
          } else if (hasWorkout) {
            classes.push(
              "border border-primary-300/30 bg-primary-100/10 font-semibold text-foreground hover:bg-primary-100/20",
            );
          } else {
            classes.push("text-secondary hover:bg-primary-100/10");
          }
          if (isSelected) {
            classes.push(cell.isToday ? "ring-2 ring-inset ring-white/70" : "ring-2 ring-inset ring-primary-400");
          }

          return (
            <button
              key={cell.dayKey}
              type="button"
              onClick={() => onSelectDay(cell.dayKey)}
              aria-pressed={isSelected}
              aria-label={
                hasWorkout
                  ? `${workouts.length} workout${workouts.length === 1 ? "" : "s"} on day ${cell.dayOfMonth}`
                  : `Day ${cell.dayOfMonth}, no workouts`
              }
              className={classes.join(" ")}
            >
              <span className="leading-none">{cell.dayOfMonth}</span>
              <DayDots count={workouts.length} light={cell.isToday} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
