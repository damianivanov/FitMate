import { LuPlus, LuRefreshCw } from "react-icons/lu";
import { DeleteConfirmationModal } from "@/shared/components";
import { WorkoutListItem } from "./Workouts/components/WorkoutListItem";
import { useWorkoutsPage } from "./Workouts/hooks/useWorkoutsPage";

export default function Workouts() {
  const {
    workouts,
    deletingWorkoutId,
    workoutPendingDeleteTitle,
    isDeleteConfirmationOpen,
    isLoadingWorkouts,
    workoutsError,
    handleCancelWorkoutDelete,
    handleConfirmWorkoutDelete,
    handleCreateWorkoutClick,
    handleWorkoutDeleteRequest,
    handleReloadWorkouts,
    handleWorkoutOpen,
  } = useWorkoutsPage();

  return (
    <>
      <header className="liquid-page-header flex items-center justify-between px-6 py-5 md:px-8">
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Workouts</h1>
          <p className="mt-1 text-sm text-secondary">
            {workouts.length} workout{workouts.length === 1 ? "" : "s"}
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreateWorkoutClick}
          className="liquid-primary-btn inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold"
        >
          <LuPlus className="h-4 w-4" />
          <span>New</span>
        </button>
      </header>
      <div className="liquid-scrollbar flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-7">
        {isLoadingWorkouts ? (
          <div className="liquid-panel rounded-2xl px-5 py-8 text-center md:rounded-lg">
            <p className="text-sm font-semibold text-foreground">Loading workouts...</p>
          </div>
        ) : null}

        {!isLoadingWorkouts && workoutsError ? (
          <div className="liquid-panel rounded-2xl px-5 py-8 text-center md:rounded-lg">
            <p className="text-sm font-semibold text-danger">{workoutsError}</p>
            <button
              type="button"
              onClick={handleReloadWorkouts}
              className="liquid-pill mt-4 inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold"
            >
              <LuRefreshCw className="h-4 w-4" />
              <span>Retry</span>
            </button>
          </div>
        ) : null}

        {!isLoadingWorkouts && !workoutsError ? (
          workouts.length > 0 ? (
            <section className="mx-auto grid max-w-4xl gap-3">
              {workouts.map((workout) => (
                <WorkoutListItem
                  key={workout.id}
                  workout={workout}
                  isDeleting={deletingWorkoutId === workout.id}
                  onDelete={handleWorkoutDeleteRequest}
                  onOpen={handleWorkoutOpen}
                />
              ))}
            </section>
          ) : (
            <div className="liquid-panel rounded-2xl px-5 py-10 text-center md:rounded-lg">
              <p className="text-base font-bold text-foreground">No workouts yet</p>
              <button
                type="button"
                onClick={handleCreateWorkoutClick}
                className="liquid-primary-btn mt-5 inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold"
              >
                <LuPlus className="h-4 w-4" />
                <span>New Workout</span>
              </button>
            </div>
          )
        ) : null}
      </div>

      <DeleteConfirmationModal
        isOpen={isDeleteConfirmationOpen}
        itemName={workoutPendingDeleteTitle}
        title="Delete workout"
        isDeleting={deletingWorkoutId !== null}
        onCancel={handleCancelWorkoutDelete}
        onConfirm={handleConfirmWorkoutDelete}
      />
    </>
  );
}
