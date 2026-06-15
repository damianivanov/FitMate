import { useEffect, useMemo } from "react";
import { LuArrowLeft, LuChevronDown, LuRefreshCw } from "react-icons/lu";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";
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
import { WorkoutHeaderLeadingAction } from "./components/workoutSessionHeaderActions";
import { WorkoutSessionSummary } from "./components/WorkoutSessionSummary";
import {
  useTemplateWorkoutBuilderPage,
  type WorkoutBuilderHookOptions,
} from "./hooks/useTemplateWorkoutBuilderPage";
import { getWorkoutExerciseMetricMode } from "./utils/workoutDraft";

/**
 * Sheet-mode props. When `onBack` is provided, this builder is rendered inside the
 * app-level mobile workout sheet (identity comes from the store, navigation intents are
 * reported back via callbacks). With no props it is the desktop routed page (URL-driven).
 */
export type WorkoutBuilderProps = {
  sheetWorkoutId?: number | null;
  sheetTemplateId?: number | null;
  onBack?: () => void;
  onFinished?: (workoutId: number) => void;
  onDeleted?: () => void;
  onMetaChange?: WorkoutBuilderHookOptions["onMetaChange"];
};

const WORKOUT_CAPABILITIES: ExerciseBuilderCapabilities = {
  showRestColumn: false,
  showRpeColumn: true,
  showCompletionCheckbox: true,
  showSetTypeDropdown: true,
  showPreviousSets: true,
  allowCollapse: true,
  allowExerciseDnd: true,
  allowSetDnd: true,
};

