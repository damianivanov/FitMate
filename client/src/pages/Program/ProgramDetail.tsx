import { LuCalendarDays, LuPencil } from "react-icons/lu";
import {
  ActivateProgramModal,
  AsyncSection,
  DeleteConfirmationModal,
  OutlinedButton,
  PageBody,
  PageHeader,
  PrimaryButton,
} from "@/shared/components";
import { formatDateOnly } from "@/shared/utils/dateOnly";
import {
  PLAN_STATUS_BADGE_CLASSES,
  PLAN_STATUS_LABELS,
  SCHEDULE_TYPE_LABELS,
  TRAINING_GOAL_LABELS,
  formatPlanDuration,
} from "@/shared/utils/programDisplay";
import { ProgramPlanStatus } from "@/types";
import { ProgramProgressCard } from "./components/ProgramProgressCard";
import { ScheduleSummary } from "./components/ScheduleSummary";
import { useProgramDetailPage } from "./hooks/useProgramDetailPage";

export function ProgramDetail() {
  const { state, actions } = useProgramDetailPage();
  const plan = state.plan;
  const status = plan?.status;

  return (
    <>
      <PageHeader
        title={plan?.name ?? "Program"}
        subtitle={
          plan
            ? `${TRAINING_GOAL_LABELS[plan.goal]} · ${SCHEDULE_TYPE_LABELS[plan.scheduleType]}`
            : undefined
        }
        actions={
          plan ? (
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${PLAN_STATUS_BADGE_CLASSES[plan.status]}`}
            >
              {PLAN_STATUS_LABELS[plan.status]}
            </span>
          ) : undefined
        }
      />

      <PageBody>
        <AsyncSection
          isLoading={state.isLoading}
          error={state.error}
          onRetry={actions.reload}
          loadingLabel="Loading program..."
        >
          {plan ? (
            <div className="mx-auto grid max-w-3xl gap-4">
              <section className="liquid-panel grid gap-3 rounded-2xl p-4 md:rounded-lg">
                <p className="text-sm text-secondary">
                  {formatDateOnly(plan.startDate)}
                  {plan.endDate ? ` → ${formatDateOnly(plan.endDate)}` : " → open-ended"} ·{" "}
                  {formatPlanDuration(plan)} · {plan.targetWorkoutsPerWeek}x / week
                </p>
                {plan.description ? (
                  <p className="text-sm text-secondary">{plan.description}</p>
                ) : null}
                <ScheduleSummary plan={plan} />
              </section>

              {state.progress ? <ProgramProgressCard progress={state.progress} /> : null}

              <footer className="flex flex-wrap items-center justify-end gap-3">
                <OutlinedButton onClick={actions.openCalendar}>
                  <LuCalendarDays className="h-4 w-4" />
                  Calendar
                </OutlinedButton>

                {status === ProgramPlanStatus.Draft ? (
                  <>
                    <OutlinedButton onClick={actions.edit}>
                      <LuPencil className="h-4 w-4" />
                      Edit
                    </OutlinedButton>
                    <OutlinedButton
                      onClick={actions.requestDelete}
                      disabled={state.busyAction !== null}
                    >
                      Delete
                    </OutlinedButton>
                    <PrimaryButton
                      onClick={actions.requestActivate}
                      disabled={state.busyAction !== null}
                    >
                      Activate
                    </PrimaryButton>
                  </>
                ) : null}

                {status === ProgramPlanStatus.Active ? (
                  <>
                    <OutlinedButton onClick={actions.pause} disabled={state.busyAction !== null}>
                      {state.busyAction === "pause" ? "Pausing..." : "Pause"}
                    </OutlinedButton>
                    <OutlinedButton onClick={actions.cancel} disabled={state.busyAction !== null}>
                      {state.busyAction === "cancel" ? "Cancelling..." : "Cancel program"}
                    </OutlinedButton>
                    <PrimaryButton onClick={actions.complete} disabled={state.busyAction !== null}>
                      {state.busyAction === "complete" ? "Completing..." : "Complete"}
                    </PrimaryButton>
                  </>
                ) : null}

                {status === ProgramPlanStatus.Paused ? (
                  <>
                    <OutlinedButton onClick={actions.cancel} disabled={state.busyAction !== null}>
                      {state.busyAction === "cancel" ? "Cancelling..." : "Cancel program"}
                    </OutlinedButton>
                    <OutlinedButton onClick={actions.complete} disabled={state.busyAction !== null}>
                      {state.busyAction === "complete" ? "Completing..." : "Complete"}
                    </OutlinedButton>
                    <PrimaryButton
                      onClick={actions.requestActivate}
                      disabled={state.busyAction !== null}
                    >
                      Resume
                    </PrimaryButton>
                  </>
                ) : null}
              </footer>
            </div>
          ) : null}
        </AsyncSection>
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
