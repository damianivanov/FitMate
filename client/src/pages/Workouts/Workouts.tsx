import { useState } from "react";
import { LuPlus } from "react-icons/lu";
import {
  AsyncSection,
  DeleteConfirmationModal,
  JumpValue,
  PageBody,
  PageHeader,
  SaveAsTemplateModal,
  SegmentControl,
  SegmentControlSize,
  SwapIn,
} from "@/shared/components";
import { ProgramTodayCard } from "./components/ProgramTodayCard";
import { WorkoutListItem } from "./components/WorkoutListItem";
import { useWorkoutsPage, type WorkoutFilter } from "./hooks/useWorkoutsPage";

const FILTER_OPTIONS: { value: WorkoutFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "In progress" },
  { value: "finished", label: "Finished" },
];

export default function Workouts() {
  const { state, actions } = useWorkoutsPage();
  const [direction, setDirection] = useState<"forward" | "back">("forward");

  // The tap knows which way the list travelled, so the content can arrive from the side
  // the user reached for — and leave the same way when they come back.
  const changeFilter = (next: WorkoutFilter) => {
    const nextIndex = FILTER_OPTIONS.findIndex((option) => option.value === next);
    setDirection(nextIndex >= state.filterIndex ? "forward" : "back");
    actions.setFilter(next);
  };

  const visibleCount = state.filteredWorkouts.length;

  return (
    <>
      <PageHeader
        eyebrow="Training"
        title="Workouts"
        subtitle={
          <>
            <JumpValue value={state.workouts.length}>{state.workouts.length}</JumpValue> workout
            {state.workouts.length === 1 ? "" : "s"} logged
          </>
        }
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
        <section className="mx-auto mb-4 max-w-4xl">
          <ProgramTodayCard />
        </section>

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
          <div className="mx-auto max-w-4xl">
            <div className="mb-4 flex items-center gap-3">
              <SegmentControl
                value={state.filter}
                options={FILTER_OPTIONS}
                onChange={changeFilter}
                size={SegmentControlSize.Md}
                className="min-w-0 flex-1 sm:max-w-md"
              />
              <p className="shrink-0 text-xs font-semibold text-secondary tabular-nums">
                <JumpValue value={visibleCount}>{visibleCount}</JumpValue> shown
              </p>
            </div>

            <SwapIn swapKey={state.filter} direction={direction}>
              {visibleCount === 0 ? (
                <div className="liquid-panel rounded-2xl px-5 py-10 text-center md:rounded-lg">
                  <p className="text-sm font-semibold text-foreground">Nothing here</p>
                  <p className="mt-1 text-sm text-secondary">
                    No workouts match this filter.
                  </p>
                </div>
              ) : (
                <section className="grid gap-3">
                  {state.filteredWorkouts.map((workout) => (
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
              )}
            </SwapIn>
          </div>
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
