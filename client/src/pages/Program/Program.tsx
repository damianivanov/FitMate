import {
  LuCalendarDays,
  LuClipboardList,
  LuDumbbell,
  LuHistory,
  LuLoaderCircle,
  LuPencil,
  LuPlus,
  LuTrash2,
  LuZap,
} from "react-icons/lu";
import {
  ActionMenu,
  AsyncSection,
  DeleteConfirmationModal,
  NativeGlyph,
  NativeHero,
  NativeList,
  NativeMeter,
  NativePage,
  NativeRow,
  NativeSection,
  PageBody,
  PageIntro,
  SectionAction,
  type ActionMenuItem,
} from "@/shared/components";
import { formatDateOnly, parseDateOnly, todayDateOnlyString } from "@/shared/utils/dateOnly";
import { ProgramPlanStatus } from "@/types";
import type { ProgramPlan, ProgramPlanDayModel } from "@/types";
import { useProgramPage } from "./hooks/useProgramPage";

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat(undefined, { weekday: "long" });

function describeDay(day: ProgramPlanDayModel, today: string): string {
  return day.scheduledDate === today
    ? "Today"
    : WEEKDAY_FORMATTER.format(parseDateOnly(day.scheduledDate));
}

function describeStatus(plan: ProgramPlan): string {
  if (plan.status === ProgramPlanStatus.Completed) {
    return "Completed";
  }

  return plan.status === ProgramPlanStatus.Draft ? "Draft" : "Archived";
}

