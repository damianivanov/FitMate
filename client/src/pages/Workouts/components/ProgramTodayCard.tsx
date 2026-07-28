import { useCallback, useState } from "react";
import { LuArrowRight, LuCalendarPlus, LuLoaderCircle, LuMoon, LuPlay } from "react-icons/lu";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";
import { unwrap } from "@/lib/unwrap";
import { programPlanService } from "@/services/programPlanService";
import { MoveProgramDayModal, OutlinedButton, PrimaryButton } from "@/shared/components";
import { useStartProgramDay } from "@/shared/hooks/useStartProgramDay";
import { formatDateOnly, todayDateOnlyString } from "@/shared/utils/dateOnly";
import { useActiveWorkoutStore } from "@/stores/activeWorkoutStore";
import { ProgramPlanDayStatus } from "@/types";
import type { ProgramPlanDayModel, ProgramTodayModel } from "@/types";
import { useProgramToday } from "../hooks/useProgramToday";

type TodayVariant =
  | { kind: "continue"; day: ProgramPlanDayModel }
  | { kind: "missed"; day: ProgramPlanDayModel }
  | { kind: "today"; day: ProgramPlanDayModel }
  | { kind: "done"; next: ProgramPlanDayModel | null }
  | { kind: "rest"; next: ProgramPlanDayModel | null }
  | { kind: "noPlan" };

/** Priority ladder: started > missed > planned today > done/rest > no plan. */
function resolveVariant(model: ProgramTodayModel): TodayVariant {
  if (!model.hasActiveProgram) {
    return { kind: "noPlan" };
  }

  if (model.today?.status === ProgramPlanDayStatus.Started && model.today.startedWorkoutId) {
    return { kind: "continue", day: model.today };
  }

  if (model.missedWorkout) {
    return { kind: "missed", day: model.missedWorkout };
  }

  if (model.today && model.today.status === ProgramPlanDayStatus.Completed) {
    return { kind: "done", next: model.nextWorkout ?? null };
  }

  if (model.today) {
    return { kind: "today", day: model.today };
  }

  return { kind: "rest", next: model.nextWorkout ?? null };
}

