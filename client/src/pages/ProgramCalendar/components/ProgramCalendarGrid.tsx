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

const CELL_BASE_CLASS =
  "relative flex aspect-square min-h-11 items-center justify-center rounded-2xl text-sm transition-colors duration-200";

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

          const cellDays = daysByKey.get(cell.dayKey) ?? [];
          const primaryDay = cellDays[0] ?? null;
          const isSelected = cell.dayKey === selectedKey;

          const classes = [CELL_BASE_CLASS, "cursor-pointer"];
          if (primaryDay) {
            classes.push(DAY_STATUS_CELL_CLASSES[primaryDay.status]);
          } else {
            classes.push("text-secondary hover:bg-primary-100/10");
          }
          if (cell.isToday) {
            classes.push("ring-2 ring-inset ring-primary-400");
          }
          if (isSelected) {
            classes.push("outline-2 outline-offset-2 outline-primary");
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
              <span className="leading-none">{cell.dayOfMonth}</span>
              {badge ? (
                <span className="absolute right-1 top-1 text-2xs font-bold opacity-80">{badge}</span>
              ) : null}
              {cellDays.length > 1 ? (
                <span className="absolute bottom-1.5 left-1/2 h-[5px] w-[5px] -translate-x-1/2 rounded-full bg-current" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