export default function Program() {
  const { state, actions } = useProgramPage();
  const today = todayDateOnlyString();
  const activePlan = state.activePlan;
  const progress = state.progress;

  const upcoming = [state.todayModel?.today, state.todayModel?.nextWorkout].filter(
    (day): day is ProgramPlanDayModel => day != null,
  );

  const buildPlanMenu = (plan: ProgramPlan): ActionMenuItem[] => [
    {
      key: "edit",
      label: "Edit program",
      icon: <LuPencil className="h-4 w-4 shrink-0" />,
      onSelect: () => actions.edit(plan),
    },
    {
      key: "calendar",
      label: "View schedule",
      icon: <LuCalendarDays className="h-4 w-4 shrink-0" />,
      onSelect: () => actions.openCalendar(plan),
    },
    {
      key: "delete",
      label: "Delete",
      icon:
        state.deletingPlanId === plan.id ? (
          <LuLoaderCircle className="h-4 w-4 shrink-0 animate-spin" />
        ) : (
          <LuTrash2 className="h-4 w-4 shrink-0" />
        ),
      onSelect: () => actions.requestDelete(plan),
      variant: "danger",
      disabled: state.deletingPlanId !== null,
    },
  ];

  return (
    <>
      <PageBody>
        <NativePage>
          <PageIntro
            eyebrow="Your schedule"
            title="Program"
            action={
              <button
                type="button"
                onClick={actions.create}
                className="app-round-btn liquid-press"
                aria-label="Create program"
              >
                <LuPlus className="h-5 w-5" />
              </button>
            }
          />

          <AsyncSection
            isLoading={state.isLoading}
            error={state.error}
            onRetry={actions.reload}
            loadingLabel="Loading your program..."
            isEmpty={!activePlan && state.otherPlans.length === 0}
            emptyState={
              <NativeHero centred>
                <NativeGlyph tint="orange" size="lg">
                  <LuClipboardList className="h-6 w-6" />
                </NativeGlyph>
                <p>No program yet</p>
                <h2>Know what to train</h2>
                <small>Build a plan from your templates and get a daily schedule.</small>
                <button
                  type="button"
                  onClick={actions.create}
                  className="native-primary-action mt-5 max-w-xs"
                >
                  <LuPlus className="h-4 w-4" />
                  Create a plan
                </button>
              </NativeHero>
            }
          >
            {activePlan ? (
              <NativeHero>
                <div className="native-hero-top">
                  <span>
                    <LuZap className="h-4 w-4" fill="currentColor" />
                    Active program
                  </span>
                  <ActionMenu
                    triggerAriaLabel={`${activePlan.name} actions`}
                    items={buildPlanMenu(activePlan)}
                  />
                </div>

                <h2>{activePlan.name}</h2>
                <p>
                  {activePlan.targetWorkoutsPerWeek} session
                  {activePlan.targetWorkoutsPerWeek === 1 ? "" : "s"} a week
                  {activePlan.description ? ` · ${activePlan.description}` : ""}
                </p>

                {progress ? (
                  <div className="pg-progress">
                    <NativeMeter
                      percent={Number(progress.completionPercentage ?? 0)}
                      label="Program completion"
                    />
                    <span>{Math.round(Number(progress.completionPercentage ?? 0))}% complete</span>
                    <strong>
                      {progress.completedWorkouts} / {progress.scheduledWorkouts} sessions
                    </strong>
                  </div>
                ) : null}

                <div className="native-hero-actions">
                  <button type="button" onClick={() => actions.openCalendar(activePlan)}>
                    <LuCalendarDays className="h-4 w-4" />
                    View schedule
                  </button>
                  <button type="button" onClick={() => actions.edit(activePlan)}>
                    <LuPencil className="h-4 w-4" />
                    Edit
                  </button>
                </div>
              </NativeHero>
            ) : null}

            {upcoming.length > 0 && activePlan ? (
              <NativeSection
                title="Coming up"
                action={
                  <SectionAction onClick={() => actions.openCalendar(activePlan)} withChevron>
                    Calendar
                  </SectionAction>
                }
              >
                <NativeList>
                  {upcoming.map((day) => (
                    <NativeRow
                      key={day.id}
                      glyph={
                        <NativeGlyph tint={day.scheduledDate === today ? "orange" : "blue"}>
                          <LuDumbbell className="h-5 w-5" />
                        </NativeGlyph>
                      }
                      title={day.workoutTemplateName ?? "Workout"}
                      subtitle={`${describeDay(day, today)} · ${day.exerciseCount} exercise${day.exerciseCount === 1 ? "" : "s"}`}
                      trailing={
                        day.scheduledDate === today ? (
                          <span className="native-live-chip">TODAY</span>
                        ) : undefined
                      }
                      onClick={() => actions.openCalendar(activePlan)}
                    />
                  ))}
                </NativeList>
              </NativeSection>
            ) : null}

            {progress ? (
              <NativeSection title="Adherence">
                <NativeList>
                  <NativeRow
                    glyph={
                      <NativeGlyph tint="green">
                        <LuDumbbell className="h-5 w-5" />
                      </NativeGlyph>
                    }
                    title="Completed"
                    subtitle={`${progress.adherencePercentage}% of due workouts`}
                    value={String(progress.completedWorkouts)}
                  />
                  <NativeRow
                    glyph={
                      <NativeGlyph tint="rose">
                        <LuHistory className="h-5 w-5" />
                      </NativeGlyph>
                    }
                    title="Missed or skipped"
                    subtitle={`${progress.remainingWorkouts} left to train`}
                    value={String(progress.missedWorkouts + progress.skippedWorkouts)}
                  />
                  <NativeRow
                    glyph={
                      <NativeGlyph tint="orange">
                        <LuZap className="h-5 w-5" />
                      </NativeGlyph>
                    }
                    title="Current streak"
                    subtitle="Consecutive completed sessions"
                    value={String(progress.currentStreak)}
                  />
                </NativeList>
              </NativeSection>
            ) : null}

            {state.otherPlans.length > 0 ? (
              <NativeSection
                title="Your programs"
                action={<SectionAction onClick={actions.create}>New</SectionAction>}
              >
                <div className="native-tile-grid">
                  {state.otherPlans.map((plan) => (
                    <button
                      type="button"
                      className="native-tile"
                      key={plan.id}
                      onClick={() => actions.open(plan)}
                    >
                      <NativeGlyph
                        tint={plan.status === ProgramPlanStatus.Completed ? "blue" : "purple"}
                      >
                        {plan.status === ProgramPlanStatus.Completed ? (
                          <LuHistory className="h-5 w-5" />
                        ) : (
                          <LuDumbbell className="h-5 w-5" />
                        )}
                      </NativeGlyph>
                      <b>{plan.name}</b>
                      <small>
                        {plan.targetWorkoutsPerWeek} days/week · from{" "}
                        {formatDateOnly(plan.startDate)}
                      </small>
                      <em>{describeStatus(plan)}</em>
                    </button>
                  ))}
                </div>
              </NativeSection>
            ) : null}
          </AsyncSection>
        </NativePage>
      </PageBody>

      <DeleteConfirmationModal
        isOpen={Boolean(state.planPendingDelete)}
        itemName={state.planPendingDelete?.name ?? ""}
        title="Delete draft"
        isDeleting={state.deletingPlanId !== null}
        onCancel={actions.cancelDelete}
        onConfirm={actions.confirmDelete}
      />
    </>
  );
}
