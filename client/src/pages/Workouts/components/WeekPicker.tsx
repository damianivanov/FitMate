import { tick } from "@/shared/utils/haptics";
import type { TrainingDay } from "../hooks/useTrainingWeek";

type WeekPickerProps = {
  days: TrainingDay[];
  selectedDate: string;
  onSelect: (date: string) => void;
};

export function WeekPicker({ days, selectedDate, onSelect }: WeekPickerProps) {
  return (
    <div className="wk-week" role="group" aria-label="Choose training day">
      {days.map((day) => {
        const isSelected = day.date === selectedDate;
        const className = [
          "wk-day",
          isSelected ? "is-selected" : "",
          day.isToday ? "is-today" : "",
          day.isFuture ? "is-future" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <button
            key={day.date}
            type="button"
            className={className}
            aria-pressed={isSelected}
            onClick={() => {
              tick();
              onSelect(day.date);
            }}
          >
            <span aria-hidden="true">{day.initial}</span>
            <b>{day.dayOfMonth}</b>
            {/* The dot is the only thing on the strip carrying data — whether the day was
                trained. Drawn for every day so the row keeps its rhythm, lit only when it was. */}
            <i className={day.sessionCount > 0 ? "is-trained" : ""} aria-hidden="true" />
            <span className="sr-only">
              {day.sessionCount > 0
                ? `${day.sessionCount} session${day.sessionCount === 1 ? "" : "s"}`
                : "No sessions"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
