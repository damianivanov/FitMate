import { formatDateOnly } from "@/shared/utils/dateOnly";
import { WEEKDAY_LABELS, type CalendarCell } from "@/shared/utils/monthGrid";
import { DAY_STATUS_CELL_CLASSES, DAY_STATUS_LABELS } from "@/shared/utils/programDisplay";
import { ProgramPlanDayType } from "@/types";
import type { ProgramPlanDayModel } from "@/types";

type ProgramCalendarGridProps = {
  cells: CalendarCell[];
  daysByKey: Map<string, ProgramPlanDayModel[]>;
  selectedKey: string | null;
  onSelectDay: (dayKey: string) => void;
};

const DAY_TYPE_BADGES: Partial<Record<ProgramPlanDayType, string>> = {
  [ProgramPlanDayType.Recovery]: "R",
  [ProgramPlanDayType.Deload]: "D",
  [ProgramPlanDayType.OptionalWorkout]: "?",
};

export function ProgramCalendarGrid({
  cells,
  daysByKey,
  selectedKey,
  onSelectDay,
}: ProgramCalendarGridProps) {
  return (
    <>
      <div className="cal-weekdays" aria-hidden="true">
        {WEEKDAY_LABELS.map((label, index) => (
          <span key={`${label}-${index}`}>{label}</span>
        ))}
      </div>

      <div className="cal-grid">
        {cells.map((cell) => {
          if (!cell.isCurrentMonth) {
            return (
              <div key={cell.dayKey} className="cal-day is-outside" aria-hidden="true">
                <span>{cell.dayOfMonth}</span>
              </div>
            );
          }

          const cellDays = daysByKey.get(cell.dayKey) ?? [];
          const primaryDay = cellDays[0] ?? null;
          const isSelected = cell.dayKey === selectedKey;

          const classes = ["cal-day"];
          if (primaryDay) {
            classes.push(DAY_STATUS_CELL_CLASSES[primaryDay.status]);
          }
          if (cell.isToday) {
            classes.push("is-today");
          }
          if (isSelected) {
            classes.push("is-selected");
          }

          const badge = primaryDay ? DAY_TYPE_BADGES[primaryDay.dayType] : undefined;
          const movedFrom =
            primaryDay?.originalScheduledDate &&
            primaryDay.originalScheduledDate !== primaryDay.scheduledDate
              ? primaryDay.originalScheduledDate
              : null;

          return (
            <button
              key={cell.dayKey}
              type="button"
              onClick={() => onSelectDay(cell.dayKey)}
              aria-pressed={isSelected}
              aria-label={
                primaryDay
                  ? `Day ${cell.dayOfMonth}: ${primaryDay.workoutTemplateName ?? "Program day"}, ${DAY_STATUS_LABELS[primaryDay.status]}${movedFrom ? `, moved from ${formatDateOnly(movedFrom)}` : ""}`
                  : `Day ${cell.dayOfMonth}, rest day`
              }
              className={classes.join(" ")}
            >
              <span>{cell.dayOfMonth}</span>
              {badge ? <em className="cal-day-badge">{badge}</em> : null}
              {cellDays.length > 1 ? <i aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
    </>
  );
}
