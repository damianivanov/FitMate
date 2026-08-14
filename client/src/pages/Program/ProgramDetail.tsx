import { LuCalendarDays, LuPencil, LuTarget, LuZap } from "react-icons/lu";
import {
  ActivateProgramModal,
  AsyncSection,
  BackHeader,
  DeleteConfirmationModal,
  NativeCard,
  NativeGlyph,
  NativeHero,
  NativeList,
  NativeMeter,
  NativePage,
  NativeRow,
  NativeSection,
  PageBody,
} from "@/shared/components";
import { formatDateOnly } from "@/shared/utils/dateOnly";
import {
  PLAN_STATUS_LABELS,
  SCHEDULE_TYPE_LABELS,
  TRAINING_GOAL_LABELS,
  formatPlanDuration,
} from "@/shared/utils/programDisplay";
import { ProgramPlanStatus } from "@/types";
import { ScheduleSummary } from "./components/ScheduleSummary";
import { useProgramDetailPage } from "./hooks/useProgramDetailPage";

export function ProgramDetail() {
  const { state, actions } = useProgramDetailPage();
  const plan = state.plan;
  const status = plan?.status;
  const progress = state.progress;
  const isBusy = state.busyAction !== null;

  return (
    <>
      <PageBody>
        <NativePage>
          <BackHeader
            title="Program"
            onBack={actions.openCalendar}
            action={
              plan ? (
                <button
                  type="button"
                  onClick={actions.openCalendar}
                  className="app-round-btn liquid-press"
                  aria-label="View schedule"
                >
                  <LuCalendarDays className="h-5 w-5" />
                </button>
              ) : undefined
            }
          />

          <AsyncSection
            isLoading={state.isLoading}
            error={state.error}
            onRetry={actions.reload}
            loadingLabel="Loading program..."
          >
            {plan ? (
              <>
                <NativeHero>
                  <div className="native-hero-top">
                    <span>
                      <LuZap className="h-4 w-4" fill="currentColor" />
                      {PLAN_STATUS_LABELS[plan.status]}
                    </span>
                  </div>

                  <h2>{plan.name}</h2>
                  <p>
                    {TRAINING_GOAL_LABELS[plan.goal]} · {SCHEDULE_TYPE_LABELS[plan.scheduleType]} ·{" "}
                    {plan.targetWorkoutsPerWeek}× / week
                  </p>

                  {progress ? (
                    <div className="pg-progress">
                      <NativeMeter
                        percent={Number(progress.completionPercentage ?? 0)}
                        label="Program completion"
                      />
                      <span>
                        {Math.round(Number(progress.completionPercentage ?? 0))}% complete
                      </span>
                      <strong>
                        {progress.completedWorkouts} / {progress.scheduledWorkouts} sessions
                      </strong>
                    </div>
                  ) : null}

                  <div className="native-hero-actions">
                    <button type="button" onClick={actions.openCalendar}>
                      <LuCalendarDays className="h-4 w-4" />
                      View schedule
                    </button>
                    {status === ProgramPlanStatus.Draft ? (
                      <button type="button" onClick={actions.edit}>
                        <LuPencil className="h-4 w-4" />
                        Edit
                      </button>
                    ) : null}
                  </div>
                </NativeHero>

                <NativeSection title="Details">
                  <NativeList>
                    <NativeRow
                      glyph={
                        <NativeGlyph tint="blue">
                          <LuCalendarDays className="h-5 w-5" />
                        </NativeGlyph>
                      }
                      title="Runs"
                      subtitle={formatPlanDuration(plan)}
                      value={`${formatDateOnly(plan.startDate)}${plan.endDate ? ` → ${formatDateOnly(plan.endDate)}` : ""}`}
                    />
                    <NativeRow
                      glyph={
                        <NativeGlyph tint="purple">
                          <LuTarget className="h-5 w-5" />
                        </NativeGlyph>
                      }
                      title="Goal"
                      subtitle={SCHEDULE_TYPE_LABELS[plan.scheduleType]}
                      value={TRAINING_GOAL_LABELS[plan.goal]}
                    />
                  </NativeList>
                </NativeSection>

                {plan.description ? (
                  <NativeCard>
                    <p className="ws-notes">{plan.description}</p>
                  </NativeCard>
                ) : null}

                <NativeSection title="Schedule">
                  <NativeCard className="pd-schedule">
                    <ScheduleSummary plan={plan} />
                  </NativeCard>
                </NativeSection>

                {/* Status decides the whole verb list, so the buttons are grouped rather than
                    scattered: one primary action and the rest quiet beside it. */}
                <div className="pd-actions">
                  {status === ProgramPlanStatus.Draft ? (
                    <>
                      <button
                        type="button"
                        onClick={actions.requestActivate}
                        disabled={isBusy}
                        className="native-primary-action"
                      >
                        Activate program
                      </button>
                      <button
                        type="button"
                        onClick={actions.requestDelete}
                        disabled={isBusy}
                        className="native-ghost-action tp-delete"
                      >
                        Delete draft
                      </button>
                    </>
                  ) : null}

                  {status === ProgramPlanStatus.Active ? (
                    <>
                      <button
                        type="button"
                        onClick={actions.complete}
                        disabled={isBusy}
                        className="native-primary-action"
                      >
                        {state.busyAction === "complete" ? "Completing..." : "Complete program"}
                      </button>
                      <button
                        type="button"
                        onClick={actions.pause}
                        disabled={isBusy}
                        className="native-ghost-action"
                      >
                        {state.busyAction === "pause" ? "Pausing..." : "Pause"}
                      </button>
                      <button
                        type="button"
                        onClick={actions.cancel}
                        disabled={isBusy}
                        className="native-ghost-action tp-delete"
                      >
                        {state.busyAction === "cancel" ? "Cancelling..." : "Cancel program"}
                      </button>
                    </>
                  ) : null}

                  {status === ProgramPlanStatus.Paused ? (
                    <>
                      <button
                        type="button"
                        onClick={actions.requestActivate}
                        disabled={isBusy}
                        className="native-primary-action"
                      >
                        Resume program
                      </button>
                      <button
                        type="button"
                        onClick={actions.complete}
                        disabled={isBusy}
                        className="native-ghost-action"
                      >
                        {state.busyAction === "complete" ? "Completing..." : "Complete"}
                      </button>
                      <button
                        type="button"
                        onClick={actions.cancel}
                        disabled={isBusy}
                        className="native-ghost-action tp-delete"
                      >
                        {state.busyAction === "cancel" ? "Cancelling..." : "Cancel program"}
                      </button>
                    </>
                  ) : null}
                </div>
              </>
            ) : null}
          </AsyncSection>
        </NativePage>
      </PageBody>

      <ActivateProgramModal
        isOpen={state.isActivateOpen}
        plan={plan}
        isActivating={state.busyAction === "activate"}
        onCancel={actions.cancelActivate}
        onConfirm={actions.confirmActivate}
      />

      <DeleteConfirmationModal
        isOpen={state.isDeleteConfirmationOpen}
        itemName={plan?.name ?? ""}
        title="Delete draft"
        isDeleting={state.busyAction === "delete"}
        onCancel={actions.cancelDelete}
        onConfirm={actions.confirmDelete}
      />
    </>
  );
}
