import { LuChevronLeft, LuChevronRight } from "react-icons/lu";
import { NativeCard } from "@/shared/components";
import type { WorkoutCalendarDayModel } from "@/types";
import { MONTH_LABELS, WEEKDAY_LABELS, isFutureDate, type CalendarCell } from "../utils/calendar";

type CalendarGridProps = {
  year: number;
  month: number;
  cells: CalendarCell[];
  workoutsByDay: Map<string, WorkoutCalendarDayModel[]>;
  selectedKey: string | null;
  onSelectDay: (dayKey: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onOpenPicker: () => void;
};

export function CalendarGrid({
  year,
  month,
  cells,
  workoutsByDay,
  selectedKey,
  onSelectDay,
  onPrevMonth,
  onNextMonth,
  onOpenPicker,
}: CalendarGridProps) {
  return (
    <NativeCard className="cal-card">
      <div className="cal-head">
        <button type="button" onClick={onPrevMonth} aria-label="Previous month">
          <LuChevronLeft className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onOpenPicker}
          className="cal-head-trigger cursor-pointer"
          aria-label="Choose month and year"
        >
          <span className="cal-head-year">{year}</span>
          <b className="cal-head-month">{MONTH_LABELS[month - 1]}</b>
        </button>

        <button type="button" onClick={onNextMonth} aria-label="Next month">
          <LuChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="cal-weekdays" aria-hidden="true">
        {WEEKDAY_LABELS.map((label, index) => (
          <span key={`${label}-${index}`}>{label}</span>
        ))}
      </div>

      <div className="cal-grid">
        {cells.map((cell) => {
          const workouts = workoutsByDay.get(cell.dayKey) ?? [];
          const isFuture = isFutureDate(cell.date);
          const isSelectable = cell.isCurrentMonth && !isFuture;

          const className = [
            "cal-day",
            !cell.isCurrentMonth && "is-outside",
            isFuture && "is-future",
            cell.isToday && "is-today",
            cell.dayKey === selectedKey && "is-selected",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={cell.dayKey}
              type="button"
              className={className}
              disabled={!isSelectable}
              aria-pressed={cell.dayKey === selectedKey}
              aria-label={
                workouts.length > 0
                  ? `${workouts.length} workout${workouts.length === 1 ? "" : "s"} on day ${cell.dayOfMonth}`
                  : `Day ${cell.dayOfMonth}, no workouts`
              }
              onClick={() => onSelectDay(cell.dayKey)}
            >
              <span>{cell.dayOfMonth}</span>
              {workouts.length > 0 ? <i aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
    </NativeCard>
  );
}
