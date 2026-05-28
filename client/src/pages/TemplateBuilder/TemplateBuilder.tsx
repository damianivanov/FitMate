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
import { QuickSetField, useTemplateBuilderStore } from "./store/templateBuilderStore";

const TEMPLATE_CAPABILITIES: ExerciseBuilderCapabilities = {
  showRestColumn: true,
  showCompletionCheckbox: false,
  showSetTypeDropdown: false,
  showPreviousColumn: false,
  allowCollapse: true,
  allowExerciseDnd: true,
  allowSetDnd: true,
};

export default function TemplateBuilder() {
  const {
    handleDiscardClick,
    handleSaveTemplateClick,
    isSavingTemplate,
    isBuilderLoading,
    templateLoadError,
    isSaveTemplateDisabled,
    saveTemplateLabel,
    activeQuickSetPopoverContext,
    quickSetPopoverAnchorElement,
    handleQuickSetPopoverOpen,
    handleQuickSetPopoverClose,
    handleQuickSetValueChange,
    handleQuickSetApplyToAll,
  } = useTemplateBuilderPage();

  const exercises = useTemplateBuilderStore((state) => state.exercises);
  const exerciseIndex = useTemplateBuilderStore((state) => state.exerciseIndex);
  const durationEnabledExerciseIds = useTemplateBuilderStore((state) => state.durationEnabledExerciseIds);
  const isAddExerciseModalOpen = useTemplateBuilderStore((state) => state.isAddExerciseModalOpen);
  const quickSetPopover = useTemplateBuilderStore((state) => state.quickSetPopover);
  const addExerciseFeedback = useTemplateBuilderStore((state) => state.addExerciseFeedback);

  const openAddExerciseModal = useTemplateBuilderStore((state) => state.openAddExerciseModal);
  const openAddExerciseModalForGroup = useTemplateBuilderStore((state) => state.openAddExerciseModalForGroup);
  const closeAddExerciseModal = useTemplateBuilderStore((state) => state.closeAddExerciseModal);
  const addLibraryExercise = useTemplateBuilderStore((state) => state.addLibraryExercise);
  const removeLibraryExercise = useTemplateBuilderStore((state) => state.removeLibraryExercise);
  const setExerciseNotes = useTemplateBuilderStore((state) => state.setExerciseNotes);
  const setExerciseGrouping = useTemplateBuilderStore((state) => state.setExerciseGrouping);
  const setExerciseMetricMode = useTemplateBuilderStore((state) => state.setExerciseMetricMode);
  const removeExercise = useTemplateBuilderStore((state) => state.removeExercise);
  const addExerciseSet = useTemplateBuilderStore((state) => state.addExerciseSet);
  const removeExerciseSet = useTemplateBuilderStore((state) => state.removeExerciseSet);
  const reorderExerciseSet = useTemplateBuilderStore((state) => state.reorderExerciseSet);
  const toggleExerciseCollapse = useTemplateBuilderStore((state) => state.toggleExerciseCollapse);
  const setGroupCollapse = useTemplateBuilderStore((state) => state.setGroupCollapse);
  const endExerciseDrag = useTemplateBuilderStore((state) => state.endExerciseDrag);

  const exerciseIndexById = useMemo(
    () => new Map(exerciseIndex.map((item) => [item.id, item] as const)),
    [exerciseIndex],
  );

  const exerciseVms = useMemo<ExerciseBuilderExerciseVM[]>(
    () => exercises.map((exercise) => ({
      id: exercise.id,
      exerciseId: exercise.exerciseId,
      displayName: exerciseIndexById.get(exercise.exerciseId)?.name ?? `Exercise #${exercise.exerciseId}`,
      groupId: exercise.groupId ?? null,
      groupType: exercise.groupType,
      notes: exercise.notes,
      collapsed: exercise.collapsed,
      isDurationEnabled: durationEnabledExerciseIds.has(exercise.id),
      sets: exercise.sets.map((set) => ({
        id: set.id,
        weightKg: set.weightKg,
        reps: set.reps,
        durationSeconds: set.durationSeconds,
        restSeconds: set.restSeconds,
      })),
    })),
    [exercises, exerciseIndexById, durationEnabledExerciseIds],
  );

  const callbacks = useMemo<ExerciseBuilderCallbacks>(() => ({
    onOpenQuickSetPopover: (exerciseId, setId, field, anchorElement) => {
      handleQuickSetPopoverOpen(exerciseId, setId, field as QuickSetField, anchorElement);
    },
    onExerciseNotesChange: setExerciseNotes,
    onExerciseMetricModeChange: (exerciseId, isDurationEnabled) => {
      setExerciseMetricMode(exerciseId, !isDurationEnabled);
    },
    onExerciseGroupingChange: setExerciseGrouping,
    onRemoveExercise: removeExercise,
    onAddSet: addExerciseSet,
    onRemoveSet: removeExerciseSet,
    onAddExerciseClick: openAddExerciseModal,
    onAddExerciseToGroup: (insertAfterExerciseId, groupType, groupId) => {
      openAddExerciseModalForGroup(insertAfterExerciseId, groupType, groupId);
    },
    onToggleExerciseCollapse: toggleExerciseCollapse,
    onSetGroupCollapse: setGroupCollapse,
    onExerciseReorder: endExerciseDrag,
    onSetReorder: reorderExerciseSet,
  }), [
    addExerciseSet,
    endExerciseDrag,
    handleQuickSetPopoverOpen,
    openAddExerciseModal,
    openAddExerciseModalForGroup,
    removeExercise,
    removeExerciseSet,
    reorderExerciseSet,
    setExerciseGrouping,
    setExerciseMetricMode,
    setExerciseNotes,
    setGroupCollapse,
    toggleExerciseCollapse,
  ]);

  const selectedExerciseIds = useMemo(
    () => exercises.map((exercise) => exercise.exerciseId),
    [exercises],
  );

  return (
    <>
      <TemplateBuilderHeader
        onDiscardClick={handleDiscardClick}
        onSaveTemplateClick={handleSaveTemplateClick}
        isSavingTemplate={isSavingTemplate}
        isSaveTemplateDisabled={isSaveTemplateDisabled}
        saveTemplateLabel={saveTemplateLabel}
      />

      <div className="liquid-scrollbar flex-1 overflow-y-auto px-3 pb-24 pt-4 md:px-8 md:pb-6 md:pt-6">
        {isBuilderLoading ? (
          <div className="liquid-panel rounded-2xl px-5 py-8 text-center md:rounded-lg">
            <p className="text-sm font-semibold text-foreground">Loading template...</p>
          </div>
        ) : null}

        {!isBuilderLoading && templateLoadError ? (
          <div className="liquid-panel rounded-2xl px-5 py-8 text-center md:rounded-lg">
            <p className="text-sm font-semibold text-danger">{templateLoadError}</p>
          </div>
        ) : null}

        {!isBuilderLoading && !templateLoadError ? (
          <div className="w-full space-y-6">
            <section className="min-w-0 md:space-y-4">
              <TemplateBuilderMetadataPanel />
              <ExerciseBoard
                exercises={exerciseVms}
                capabilities={TEMPLATE_CAPABILITIES}
                callbacks={callbacks}
                isInteractionLocked={isAddExerciseModalOpen || quickSetPopover !== null}
              />
            </section>
          </div>
        ) : null}
      </div>

      {activeQuickSetPopoverContext && quickSetPopoverAnchorElement ? (
        <>
          {activeQuickSetPopoverContext.field === QuickSetField.WeightKg ? (
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

          {activeQuickSetPopoverContext.field === QuickSetField.DurationSeconds ? (
            <DurationSetPickerPopover
              isOpen
              value={activeQuickSetPopoverContext.set.durationSeconds}
              onChange={handleQuickSetValueChange}
              onApplyToAll={handleQuickSetApplyToAll}
              onClose={handleQuickSetPopoverClose}
              anchorElement={quickSetPopoverAnchorElement}
            />
          ) : null}

          {activeQuickSetPopoverContext.field === QuickSetField.Reps ? (
            <RepsSetPickerPopover
              isOpen
              value={activeQuickSetPopoverContext.set.reps}
              onChange={handleQuickSetValueChange}
              onApplyToAll={handleQuickSetApplyToAll}
              onClose={handleQuickSetPopoverClose}
              anchorElement={quickSetPopoverAnchorElement}
            />
          ) : null}

          {activeQuickSetPopoverContext.field === QuickSetField.RestSeconds ? (
            <DurationSetPickerPopover
              isOpen
              title="Rest"
              value={activeQuickSetPopoverContext.set.restSeconds}
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
        selectedExerciseIds={selectedExerciseIds}
        onAddExercise={addLibraryExercise}
        onRemoveExercise={removeLibraryExercise}
        onClose={closeAddExerciseModal}
        feedback={addExerciseFeedback}
      />
    </>
  );
}
