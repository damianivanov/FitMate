import { LuCalendarDays, LuPlus } from "react-icons/lu";
import { AsyncSection, DeleteConfirmationModal, PageBody, PageHeader } from "@/shared/components";
import { formatDateOnly } from "@/shared/utils/dateOnly";
import { PlanListItem } from "./components/PlanListItem";
import { ProgramProgressCard } from "./components/ProgramProgressCard";
import { useProgramPage } from "./hooks/useProgramPage";

export default function Program() {
  const { state, actions } = useProgramPage();
  const nextWorkout = state.todayModel?.today ?? state.todayModel?.nextWorkout ?? null;
  const activePlan = state.activePlan;

  return (
    <>
      <PageHeader
        title="Program"
        subtitle="Your training plan, day by day"
        actions={
          <button
            type="button"
            onClick={actions.create}
            className="liquid-primary-btn inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold"
          >
            <LuPlus className="h-4 w-4" />
            <span>New program</span>
          </button>
        }
      />

      <PageBody>
        <AsyncSection
          isLoading={state.isLoading}
          error={state.error}
          onRetry={actions.reload}
          loadingLabel="Loading your program..."
          isEmpty={!activePlan && state.otherPlans.length === 0}
          emptyState={
            <div className="liquid-panel mx-auto max-w-4xl rounded-2xl px-5 py-10 text-center md:rounded-lg">
              <p className="text-base font-bold text-foreground">No program yet</p>
              <p className="mt-1 text-sm text-secondary">
                Build a plan from your workout templates and always know what to train.
              </p>
              <button
                type="button"
                onClick={actions.create}
                className="liquid-primary-btn mt-5 inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold"
              >
                <LuPlus className="h-4 w-4" />
                <span>Create a plan</span>
              </button>
            </div>
          }
        >
          <div className="mx-auto grid max-w-4xl gap-4">
            {activePlan ? (
              <section className="grid gap-3">
                <PlanListItem
                  plan={activePlan}
                  isDeleting={false}
                  onOpen={actions.open}
                  onEdit={actions.edit}
                  onOpenCalendar={actions.openCalendar}
                  onDelete={actions.requestDelete}
                />
                {state.progress ? <ProgramProgressCard progress={state.progress} /> : null}
                {nextWorkout ? (
                  <button
                    type="button"
                    onClick={() => actions.openCalendar(activePlan)}
                    className="liquid-panel flex cursor-pointer items-center gap-3 rounded-2xl p-4 text-left transition-colors duration-200 hover:border-primary-300/60"
                  >
                    <LuCalendarDays className="h-5 w-5 shrink-0 text-primary" />
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold uppercase tracking-widest text-muted">
                        Next up
                      </span>
                      <span className="block truncate text-sm font-bold text-foreground">
                        {nextWorkout.workoutTemplateName ?? "Workout"} ·{" "}
                        {formatDateOnly(nextWorkout.scheduledDate)}
                      </span>
                    </span>
                  </button>
                ) : null}
              </section>
            ) : null}

            {state.otherPlans.length > 0 ? (
              <section className="grid gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
                  Other programs
                </h2>
                {state.otherPlans.map((plan) => (
                  <PlanListItem
                    key={plan.id}
                    plan={plan}
                    isDeleting={state.deletingPlanId === plan.id}
                    onOpen={actions.open}
                    onEdit={actions.edit}
                    onOpenCalendar={actions.openCalendar}
                    onDelete={actions.requestDelete}
                  />
                ))}
              </section>
            ) : null}
          </div>
        </AsyncSection>
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