export default function WorkoutBuilder({
  sheetWorkoutId,
  sheetTemplateId,
  onBack,
  onFinished,
  onDeleted,
  onMetaChange,
}: WorkoutBuilderProps = {}) {
  const isSheet = onBack !== undefined;
  const hookOptions: WorkoutBuilderHookOptions | undefined = isSheet
    ? {
        workoutId: sheetWorkoutId,
        templateId: sheetTemplateId,
        onBack,
        onFinished,
        onDeleted,
        onMetaChange,
      }
    : undefined;
  const { state, actions } = useTemplateWorkoutBuilderPage(hookOptions);
  const isMobileViewport = useIsMobileViewport({ defaultValue: true });
  const leadingAction = isSheet
    ? WorkoutHeaderLeadingAction.Minimize
    : WorkoutHeaderLeadingAction.Back;
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
    scrollToExerciseId,
  } = state;

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
        imageUrl: exercise.exerciseImageUrl,
        groupId: exercise.clientGroupId ?? null,
        groupType: exercise.groupType,
        notes: exercise.notes,
        collapsed: collapsedExerciseIds.has(exercise.id),
        metricMode: getWorkoutExerciseMetricMode(exercise),
        sets: exercise.sets.map((set) => ({
          id: set.id,
          weightKg: set.weightKg,
          reps: set.reps,
          durationSeconds: set.durationSeconds,
          rpe: set.rpe,
          setType: set.setType,
          isCompleted: set.isCompleted,
        })),
        previousSets,
      };
    });
  }, [draft, previousSetsByExerciseId, collapsedExerciseIds]);

  // Derived from `draft` only (not the per-second elapsed timer) so the add
  // modal does not re-render on every tick or background autosave.
  const selectedExerciseIds = useMemo(
    () => draft?.exercises.map((exercise) => exercise.exerciseId) ?? [],
    [draft],
  );

  const callbacks = useMemo<ExerciseBuilderCallbacks>(() => ({
    onOpenQuickSetPopover: (exerciseId, setId, field, anchorElement) => {
      if (field === "restSeconds") {
        return;
      }

      actions.handleQuickSetPopoverOpen(exerciseId, setId, field, anchorElement);
    },
    onExerciseNotesChange: actions.handleExerciseNotesChange,
    onExerciseMetricModeChange: actions.handleExerciseMetricModeChange,
    onExerciseGroupingChange: actions.handleExerciseGroupingChange,
    onRemoveExercise: actions.handleRemoveExercise,
    onAddSet: actions.handleAddSet,
    onApplyPreviousSets: actions.handleApplyPreviousSets,
    onRemoveSet: actions.handleRemoveSet,
    onAddExerciseClick: actions.handleAddExerciseModalOpen,
    onAddExerciseToGroup: actions.handleAddExerciseToGroup,
    onToggleExerciseCollapse: actions.handleToggleExerciseCollapse,
    onSetGroupCollapse: actions.handleSetGroupCollapse,
    onExerciseReorder: actions.handleExerciseReorder,
    onSetReorder: actions.handleSetReorder,
    onSetCompletedToggle: actions.handleSetCompletedToggle,
    onCompleteExercise: actions.handleCompleteExercise,
    onSetTypeChange: actions.handleSetTypeChange,
  }), [actions]);

  useEffect(() => {
    if (!scrollToExerciseId) {
      return;
    }

    if (isMobileViewport && typeof document !== "undefined") {
      const targetElement = document.querySelector(
        `[data-exercise-id="${CSS.escape(scrollToExerciseId)}"]`,
      );
      targetElement?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    actions.handleExerciseScrolled();
  }, [scrollToExerciseId, isMobileViewport, actions]);

  if (!draft || !summary) {
    return (
      <>
        <header className="liquid-page-header flex items-center gap-3 px-4 py-3 md:px-8">
          <button
            type="button"
            onClick={actions.handleBackClick}
            className={`liquid-pill inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full ${
              isSheet ? "h-11 w-11" : "h-9 w-9"
            }`}
            aria-label={isSheet ? "Minimize workout" : "Back to templates"}
          >
            {isSheet ? <LuChevronDown className="h-5 w-5" /> : <LuArrowLeft className="h-4 w-4" />}
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
                  onClick={actions.handleRetryLoad}
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
        leadingAction={leadingAction}
        canDeleteWorkout={canDeleteWorkout}
        isDeletingWorkout={isDeletingWorkout}
        isSavingWorkout={isSavingWorkout}
        onBackClick={actions.handleBackClick}
        onDeleteWorkout={actions.handleDeleteWorkoutRequest}
        onStartWorkout={actions.handleStartWorkout}
        onFinishWorkout={actions.handleFinishWorkout}
        onTitleChange={actions.handleTitleChange}
        onTitleCommit={actions.handleTitleCommit}
      />

      <div
        className={
          isSheet
            ? "px-3 pb-24 pt-4"
            : "liquid-scrollbar flex-1 overflow-y-auto px-3 pb-24 pt-4 md:px-8 md:pb-6 md:pt-6"
        }
      >
        <div className="w-full space-y-6">
          <section className="min-w-0 md:space-y-4">
            <WorkoutSessionSummary
              templateName={draft.templateName ?? draft.title}
              startedAt={draft.startedAt}
              notes={draft.notes}
              elapsedSeconds={elapsedSeconds}
              summary={summary}
              onNotesChange={actions.handleWorkoutNotesChange}
              onNotesCommit={actions.handleWorkoutNotesCommit}
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
              onChange={actions.handleQuickSetValueChange}
              onApplyToAll={actions.handleQuickSetApplyToAll}
              onClose={actions.handleQuickSetPopoverClose}
              quickIncrements={[1.25, 5, 10, 15, 20] as const}
              anchorElement={quickSetPopoverAnchorElement}
            />
          ) : null}

          {activeQuickSetPopoverContext.field === "reps" ? (
            <RepsSetPickerPopover
              isOpen
              value={activeQuickSetPopoverContext.set.reps}
              onChange={actions.handleQuickSetValueChange}
              onApplyToAll={actions.handleQuickSetApplyToAll}
              onClose={actions.handleQuickSetPopoverClose}
              anchorElement={quickSetPopoverAnchorElement}
            />
          ) : null}

          {activeQuickSetPopoverContext.field === "durationSeconds" ? (
            <DurationSetPickerPopover
              isOpen
              value={activeQuickSetPopoverContext.set.durationSeconds}
              onChange={actions.handleQuickSetValueChange}
              onApplyToAll={actions.handleQuickSetApplyToAll}
              onClose={actions.handleQuickSetPopoverClose}
              anchorElement={quickSetPopoverAnchorElement}
            />
          ) : null}


          {activeQuickSetPopoverContext.field === "rpe" ? (
            <WeightSetPickerPopover
              isOpen
              title="RPE"
              unitLabel=""
              value={activeQuickSetPopoverContext.set.rpe}
              onChange={actions.handleQuickSetValueChange}
              onApplyToAll={actions.handleQuickSetApplyToAll}
              onClose={actions.handleQuickSetPopoverClose}
              min={0}
              max={10}
              step={0.5}
              precision={1}
              quickIncrements={[0.5, 1, 2] as const}
              anchorElement={quickSetPopoverAnchorElement}
            />
          ) : null}
        </>
      ) : null}

      <ExerciseAddModal
        isOpen={isAddExerciseModalOpen}
        selectedExerciseIds={selectedExerciseIds}
        onAddExercise={actions.handleAddExercise}
        onClose={actions.handleAddExerciseModalClose}
      />

      <DeleteConfirmationModal
        isOpen={isDeleteConfirmationOpen}
        itemName={deleteConfirmationWorkoutTitle}
        title="Delete workout"
        isDeleting={isDeletingWorkout}
        onCancel={actions.handleCancelDeleteWorkout}
        onConfirm={actions.handleConfirmDeleteWorkout}
      />
    </>
  );
}
