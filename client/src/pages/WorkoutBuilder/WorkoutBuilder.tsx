import { useMemo } from "react";
import { LuArrowLeft, LuRefreshCw } from "react-icons/lu";
import {
  DeleteConfirmationModal,
  ExerciseAddModal,
  ExerciseBoard,
  type ExerciseBuilderCallbacks,
  type ExerciseBuilderCapabilities,
  type ExerciseBuilderExerciseVM,
} from "@/shared/components";
import { DurationSetPickerPopover } from "@/shared/components/WorkoutSetPickers/DurationSetPickerPopover";
import { RepsSetPickerPopover } from "@/shared/components/WorkoutSetPickers/RepsSetPickerPopover";
import { WeightSetPickerPopover } from "@/shared/components/WorkoutSetPickers/WeightSetPickerPopover";
import { WorkoutSessionHeader } from "./components/WorkoutSessionHeader";
import { WorkoutSessionSummary } from "./components/WorkoutSessionSummary";
import { useTemplateWorkoutBuilderPage } from "./hooks/useTemplateWorkoutBuilderPage";
import { isWorkoutExerciseDurationEnabled } from "./utils/workoutDraft";

const WORKOUT_CAPABILITIES: ExerciseBuilderCapabilities = {
  showRestColumn: false,
  showCompletionCheckbox: true,
  showSetTypeDropdown: true,
  showPreviousColumn: true,
  allowCollapse: true,
  allowExerciseDnd: true,
  allowSetDnd: true,
};

export default function WorkoutBuilder() {
  const {
    draft,
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
    collapsedExerciseIds,
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
    handleExerciseReorder,
    handleToggleExerciseCollapse,
    handleSetGroupCollapse,
    handleQuickSetPopoverOpen,
    handleQuickSetPopoverClose,
    handleQuickSetValueChange,
    handleQuickSetApplyToAll,
    handleStartWorkout,
    handleFinishWorkout,
  } = useTemplateWorkoutBuilderPage();

  const exerciseVms = useMemo<ExerciseBuilderExerciseVM[]>(() => {
    if (!draft) {
      return [];
    }

    return draft.exercises.map((exercise) => {
      const previousSets = previousSetsByExerciseId[exercise.exerciseId];

      return {
        id: exercise.id,
        exerciseId: exercise.exerciseId,
        displayName: exercise.exerciseName,
        groupId: exercise.clientGroupId ?? null,
        groupType: exercise.groupType,
        notes: exercise.notes,
        collapsed: collapsedExerciseIds.has(exercise.id),
        isDurationEnabled: isWorkoutExerciseDurationEnabled(exercise),
        sets: exercise.sets.map((set, index) => ({
          id: set.id,
          weightKg: set.weightKg,
          reps: set.reps,
          durationSeconds: set.durationSeconds,
          setType: set.setType,
          isCompleted: set.isCompleted,
          previousSet: previousSets?.sets[index],
        })),
      };
    });
  }, [draft, previousSetsByExerciseId, collapsedExerciseIds]);

  const callbacks = useMemo<ExerciseBuilderCallbacks>(() => ({
    onOpenQuickSetPopover: (exerciseId, setId, field, anchorElement) => {
      if (field === "restSeconds") {
        return;
      }

      handleQuickSetPopoverOpen(exerciseId, setId, field, anchorElement);
    },
    onExerciseNotesChange: handleExerciseNotesChange,
    onExerciseMetricModeChange: handleExerciseMetricModeChange,
    onExerciseGroupingChange: handleExerciseGroupingChange,
    onRemoveExercise: handleRemoveExercise,
    onAddSet: handleAddSet,
    onRemoveSet: handleRemoveSet,
    onAddExerciseClick: handleAddExerciseModalOpen,
    onAddExerciseToGroup: handleAddExerciseToGroup,
    onToggleExerciseCollapse: handleToggleExerciseCollapse,
    onSetGroupCollapse: handleSetGroupCollapse,
    onExerciseReorder: handleExerciseReorder,
    onSetReorder: handleSetReorder,
    onSetCompletedToggle: handleSetCompletedToggle,
    onSetTypeChange: handleSetTypeChange,
  }), [
    handleAddExerciseModalOpen,
    handleAddExerciseToGroup,
    handleAddSet,
    handleExerciseGroupingChange,
    handleExerciseMetricModeChange,
    handleExerciseNotesChange,
    handleExerciseReorder,
    handleQuickSetPopoverOpen,
    handleRemoveExercise,
    handleRemoveSet,
    handleSetCompletedToggle,
    handleSetGroupCollapse,
    handleSetReorder,
    handleSetTypeChange,
    handleToggleExerciseCollapse,
  ]);

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
            New workout
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

            <ExerciseBoard
              exercises={exerciseVms}
              capabilities={WORKOUT_CAPABILITIES}
              callbacks={callbacks}
              isInteractionLocked={isAddExerciseModalOpen || activeQuickSetPopoverContext !== null}
            />
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

      <ExerciseAddModal
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
