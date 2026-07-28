import { WEEKDAY_NAMES } from "@/shared/utils/programDisplay";
import { ProgramPlanDayType, ProgramScheduleType } from "@/types";
import type { ProgramPlanModel } from "@/types";

type ScheduleSummaryProps = {
  plan: ProgramPlanModel;
};

export function ScheduleSummary({ plan }: ScheduleSummaryProps) {
  if (plan.scheduleType === ProgramScheduleType.CustomCalendar) {
    return (
      <p className="text-sm text-secondary">
        Custom calendar — open the program calendar to see every scheduled day.
      </p>
    );
  }

  const rows =
    plan.scheduleType === ProgramScheduleType.FixedWeekdays
      ? [...plan.scheduleRules]
          .sort((left, right) => left.orderIndex - right.orderIndex)
          .filter((rule) => rule.dayType !== ProgramPlanDayType.Rest)
          .map((rule) => ({
            key: `w-${rule.id}`,
            label: rule.dayOfWeek != null ? WEEKDAY_NAMES[rule.dayOfWeek] : "Day",
            value: rule.workoutTemplateName ?? "Workout",
          }))
      : [...plan.scheduleRules]
          .sort((left, right) => (left.rotationDayIndex ?? 0) - (right.rotationDayIndex ?? 0))
          .map((rule) => ({
            key: `r-${rule.id}`,
            label: `Day ${rule.rotationDayIndex}`,
            value:
              rule.dayType === ProgramPlanDayType.Rest
                ? "Rest"
                : (rule.workoutTemplateName ?? "Workout"),
          }));

  return (
    <div className="overflow-hidden rounded-2xl border border-(--glass-divider)">
      {rows.map((row, index) => (
        <div
          key={row.key}
          className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm ${index > 0 ? "border-t border-(--glass-divider)" : ""}`}
        >
          <span className="shrink-0 font-semibold text-secondary">{row.label}</span>
          <span className="truncate font-semibold text-foreground">{row.value}</span>
        </div>
      ))}
    </div>
  );
}
