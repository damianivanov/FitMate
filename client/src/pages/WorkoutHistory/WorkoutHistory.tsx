import { AsyncSection, DeleteConfirmationModal, PageBody, PageHeader, SaveAsTemplateModal } from "@/shared/components";
import { WorkoutListItem } from "../Workouts/components/WorkoutListItem";
import { useWorkoutHistoryPage } from "./hooks/useWorkoutHistoryPage";

export default function WorkoutHistory() {
  const { state, actions } = useWorkoutHistoryPage();

  return (
    <>
      <PageHeader
        title="Workout History"
        subtitle={`${state.workouts.length} completed workout${state.workouts.length === 1 ? "" : "s"}`}
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
              <p className="text-base font-bold text-foreground">No completed workouts yet</p>
              <p className="mt-1 text-sm text-secondary">Finish a workout and it will show up here.</p>
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
                onRepeat={actions.repeat}
                onSaveAsTemplate={actions.requestSaveAsTemplate}
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

      <SaveAsTemplateModal
        isOpen={state.isSaveAsTemplateOpen}
        defaultName={state.saveAsTemplateDefaultName}
        isSaving={state.isSavingTemplate}
        onCancel={actions.cancelSaveAsTemplate}
        onConfirm={actions.confirmSaveAsTemplate}
      />
    </>
  );
}
