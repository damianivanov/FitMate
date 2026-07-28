import { LuArrowRight, LuCalendarClock, LuLoaderCircle, LuPlay } from "react-icons/lu";
import { OutlinedButton, PrimaryButton } from "@/shared/components";
import { formatDateOnly, formatDateOnlyLong } from "@/shared/utils/dateOnly";
import { DAY_STATUS_LABELS, DAY_TYPE_LABELS } from "@/shared/utils/programDisplay";
import { ProgramPlanDayStatus } from "@/types";
import type { ProgramPlanDayModel } from "@/types";

type ProgramDayDetailProps = {
  days: ProgramPlanDayModel[];
  busyDayId: number | null;
  startingDayId: number | null;
  onStart: (day: ProgramPlanDayModel) => void;
  onMove: (day: ProgramPlanDayModel) => void;
  onSkip: (day: ProgramPlanDayModel) => void;
  onRestore: (day: ProgramPlanDayModel) => void;
  onOpenWorkout: (day: ProgramPlanDayModel) => void;
};

const ACTIONABLE = [
  ProgramPlanDayStatus.Scheduled,
  ProgramPlanDayStatus.Missed,
  ProgramPlanDayStatus.Rescheduled,
];

export function ProgramDayDetail({
  days,
  busyDayId,
  startingDayId,
  onStart,
  onMove,
  onSkip,
  onRestore,
  onOpenWorkout,
}: ProgramDayDetailProps) {
  if (days.length === 0) {
    return (
      <section className="liquid-panel rounded-2xl px-5 py-6 text-center">
        <p className="text-sm font-semibold text-foreground">Rest day</p>
        <p className="mt-1 text-xs text-secondary">Nothing scheduled — recover well.</p>
      </section>
    );
  }

  return (
    <div className="grid gap-3">
      {days.map((day) => {
        const isBusy = busyDayId === day.id || startingDayId === day.id;
        const canStartMoveSkip = ACTIONABLE.includes(day.status);

        return (
          <section key={day.id} className="liquid-panel grid gap-3 rounded-2xl p-4">
            <div>
              <p className="text-sm font-bold text-foreground">
                {day.workoutTemplateName ?? DAY_TYPE_LABELS[day.dayType]}
              </p>
              <p className="mt-0.5 text-xs text-secondary">
                {formatDateOnlyLong(day.scheduledDate)} · {DAY_STATUS_LABELS[day.status]}
                {day.exerciseCount > 0 ? ` · ${day.exerciseCount} exercises` : ""}
                {day.estimatedDurationMinutes ? ` · ~${day.estimatedDurationMinutes} min` : ""}
              </p>
              {day.originalScheduledDate && day.originalScheduledDate !== day.scheduledDate ? (
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-(--color-warning)">
                  <LuCalendarClock className="h-3.5 w-3.5 shrink-0" />
                  Moved from {formatDateOnly(day.originalScheduledDate)}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {day.status === ProgramPlanDayStatus.Started ? (
                <PrimaryButton size="sm" onClick={() => onOpenWorkout(day)}>
                  <LuArrowRight className="h-4 w-4" />
                  Continue workout
                </PrimaryButton>
              ) : null}

              {day.status === ProgramPlanDayStatus.Completed ? (
                <OutlinedButton onClick={() => onOpenWorkout(day)}>View workout</OutlinedButton>
              ) : null}

              {day.status === ProgramPlanDayStatus.Skipped ||
              day.status === ProgramPlanDayStatus.Missed ? (
                <OutlinedButton onClick={() => onRestore(day)} disabled={isBusy}>
                  Restore
                </OutlinedButton>
              ) : null}

              {canStartMoveSkip ? (
                <>
                  <OutlinedButton onClick={() => onSkip(day)} disabled={isBusy}>
                    Skip
                  </OutlinedButton>
                  <OutlinedButton onClick={() => onMove(day)} disabled={isBusy}>
                    Move
                  </OutlinedButton>
                  <PrimaryButton size="sm" onClick={() => onStart(day)} disabled={isBusy}>
                    {startingDayId === day.id ? (
                      <LuLoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <LuPlay className="h-4 w-4" />
                    )}
                    Start
                  </PrimaryButton>
                </>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}
