import { useMemo } from "react";
import {
  ExerciseAddModal,
  ExerciseBoard,
  type ExerciseBuilderCallbacks,
  type ExerciseBuilderCapabilities,
  type ExerciseBuilderExerciseVM,
} from "@/shared/components";
import { DurationSetPickerPopover } from "@/shared/components/WorkoutSetPickers/DurationSetPickerPopover";
import { RepsSetPickerPopover } from "@/shared/components/WorkoutSetPickers/RepsSetPickerPopover";
import { WeightSetPickerPopover } from "@/shared/components/WorkoutSetPickers/WeightSetPickerPopover";
import { TemplateBuilderHeader } from "./components/TemplateBuilderHeader";
import { TemplateBuilderMetadataPanel } from "./components/TemplateBuilderMetadataPanel";
import { useTemplateBuilderPage } from "./hooks/useTemplateBuilderPage";
import { isTemplateExerciseDurationEnabled } from "./utils/templateDraft";

const TEMPLATE_CAPABILITIES: ExerciseBuilderCapabilities = {
  showRestColumn: true,
  showCompletionCheckbox: false,
  showSetTypeDropdown: true,
  showPreviousColumn: false,
  allowCollapse: true,
  allowExerciseDnd: true,
  allowSetDnd: true,
};

export default function TemplateBuilder() {
  const { state, actions } = useTemplateBuilderPage();
  const { draft, collapsedExerciseIds } = state;

  const exerciseVms = useMemo<ExerciseBuilderExerciseVM[]>(
    () =>
      (draft?.exercises ?? []).map((exercise) => ({
        id: exercise.id,
        exerciseId: exercise.exerciseId,
        displayName: exercise.exerciseName || `Exercise #${exercise.exerciseId}`,
        groupId: exercise.clientGroupId ?? null,
        groupType: exercise.groupType,
        notes: exercise.notes,
        collapsed: collapsedExerciseIds.has(exercise.id),
        isDurationEnabled: isTemplateExerciseDurationEnabled(exercise),
        sets: exercise.sets.map((set) => ({
          id: set.id,
          weightKg: set.weightKg,
          reps: set.reps,
          durationSeconds: set.durationSeconds,
          restSeconds: set.restSeconds,
          setType: set.setType,
        })),
      })),
    [draft, collapsedExerciseIds],
  );

  const callbacks = useMemo<ExerciseBuilderCallbacks>(() => ({
    onOpenQuickSetPopover: actions.handleQuickSetPopoverOpen,
    onExerciseNotesChange: actions.handleExerciseNotesChange,
    onExerciseMetricModeChange: actions.handleExerciseMetricModeChange,
    onExerciseGroupingChange: actions.handleExerciseGroupingChange,
    onRemoveExercise: actions.handleRemoveExercise,
    onAddSet: actions.handleAddSet,
    onRemoveSet: actions.handleRemoveSet,
    onAddExerciseClick: actions.handleAddExerciseModalOpen,
    onAddExerciseToGroup: actions.handleAddExerciseToGroup,
    onToggleExerciseCollapse: actions.handleToggleExerciseCollapse,
    onSetGroupCollapse: actions.handleSetGroupCollapse,
    onExerciseReorder: actions.handleExerciseReorder,
    onSetReorder: actions.handleSetReorder,
    onSetTypeChange: actions.handleSetTypeChange,
  }), [actions]);

  const selectedExerciseIds = useMemo(
    () => (draft?.exercises ?? []).map((exercise) => exercise.exerciseId),
    [draft],
  );

  return (
    <>
      <TemplateBuilderHeader
        onDiscardClick={actions.handleDiscardClick}
        onSaveTemplateClick={actions.handleSaveTemplateClick}
        isSavingTemplate={state.isSavingTemplate}
        isSaveTemplateDisabled={state.isSaveTemplateDisabled}
        saveTemplateLabel={state.saveTemplateLabel}
      />

      <div className="liquid-scrollbar flex-1 overflow-y-auto px-3 pb-24 pt-4 md:px-8 md:pb-6 md:pt-6">
        {state.isBuilderLoading ? (
          <div className="liquid-panel rounded-2xl px-5 py-8 text-center md:rounded-lg">
            <p className="text-sm font-semibold text-foreground">Loading template...</p>
          </div>
        ) : null}

        {!state.isBuilderLoading && state.templateLoadError ? (
          <div className="liquid-panel rounded-2xl px-5 py-8 text-center md:rounded-lg">
            <p className="text-sm font-semibold text-danger">{state.templateLoadError}</p>
          </div>
        ) : null}

        {!state.isBuilderLoading && !state.templateLoadError && draft ? (
          <div className="w-full space-y-6">
            <section className="min-w-0 md:space-y-4">
              <TemplateBuilderMetadataPanel
                templateName={draft.name}
                templateDescription={draft.description}
                durationMinutes={draft.estimatedDurationMinutes}
                isPublic={draft.isPublic}
                onNameChange={actions.handleNameChange}
                onDescriptionChange={actions.handleDescriptionChange}
                onDurationChange={actions.handleDurationChange}
                onIsPublicChange={actions.handleIsPublicChange}
              />
              <ExerciseBoard
                exercises={exerciseVms}
                capabilities={TEMPLATE_CAPABILITIES}
                callbacks={callbacks}
                isInteractionLocked={state.isAddExerciseModalOpen || state.activeQuickSetPopoverContext !== null}
              />
            </section>
          </div>
        ) : null}
      </div>

      {state.activeQuickSetPopoverContext && state.quickSetPopoverAnchorElement ? (
        <>
          {state.activeQuickSetPopoverContext.field === "weightKg" ? (
            <WeightSetPickerPopover
              isOpen
              value={state.activeQuickSetPopoverContext.set.weightKg}
              onChange={actions.handleQuickSetValueChange}
              onApplyToAll={actions.handleQuickSetApplyToAll}
              onClose={actions.handleQuickSetPopoverClose}
              quickIncrements={[1.25, 5, 10, 15, 20] as const}
              anchorElement={state.quickSetPopoverAnchorElement}
            />
          ) : null}

          {state.activeQuickSetPopoverContext.field === "durationSeconds" ? (
            <DurationSetPickerPopover
              isOpen
              value={state.activeQuickSetPopoverContext.set.durationSeconds}
              onChange={actions.handleQuickSetValueChange}
              onApplyToAll={actions.handleQuickSetApplyToAll}
              onClose={actions.handleQuickSetPopoverClose}
              anchorElement={state.quickSetPopoverAnchorElement}
            />
          ) : null}

          {state.activeQuickSetPopoverContext.field === "reps" ? (
            <RepsSetPickerPopover
              isOpen
              value={state.activeQuickSetPopoverContext.set.reps}
              onChange={actions.handleQuickSetValueChange}
              onApplyToAll={actions.handleQuickSetApplyToAll}
              onClose={actions.handleQuickSetPopoverClose}
              anchorElement={state.quickSetPopoverAnchorElement}
            />
          ) : null}

          {state.activeQuickSetPopoverContext.field === "restSeconds" ? (
            <DurationSetPickerPopover
              isOpen
              title="Rest"
              value={state.activeQuickSetPopoverContext.set.restSeconds}
              onChange={actions.handleQuickSetValueChange}
              onApplyToAll={actions.handleQuickSetApplyToAll}
              onClose={actions.handleQuickSetPopoverClose}
              anchorElement={state.quickSetPopoverAnchorElement}
            />
          ) : null}
        </>
      ) : null}

      <ExerciseAddModal
        isOpen={state.isAddExerciseModalOpen}
        selectedExerciseIds={selectedExerciseIds}
        onAddExercise={actions.handleAddExercise}
        onRemoveExercise={actions.handleRemoveLibraryExercise}
        onClose={actions.handleAddExerciseModalClose}
      />
    </>
  );
}
