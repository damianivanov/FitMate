import { LuArrowLeft, LuPlus, LuRefreshCw } from "react-icons/lu";
import { DeleteConfirmationModal } from "@/shared/components";
import { DurationSetPickerPopover } from "@/shared/components/WorkoutSetPickers/DurationSetPickerPopover";
import { RepsSetPickerPopover } from "@/shared/components/WorkoutSetPickers/RepsSetPickerPopover";
import { WeightSetPickerPopover } from "@/shared/components/WorkoutSetPickers/WeightSetPickerPopover";
import { WorkoutAddExerciseModal } from "./components/WorkoutAddExerciseModal";
import { WorkoutExerciseGroupCard } from "./components/WorkoutExerciseGroupCard";
import { WorkoutSessionHeader } from "./components/WorkoutSessionHeader";
import { WorkoutSessionSummary } from "./components/WorkoutSessionSummary";
import { useTemplateWorkoutBuilderPage } from "./hooks/useTemplateWorkoutBuilderPage";

export default function WorkoutBuilder() {
  const {
    draft,
    groups,
    summary,
    elapsedSeconds,
    isWorkoutStarted,
    previousSetsByExerciseId,
    isLoadingTemplate,
    templateError,
    isSavingWorkout,
    isDeletingWorkout,
    canDeleteWorkout,
    deleteConfirmationWorkoutTitle,
    isDeleteConfirmationOpen,
    activeQuickSetPopoverContext,
    quickSetPopoverAnchorElement,
    isAddExerciseModalOpen,
    handleBackClick,
    handleCancelDeleteWorkout,
    handleConfirmDeleteWorkout,
    handleDeleteWorkoutRequest,
    handleRetryLoad,
    handleAddExerciseModalOpen,
    handleAddExerciseModalClose,
    handleAddExercise,
    handleAddExerciseToGroup,
    handleRemoveExercise,
    handleExerciseGroupingChange,
    handleTitleChange,
    handleWorkoutNotesChange,
    handleExerciseNotesChange,
    handleExerciseMetricModeChange,
    handleSetTypeChange,
    handleSetCompletedToggle,
    handleAddSet,
    handleRemoveSet,
    handleSetReorder,
    handleQuickSetPopoverOpen,
    handleQuickSetPopoverClose,
    handleQuickSetValueChange,
    handleQuickSetApplyToAll,
    handleStartWorkout,
    handleFinishWorkout,
  } = useTemplateWorkoutBuilderPage();

  if (!draft || !summary) {
    return (
      <>
        <header className="liquid-page-header flex items-center gap-3 px-4 py-3 md:px-8">
          <button
            type="button"
            onClick={handleBackClick}
            className="liquid-pill inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full"
            aria-label="Back to templates"
          >
            <LuArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-lg font-extrabold tracking-tight text-foreground md:text-2xl">
            New Workout
          </h1>
        </header>

        <div className="liquid-scrollbar flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-7">
          <div className="mx-auto max-w-2xl">
            {isLoadingTemplate ? (
              <div className="liquid-panel rounded-2xl px-5 py-8 text-center md:rounded-lg">
                <p className="text-sm font-semibold text-foreground">Loading template...</p>
              </div>
            ) : null}

            {!isLoadingTemplate && templateError ? (
              <div className="liquid-panel rounded-2xl px-5 py-8 text-center md:rounded-lg">
                <p className="text-sm font-semibold text-danger">{templateError}</p>
                <button
                  type="button"
                  onClick={handleRetryLoad}
                  className="liquid-pill mt-4 inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold"
                >
                  <LuRefreshCw className="h-4 w-4" />
                  <span>Retry</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <WorkoutSessionHeader
        title={draft.title}
        elapsedSeconds={elapsedSeconds}
        isWorkoutStarted={isWorkoutStarted}
        canDeleteWorkout={canDeleteWorkout}
        isDeletingWorkout={isDeletingWorkout}
        isSavingWorkout={isSavingWorkout}
        onBackClick={handleBackClick}
        onDeleteWorkout={handleDeleteWorkoutRequest}
        onStartWorkout={handleStartWorkout}
        onFinishWorkout={handleFinishWorkout}
        onTitleChange={handleTitleChange}
      />

      <div className="liquid-scrollbar flex-1 overflow-y-auto px-3 pb-24 pt-4 md:px-8 md:pb-6 md:pt-6">
        <div className="w-full space-y-6">
          <section className="min-w-0 md:space-y-4">
            <WorkoutSessionSummary
              templateName={draft.templateName ?? draft.title}
              startedAt={draft.startedAt}
              notes={draft.notes}
              elapsedSeconds={elapsedSeconds}
              summary={summary}
              onNotesChange={handleWorkoutNotesChange}
            />

            <div className="mt-5 py-5 md:px-2 md:py-5">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 md:gap-5">
                <div className="border-t border-gray-100/10" />
                <div className="text-center">
                  <div className="text-sm font-semibold uppercase tracking-[0.22em] text-muted md:text-lg">
                    Exercises
                  </div>
                  <p className="mt-0.5 max-w-3xs text-xs text-secondary md:max-w-100">
                    Add exercises from your library and configure your sets.
                  </p>
                </div>
                <div className="border-t border-gray-100/10" />
              </div>
            </div>

            <div className="flex flex-col items-stretch gap-4 md:flex-row md:flex-wrap md:items-start">
              {!groups.length ? (
                <button
                  type="button"
                  onClick={handleAddExerciseModalOpen}
                  className="liquid-template-dashed flex w-full cursor-pointer items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-primary-700 transition"
                >
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary-200 text-primary-700">
                    <LuPlus className="h-3.5 w-3.5" />
                  </span>
                  <span>Add Exercise</span>
                </button>
              ) : null}

              {groups.map((group) => (
                <WorkoutExerciseGroupCard
                  key={group.id}
                  group={group}
                  previousSetsByExerciseId={previousSetsByExerciseId}
                  onExerciseNotesChange={handleExerciseNotesChange}
                  onExerciseMetricModeChange={handleExerciseMetricModeChange}
                  onExerciseGroupingChange={handleExerciseGroupingChange}
                  onAddExerciseToGroup={handleAddExerciseToGroup}
                  onRemoveExercise={handleRemoveExercise}
                  onSetTypeChange={handleSetTypeChange}
                  onSetCompletedToggle={handleSetCompletedToggle}
                  onAddSet={handleAddSet}
                  onRemoveSet={handleRemoveSet}
                  onSetReorder={handleSetReorder}
                  onOpenQuickSetPopover={handleQuickSetPopoverOpen}
                />
              ))}
            </div>

            {groups.length ? (
              <button
                type="button"
                onClick={handleAddExerciseModalOpen}
                className="liquid-template-dashed mt-1 hidden w-full cursor-pointer items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-primary-700 transition sm:flex"
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary-200 text-primary-700">
                  <LuPlus className="h-3.5 w-3.5" />
                </span>
                <span>Add Exercise</span>
              </button>
            ) : null}
          </section>
        </div>
      </div>

      {activeQuickSetPopoverContext && quickSetPopoverAnchorElement ? (
        <>
          {activeQuickSetPopoverContext.field === "weightKg" ? (
            <WeightSetPickerPopover
              isOpen
              value={activeQuickSetPopoverContext.set.weightKg}
              onChange={handleQuickSetValueChange}
              onApplyToAll={handleQuickSetApplyToAll}
              onClose={handleQuickSetPopoverClose}
              quickIncrements={[1.25, 5, 10, 15, 20] as const}
              anchorElement={quickSetPopoverAnchorElement}
            />
          ) : null}

          {activeQuickSetPopoverContext.field === "reps" ? (
            <RepsSetPickerPopover
              isOpen
              value={activeQuickSetPopoverContext.set.reps}
              onChange={handleQuickSetValueChange}
              onApplyToAll={handleQuickSetApplyToAll}
              onClose={handleQuickSetPopoverClose}
              anchorElement={quickSetPopoverAnchorElement}
            />
          ) : null}

          {activeQuickSetPopoverContext.field === "durationSeconds" ? (
            <DurationSetPickerPopover
              isOpen
              value={activeQuickSetPopoverContext.set.durationSeconds}
              onChange={handleQuickSetValueChange}
              onApplyToAll={handleQuickSetApplyToAll}
              onClose={handleQuickSetPopoverClose}
              anchorElement={quickSetPopoverAnchorElement}
            />
          ) : null}
        </>
      ) : null}

      <WorkoutAddExerciseModal
        isOpen={isAddExerciseModalOpen}
        selectedExerciseIds={draft.exercises.map((exercise) => exercise.exerciseId)}
        onAddExercise={handleAddExercise}
        onClose={handleAddExerciseModalClose}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteConfirmationOpen}
        itemName={deleteConfirmationWorkoutTitle}
        title="Delete workout"
        isDeleting={isDeletingWorkout}
        onCancel={handleCancelDeleteWorkout}
        onConfirm={handleConfirmDeleteWorkout}
      />
    </>
  );
}
