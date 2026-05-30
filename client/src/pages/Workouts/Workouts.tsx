import { LuPlus } from "react-icons/lu";
import { AsyncSection, DeleteConfirmationModal, PageBody, PageHeader } from "@/shared/components";
import { WorkoutListItem } from "./components/WorkoutListItem";
import { useWorkoutsPage } from "./hooks/useWorkoutsPage";

export default function Workouts() {
  const { state, actions } = useWorkoutsPage();

  return (
    <>
      <PageHeader
        title="Workouts"
        subtitle={`${state.workouts.length} workout${state.workouts.length === 1 ? "" : "s"}`}
        actions={
          <button
            type="button"
            onClick={actions.create}
            className="liquid-primary-btn inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold"
          >
            <LuPlus className="h-4 w-4" />
            <span>New</span>
          </button>
        }
      />

      <PageBody>
        <AsyncSection
          isLoading={state.isLoading}
          error={state.error}
          onRetry={actions.reload}
          loadingLabel="Loading workouts..."
          isEmpty={state.workouts.length === 0}
          emptyState={
            <div className="liquid-panel rounded-2xl px-5 py-10 text-center md:rounded-lg">
              <p className="text-base font-bold text-foreground">No workouts yet</p>
              <button
                type="button"
                onClick={actions.create}
                className="liquid-primary-btn mt-5 inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold"
              >
                <LuPlus className="h-4 w-4" />
                <span>New workout</span>
              </button>
            </div>
          }
        >
          <section className="mx-auto grid max-w-4xl gap-3">
            {state.workouts.map((workout) => (
              <WorkoutListItem
                key={workout.id}
                workout={workout}
                isDeleting={state.deletingWorkoutId === workout.id}
                onDelete={actions.requestDelete}
                onOpen={actions.open}
              />
            ))}
          </section>
        </AsyncSection>
      </PageBody>

      <DeleteConfirmationModal
        isOpen={state.isDeleteConfirmationOpen}
        itemName={state.workoutPendingDeleteTitle}
        title="Delete workout"
        isDeleting={state.deletingWorkoutId !== null}
        onCancel={actions.cancelDelete}
        onConfirm={actions.confirmDelete}
      />
    </>
  );
}
