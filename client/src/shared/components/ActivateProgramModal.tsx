import { LuCalendarCheck } from "react-icons/lu";
import { formatDateOnly } from "@/shared/utils/dateOnly";
import {
  SCHEDULE_TYPE_LABELS,
  TRAINING_GOAL_LABELS,
  WEEKDAY_NAMES,
  estimateTotalWorkouts,
  formatPlanDuration,
} from "@/shared/utils/programDisplay";
import { ProgramPlanDayType, ProgramScheduleType } from "@/types";
import type { ProgramPlanModel } from "@/types";
import { OutlinedButton, PrimaryButton } from "./Buttons";
import { Modal } from "./Modal";

type ActivateProgramModalProps = {
  isOpen: boolean;
  plan: ProgramPlanModel | null;
  /** Only known when arriving from the builder (custom-calendar drafts). */
  customDayCount?: number;
  isActivating: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

type ScheduleRow = { label: string; value: string };

function buildScheduleRows(plan: ProgramPlanModel, customDayCount?: number): ScheduleRow[] {
  const sortedRules = [...plan.scheduleRules].sort(
    (left, right) => left.orderIndex - right.orderIndex,
  );

  if (plan.scheduleType === ProgramScheduleType.FixedWeekdays) {
    return sortedRules
      .filter((rule) => rule.dayType !== ProgramPlanDayType.Rest)
      .map((rule) => ({
        label: rule.dayOfWeek != null ? WEEKDAY_NAMES[rule.dayOfWeek] : "Day",
        value: rule.workoutTemplateName ?? "Workout",
      }));
  }

  if (plan.scheduleType === ProgramScheduleType.Rotation) {
    return [...sortedRules]
      .sort((left, right) => (left.rotationDayIndex ?? 0) - (right.rotationDayIndex ?? 0))
      .map((rule) => ({
        label: `Day ${rule.rotationDayIndex}`,
        value:
          rule.dayType === ProgramPlanDayType.Rest
            ? "Rest"
            : (rule.workoutTemplateName ?? "Workout"),
      }));
  }

  return [
    {
      label: "Workout days",
      value: customDayCount != null ? `${customDayCount} scheduled` : "Custom calendar",
    },
  ];
}

export function ActivateProgramModal({
  isOpen,
  plan,
  customDayCount,
  isActivating,
  onCancel,
  onConfirm,
}: ActivateProgramModalProps) {
  if (!plan) {
    return null;
  }

  const totalWorkouts = estimateTotalWorkouts(plan, customDayCount);
  const scheduleRows = buildScheduleRows(plan, customDayCount);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title="Activate program"
      titleIcon={<LuCalendarCheck className="h-5 w-5 text-primary" />}
      maxWidth="md"
    >
      <div className="grid gap-4 p-5">
        <div>
          <p className="text-base font-bold text-foreground">{plan.name}</p>
          <p className="mt-0.5 text-xs text-secondary">
            {TRAINING_GOAL_LABELS[plan.goal]} · {SCHEDULE_TYPE_LABELS[plan.scheduleType]}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-2xl bg-(--glass-bg-soft) px-3 py-2">
            <dt className="text-2xs font-semibold uppercase tracking-widest text-muted">Starts</dt>
            <dd className="font-semibold text-foreground">{formatDateOnly(plan.startDate)}</dd>
          </div>
          <div className="rounded-2xl bg-(--glass-bg-soft) px-3 py-2">
            <dt className="text-2xs font-semibold uppercase tracking-widest text-muted">Duration</dt>
            <dd className="font-semibold text-foreground">{formatPlanDuration(plan)}</dd>
          </div>
          <div className="rounded-2xl bg-(--glass-bg-soft) px-3 py-2">
            <dt className="text-2xs font-semibold uppercase tracking-widest text-muted">Per week</dt>
            <dd className="font-semibold text-foreground">
              {plan.targetWorkoutsPerWeek} workout{plan.targetWorkoutsPerWeek === 1 ? "" : "s"}
            </dd>
          </div>
          <div className="rounded-2xl bg-(--glass-bg-soft) px-3 py-2">
            <dt className="text-2xs font-semibold uppercase tracking-widest text-muted">Total</dt>
            <dd className="font-semibold text-foreground">
              {totalWorkouts != null ? `${totalWorkouts} workouts` : "Ongoing"}
            </dd>
          </div>
        </dl>

        <div className="overflow-hidden rounded-2xl border border-(--glass-divider)">
          {scheduleRows.map((row, index) => (
            <div
              key={`${row.label}-${index}`}
              className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm ${index > 0 ? "border-t border-(--glass-divider)" : ""}`}
            >
              <span className="shrink-0 font-semibold text-secondary">{row.label}</span>
              <span className="truncate font-semibold text-foreground">{row.value}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-secondary">
          Activating generates your day-by-day calendar. You can pause or cancel the program at any
          time.
        </p>

        <footer className="flex items-center justify-end gap-3">
          <OutlinedButton onClick={onCancel} disabled={isActivating}>
            Cancel
          </OutlinedButton>
          <PrimaryButton onClick={onConfirm} disabled={isActivating}>
            {isActivating ? "Activating..." : "Activate program"}
          </PrimaryButton>
        </footer>
      </div>
    </Modal>
  );
}
