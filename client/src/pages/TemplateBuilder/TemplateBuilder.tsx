import { AddExerciseModal } from "./components/AddExerciseModal";
import { DurationSetPickerPopover } from "./components/DurationSetPickerPopover";
import { RepsSetPickerPopover } from "./components/RepsSetPickerPopover";
import { TemplateBuilderExerciseBoard } from "./components/TemplateBuilderExerciseBoard";
import { TemplateBuilderHeader } from "./components/TemplateBuilderHeader";
import { TemplateBuilderMetadataPanel } from "./components/TemplateBuilderMetadataPanel";
import { WeightSetPickerPopover } from "./components/WeightSetPickerPopover";
import { useTemplateBuilderPage } from "./hooks/useTemplateBuilderPage";
import { QuickSetField } from "./store/templateBuilderStore";

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
              <TemplateBuilderExerciseBoard onOpenQuickSetPopover={handleQuickSetPopoverOpen} />
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

      <AddExerciseModal />
    </>
  );
}
