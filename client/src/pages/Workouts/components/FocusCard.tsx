import { useCallback, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import {
  LuCalendarDays,
  LuCalendarPlus,
  LuLoaderCircle,
  LuMoon,
  LuPlay,
  LuSkipForward,
  LuZap,
} from "react-icons/lu";
import { toast } from "sonner";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";
import { unwrap } from "@/lib/unwrap";
import { programPlanService } from "@/services/programPlanService";
import { ActionMenu, MoveProgramDayModal, type ActionMenuItem } from "@/shared/components";
import { useStartProgramDay } from "@/shared/hooks/useStartProgramDay";
import { formatDateOnly, todayDateOnlyString } from "@/shared/utils/dateOnly";
import { tick } from "@/shared/utils/haptics";
import { useActiveWorkoutStore } from "@/stores/activeWorkoutStore";
import { ProgramPlanDayStatus } from "@/types";
import type { ProgramPlanDayModel, ProgramTodayModel, Workout } from "@/types";

type FocusTone = "live" | "done" | "next" | "idle";

type FocusFact = { value: string; unit: string };

type FocusAction = {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  isBusy?: boolean;
};

type Focus = {
  label: string;
  tone: FocusTone;
  caption: string;
  title: ReactNode;
  ring: { completed: number; total: number } | null;
  facts: FocusFact[];
  action: FocusAction | null;
  menuItems: ActionMenuItem[];
};

type FocusCardProps = {
  todayModel: ProgramTodayModel | null;
  isProgramLoading: boolean;
  workouts: Workout[];
  selectedDate: string;
  isTodaySelected: boolean;
  selectedSessions: Workout[];
  onOpenWorkout: (workout: Workout) => void;
  onReloadProgram: () => void;
};

function countSets(workout: Workout): { completed: number; total: number } {
  let completed = 0;
  let total = 0;

  for (const group of workout.groups) {
    for (const exercise of group.exercises) {
      for (const set of exercise.sets) {
        total += 1;

        if (set.isCompleted) {
          completed += 1;
        }
      }
    }
  }

  return { completed, total: total || workout.setCount };
}

function formatVolume(totalKg: number): FocusFact | null {
  if (totalKg <= 0) {
    return null;
  }

  return totalKg >= 1000
    ? { value: (totalKg / 1000).toFixed(1), unit: "tons" }
    : { value: String(Math.round(totalKg)), unit: "kg" };
}

function formatMinutes(seconds: number | null | undefined): FocusFact | null {
  if (seconds == null || seconds <= 0) {
    return null;
  }

  return { value: String(Math.max(1, Math.round(seconds / 60))), unit: "min" };
}

function sessionFacts(workout: Workout): FocusFact[] {
  return [
    formatMinutes(workout.durationSeconds),
    formatVolume(workout.totalVolumeKg ?? 0),
    { value: String(workout.exerciseCount), unit: workout.exerciseCount === 1 ? "exercise" : "exercises" },
  ].filter((fact): fact is FocusFact => fact != null);
}

function SetRing({ completed, total }: { completed: number; total: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? Math.min(1, completed / total) : 0;

  return (
    <div className="wk-ring" role="img" aria-label={`${completed} of ${total} sets complete`}>
      <svg viewBox="0 0 86 86" aria-hidden="true">
        <circle className="wk-ring-track" cx="43" cy="43" r={radius} />
        <circle
          className="wk-ring-value"
          cx="43"
          cy="43"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
        />
      </svg>
      <span aria-hidden="true">
        <b>{completed}</b>
        <small>/{total}</small>
      </span>
    </div>
  );
}

export function FocusCard({
  todayModel,
  isProgramLoading,
  workouts,
  selectedDate,
  isTodaySelected,
  selectedSessions,
  onOpenWorkout,
  onReloadProgram,
}: FocusCardProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobileViewport();
  const { startingDayId, startProgramDay } = useStartProgramDay(onReloadProgram);
  const [dayPendingMove, setDayPendingMove] = useState<ProgramPlanDayModel | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);

  const continueWorkout = useCallback(
    (workoutId: number) => {
      if (isMobile) {
        useActiveWorkoutStore.getState().openExistingWorkout(workoutId);
        return;
      }

      navigate(`/workouts/${workoutId}`);
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
        onReloadProgram();
      } catch (skipError) {
        toast.error(skipError instanceof Error ? skipError.message : "Unable to skip workout.");
      } finally {
        setIsSkipping(false);
      }
    },
    [isSkipping, onReloadProgram],
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
        onReloadProgram();
      } catch (moveError) {
        toast.error(moveError instanceof Error ? moveError.message : "Unable to move workout.");
      } finally {
        setIsMoving(false);
      }
    },
    [dayPendingMove, isMoving, onReloadProgram],
  );

  const scheduleMenu = (day: ProgramPlanDayModel): ActionMenuItem[] => [
    {
      key: "move",
      label: "Move to another day",
      icon: <LuCalendarDays className="h-4 w-4 shrink-0" />,
      onSelect: () => setDayPendingMove(day),
    },
    {
      key: "skip",
      label: "Skip this workout",
      icon: <LuSkipForward className="h-4 w-4 shrink-0" />,
      onSelect: () => void skip(day),
      disabled: isSkipping,
      variant: "danger",
    },
  ];

  const startAction = (day: ProgramPlanDayModel, label: string): FocusAction => ({
    label,
    icon:
      startingDayId === day.id ? (
        <LuLoaderCircle className="h-4 w-4 animate-spin" />
      ) : (
        <LuPlay className="h-4 w-4" fill="currentColor" />
      ),
    onClick: () => void startProgramDay(day.id),
    isBusy: startingDayId !== null,
  });

  const resolveFocus = (): Focus | null => {
    // Nothing is claimed until the plan has answered. Rendering the no-program promo while
    // the request is still open would flash an advert at people who do have a program.
    if (isTodaySelected && isProgramLoading) {
      return null;
    }

    // Off today the card reports that date's own history instead of the plan: the program
    // endpoint only speaks for today, next and missed, and inventing a denominator for an
    // arbitrary day would be a figure the app cannot stand behind.
    if (!isTodaySelected) {
      const session = selectedSessions[0] ?? null;

      if (session) {
        const extra = selectedSessions.length - 1;

        return {
          label: session.finishedAt ? "Completed" : "In progress",
          tone: session.finishedAt ? "done" : "live",
          caption: extra > 0 ? `${selectedSessions.length} sessions logged` : "Session logged",
          title: session.title.trim() || "Untitled workout",
          ring: countSets(session),
          facts: sessionFacts(session),
          action: {
            label: session.finishedAt ? "View summary" : "Continue workout",
            icon: <LuPlay className="h-4 w-4" fill="currentColor" />,
            onClick: () => onOpenWorkout(session),
          },
          menuItems: [],
        };
      }

      const next = todayModel?.nextWorkout;

      if (next && next.scheduledDate === selectedDate) {
        return {
          label: "Up next",
          tone: "next",
          caption: "Scheduled focus",
          title: next.workoutTemplateName ?? "Workout",
          ring: null,
          facts: [
            { value: String(next.exerciseCount), unit: next.exerciseCount === 1 ? "exercise" : "exercises" },
            ...(next.estimatedDurationMinutes
              ? [{ value: `~${next.estimatedDurationMinutes}`, unit: "min" }]
              : []),
          ],
          action: null,
          menuItems: scheduleMenu(next),
        };
      }

      return {
        label: selectedDate > todayDateOnlyString() ? "Nothing scheduled" : "Rest day",
        tone: "idle",
        caption: formatDateOnly(selectedDate),
        title: "No session",
        ring: null,
        facts: [],
        action: null,
        menuItems: [],
      };
    }

    if (!todayModel?.hasActiveProgram) {
      return {
        label: "No program",
        tone: "idle",
        caption: "Build a plan",
        title: "Know what to train, every day",
        ring: null,
        facts: [],
        action: {
          label: "Create a plan",
          icon: <LuCalendarPlus className="h-4 w-4" />,
          onClick: () => navigate("/program/new"),
        },
        menuItems: [],
      };
    }

    const today = todayModel.today;

    if (today?.status === ProgramPlanDayStatus.Started && today.startedWorkoutId) {
      const startedWorkoutId = today.startedWorkoutId;
      const started = workouts.find((workout) => workout.id === startedWorkoutId) ?? null;

      return {
        label: "Active workout",
        tone: "live",
        caption: "Today's focus",
        title: today.workoutTemplateName ?? started?.title ?? "Workout",
        ring: started ? countSets(started) : null,
        facts: started ? sessionFacts(started) : [],
        action: {
          label: "Continue workout",
          icon: <LuPlay className="h-4 w-4" fill="currentColor" />,
          onClick: () => continueWorkout(startedWorkoutId),
        },
        menuItems: [],
      };
    }

    if (todayModel.missedWorkout) {
      const missed = todayModel.missedWorkout;

      return {
        label: "Missed",
        tone: "next",
        caption: `Planned for ${formatDateOnly(missed.scheduledDate)}`,
        title: missed.workoutTemplateName ?? "Workout",
        ring: null,
        facts: [
          { value: String(missed.exerciseCount), unit: missed.exerciseCount === 1 ? "exercise" : "exercises" },
          ...(missed.estimatedDurationMinutes
            ? [{ value: `~${missed.estimatedDurationMinutes}`, unit: "min" }]
            : []),
        ],
        action: startAction(missed, "Train it today"),
        menuItems: scheduleMenu(missed),
      };
    }

    if (today?.status === ProgramPlanDayStatus.Completed) {
      const completedWorkoutId = today.completedWorkoutId;
      const completed = completedWorkoutId
        ? (workouts.find((workout) => workout.id === completedWorkoutId) ?? null)
        : null;

      return {
        label: "Completed",
        tone: "done",
        caption: "Today's focus",
        title: today.workoutTemplateName ?? completed?.title ?? "Workout",
        ring: completed ? countSets(completed) : null,
        facts: completed ? sessionFacts(completed) : [],
        action: completed
          ? {
              label: "View summary",
              icon: <LuPlay className="h-4 w-4" fill="currentColor" />,
              onClick: () => onOpenWorkout(completed),
            }
          : null,
        menuItems: [],
      };
    }

    if (today) {
      return {
        label: "Up next",
        tone: "next",
        caption: "Today's focus",
        title: today.workoutTemplateName ?? "Workout",
        ring: null,
        facts: [
          { value: String(today.exerciseCount), unit: today.exerciseCount === 1 ? "exercise" : "exercises" },
          ...(today.estimatedDurationMinutes
            ? [{ value: `~${today.estimatedDurationMinutes}`, unit: "min" }]
            : []),
        ],
        action: startAction(today, "Start workout"),
        menuItems: scheduleMenu(today),
      };
    }

    const next = todayModel.nextWorkout;

    return {
      label: "Rest day",
      tone: "idle",
      caption: next
        ? `Next: ${next.workoutTemplateName ?? "Workout"} on ${formatDateOnly(next.scheduledDate)}`
        : (todayModel.programName ?? "Training program"),
      title: "Recover",
      ring: null,
      facts: [],
      action: null,
      menuItems: [],
    };
  };

  const focus = resolveFocus();

  if (!focus) {
    return <section className="wk-focus wk-focus-pending" aria-busy="true" />;
  }

  return (
    <>
      <section className={`wk-focus tone-${focus.tone}`}>
        <span className="wk-focus-light one" aria-hidden="true" />
        <span className="wk-focus-light two" aria-hidden="true" />

        <div className="wk-focus-top">
          <span className="wk-focus-label">
            {focus.tone === "idle" ? (
              <LuMoon className="h-3.5 w-3.5" />
            ) : (
              <LuZap className="h-3.5 w-3.5" fill="currentColor" />
            )}
            {focus.label}
          </span>
          {focus.menuItems.length > 0 ? (
            <ActionMenu triggerAriaLabel="Workout options" items={focus.menuItems} />
          ) : null}
        </div>

        <div className="wk-focus-body">
          <div className="min-w-0">
            <p className="wk-focus-caption">{focus.caption}</p>
            <h2 className="wk-focus-title">{focus.title}</h2>
          </div>
          {focus.ring ? <SetRing completed={focus.ring.completed} total={focus.ring.total} /> : null}
        </div>

        <div className="wk-focus-foot">
          {focus.facts.length > 0 ? (
            <div className="wk-facts">
              {focus.facts.map((fact, index) => (
                <span key={fact.unit}>
                  {index > 0 ? <i aria-hidden="true" /> : null}
                  <b>{fact.value}</b> {fact.unit}
                </span>
              ))}
            </div>
          ) : null}

          {focus.action ? (
            <button
              type="button"
              className="wk-focus-cta"
              disabled={focus.action.isBusy}
              onClick={() => {
                tick();
                focus.action?.onClick();
              }}
            >
              {focus.action.icon}
              {focus.action.label}
            </button>
          ) : null}
        </div>
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
