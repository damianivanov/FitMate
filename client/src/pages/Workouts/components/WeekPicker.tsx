import { useEffect, useRef } from "react";
import { tick } from "@/shared/utils/haptics";
import type { TrainingDay } from "../hooks/useTrainingWeek";

type WeekPickerProps = {
  days: TrainingDay[];
  selectedDate: string;
  onSelect: (date: string) => void;
};

export function WeekPicker({ days, selectedDate, onSelect }: WeekPickerProps) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const todayRef = useRef<HTMLButtonElement | null>(null);

  // The rail opens parked on today rather than at the oldest day it holds. Done by measuring
  // rather than by scrollIntoView, which also scrolls the page when the rail is off-screen.
  useEffect(() => {
    const rail = railRef.current;
    const todayButton = todayRef.current;

    if (!rail || !todayButton) {
      return;
    }

    const centreToday = () => {
      const railBounds = rail.getBoundingClientRect();
      const todayBounds = todayButton.getBoundingClientRect();
      const todayCentre =
        rail.scrollLeft + todayBounds.left - railBounds.left + todayBounds.width / 2;

      rail.scrollLeft = todayCentre - rail.clientWidth / 2;
    };

    const animationFrame = window.requestAnimationFrame(centreToday);
    const resizeObserver = new ResizeObserver(centreToday);
    resizeObserver.observe(rail);
    resizeObserver.observe(todayButton);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className="wk-week" ref={railRef} role="group" aria-label="Choose training day">
      {days.map((day) => {
        const isSelected = day.date === selectedDate;
        const className = [
          "wk-day",
          day.sessionCount > 0 ? "has-session" : "",
          isSelected ? "is-selected" : "",
          day.isToday ? "is-today" : "",
          day.isFuture ? "is-future" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <button
            key={day.date}
            ref={day.isToday ? todayRef : undefined}
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
            {/* The dot is the only thing on the rail carrying data — whether the day was
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
