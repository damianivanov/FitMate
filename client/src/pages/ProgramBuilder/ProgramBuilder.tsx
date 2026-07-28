import {
  ActivateProgramModal,
  AsyncSection,
  OutlinedButton,
  PageBody,
  PageHeader,
  PrimaryButton,
  TemplatePickerModal,
} from "@/shared/components";
import { ProgramScheduleType } from "@/types";
import { CustomCalendarEditor } from "./components/CustomCalendarEditor";
import { FixedWeekdaysEditor } from "./components/FixedWeekdaysEditor";
import { ProgramMetadataPanel } from "./components/ProgramMetadataPanel";
import { RotationEditor } from "./components/RotationEditor";
import { useProgramBuilderPage } from "./hooks/useProgramBuilderPage";

export default function ProgramBuilder() {
  const { state, actions } = useProgramBuilderPage();
  const { builderState } = state;

  return (
    <>
      <PageHeader
        title={state.isEditing ? "Edit program" : "New program"}
        subtitle="Build a training plan from your workout templates"
      />

      <PageBody>
        <AsyncSection
          isLoading={state.isLoading}
          error={state.loadError}
          loadingLabel="Loading draft..."
        >
          <div className="mx-auto grid max-w-3xl gap-4">
            <ProgramMetadataPanel
              builderState={builderState}
              onNameChange={actions.setName}
              onDescriptionChange={actions.setDescription}
              onGoalChange={actions.setGoal}
              onScheduleTypeChange={actions.setScheduleType}
              onStartDateChange={actions.setStartDate}
              onEndDateChange={actions.setEndDate}
              onOpenEndedChange={actions.setOpenEnded}
            />

            {builderState.scheduleType === ProgramScheduleType.FixedWeekdays ? (
              <FixedWeekdaysEditor
                weekdaySlots={builderState.weekdaySlots}
                onPickTemplate={(dayOfWeek) => actions.openPicker({ kind: "weekday", dayOfWeek })}
                onClear={actions.clearWeekday}
              />
            ) : null}

            {builderState.scheduleType === ProgramScheduleType.Rotation ? (
              <RotationEditor
                rotationSlots={builderState.rotationSlots}
                onPickTemplate={(localId) => actions.openPicker({ kind: "rotation", localId })}
                onSetRest={actions.setRotationRest}
                onAddDay={actions.addRotationDay}
                onRemoveDay={actions.removeRotationDay}
              />
            ) : null}

            {builderState.scheduleType === ProgramScheduleType.CustomCalendar ? (
              <CustomCalendarEditor
                customDays={builderState.customDays}
                minDate={builderState.startDate}
                maxDate={builderState.endDate}
                onPickTemplate={(localId) => actions.openPicker({ kind: "custom", localId })}
                onDateChange={actions.setCustomDayDate}
                onAddDay={actions.addCustomDay}
                onRemoveDay={actions.removeCustomDay}
              />
            ) : null}

            <footer className="flex items-center justify-end gap-3">
              <OutlinedButton onClick={actions.saveDraft} disabled={state.isSaving}>
                Save draft
              </OutlinedButton>
              <PrimaryButton onClick={actions.requestActivate} disabled={state.isSaving}>
                {state.isSaving ? "Saving..." : "Activate"}
              </PrimaryButton>
            </footer>
          </div>
        </AsyncSection>
      </PageBody>

      <TemplatePickerModal
        isOpen={state.isPickerOpen}
        onClose={actions.closePicker}
        onSelect={actions.assignTemplate}
      />

      <ActivateProgramModal
        isOpen={state.planPendingActivation !== null}
        plan={state.planPendingActivation}
        customDayCount={state.customDayCount}
        isActivating={state.isActivating}
        onCancel={actions.cancelActivate}
        onConfirm={actions.confirmActivate}
      />
    </>
  );
}