export function ProgramTodayCard() {
  const navigate = useNavigate();
  const isMobile = useIsMobileViewport();
  const { todayModel, isLoading, reload } = useProgramToday();
  const { startingDayId, startProgramDay } = useStartProgramDay(reload);
  const [dayPendingMove, setDayPendingMove] = useState<ProgramPlanDayModel | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);

  const continueWorkout = useCallback(
    (day: ProgramPlanDayModel) => {
      if (!day.startedWorkoutId) {
        return;
      }

      if (isMobile) {
        useActiveWorkoutStore.getState().openExistingWorkout(day.startedWorkoutId);
      } else {
        navigate(`/workouts/${day.startedWorkoutId}`);
      }
    },
    [isMobile, navigate],
  );

  const skip = useCallback(
    async (day: ProgramPlanDayModel) => {
      if (isSkipping) {
        return;
      }

      setIsSkipping(true);

      try {
        const response = await programPlanService.skipDay(day.id);
        unwrap(response.data, "Unable to skip workout.");
        toast.success("Workout skipped.");
        reload();
      } catch (skipError) {
        toast.error(skipError instanceof Error ? skipError.message : "Unable to skip workout.");
      } finally {
        setIsSkipping(false);
      }
    },
    [isSkipping, reload],
  );

  const confirmMove = useCallback(
    async (newDate: string) => {
      if (!dayPendingMove || isMoving) {
        return;
      }

      setIsMoving(true);

      try {
        const response = await programPlanService.moveDay(dayPendingMove.id, { newDate });
        unwrap(response.data, "Unable to move workout.");
        toast.success("Workout moved.");
        setDayPendingMove(null);
        reload();
      } catch (moveError) {
        toast.error(moveError instanceof Error ? moveError.message : "Unable to move workout.");
      } finally {
        setIsMoving(false);
      }
    },
    [dayPendingMove, isMoving, reload],
  );

  if (isLoading || !todayModel) {
    return null;
  }

  const variant = resolveVariant(todayModel);

  return (
    <>
      <section className="liquid-panel rounded-2xl p-4 md:rounded-lg">
        <p className="text-2xs font-semibold uppercase tracking-widest text-muted">
          {todayModel.programName ?? "Training program"}
        </p>

        {variant.kind === "continue" ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-foreground">
                {variant.day.workoutTemplateName ?? "Workout"} in progress
              </p>
              <p className="text-xs text-secondary">Pick up where you left off.</p>
            </div>
            <PrimaryButton size="sm" onClick={() => continueWorkout(variant.day)}>
              <LuArrowRight className="h-4 w-4" />
              Continue
            </PrimaryButton>
          </div>
        ) : null}

        {variant.kind === "missed" ? (
          <div className="mt-2 grid gap-3">
            <div>
              <p className="text-base font-bold text-foreground">
                You missed {variant.day.workoutTemplateName ?? "a workout"}
              </p>
              <p className="text-xs text-secondary">
                Planned for {formatDateOnly(variant.day.scheduledDate)}. Train it today and the rest
                of your plan shifts forward — nothing gets dropped.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <OutlinedButton onClick={() => void skip(variant.day)} disabled={isSkipping}>
                Skip
              </OutlinedButton>
              <OutlinedButton onClick={() => setDayPendingMove(variant.day)}>Move</OutlinedButton>
              <PrimaryButton
                size="sm"
                onClick={() => void startProgramDay(variant.day.id)}
                disabled={startingDayId !== null}
              >
                {startingDayId === variant.day.id ? (
                  <LuLoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <LuPlay className="h-4 w-4" />
                )}
                Train today
              </PrimaryButton>
            </div>
          </div>
        ) : null}

        {variant.kind === "today" ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-foreground">
                {variant.day.workoutTemplateName ?? "Today's workout"}
              </p>
              <p className="text-xs text-secondary">
                {variant.day.exerciseCount > 0
                  ? `${variant.day.exerciseCount} exercises`
                  : "Today's session"}
                {variant.day.estimatedDurationMinutes
                  ? ` · ~${variant.day.estimatedDurationMinutes} min`
                  : ""}
              </p>
            </div>
            <PrimaryButton
              size="sm"
              onClick={() => void startProgramDay(variant.day.id)}
              disabled={startingDayId !== null}
            >
              {startingDayId === variant.day.id ? (
                <LuLoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <LuPlay className="h-4 w-4" />
              )}
              Start
            </PrimaryButton>
          </div>
        ) : null}

        {variant.kind === "done" || variant.kind === "rest" ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-base font-bold text-foreground">
                {variant.kind === "done" ? (
                  "Workout complete"
                ) : (
                  <>
                    <LuMoon className="h-4 w-4 text-primary" />
                    Rest day
                  </>
                )}
              </p>
              <p className="text-xs text-secondary">
                {variant.next
                  ? `Next: ${variant.next.workoutTemplateName ?? "Workout"} on ${formatDateOnly(variant.next.scheduledDate)}`
                  : "No upcoming workouts scheduled."}
              </p>
            </div>
          </div>
        ) : null}

        {variant.kind === "noPlan" ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-base font-bold text-foreground">Know what to train, every day</p>
              <p className="text-xs text-secondary">
                Build a program from your templates and get a daily plan.
              </p>
            </div>
            <PrimaryButton size="sm" onClick={() => navigate("/program/new")}>
              <LuCalendarPlus className="h-4 w-4" />
              Create a plan
            </PrimaryButton>
          </div>
        ) : null}
      </section>

      <MoveProgramDayModal
        isOpen={dayPendingMove !== null}
        day={dayPendingMove}
        minDate={todayDateOnlyString()}
        isMoving={isMoving}
        onCancel={() => {
          if (!isMoving) {
            setDayPendingMove(null);
          }
        }}
        onConfirm={(newDate) => void confirmMove(newDate)}
      />
    </>
  );
}
