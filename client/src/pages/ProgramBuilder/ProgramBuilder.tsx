import {
  ActivateProgramModal,
  AsyncSection,
  BackHeader,
  NativePage,
  PageBody,
  TemplatePickerModal,
} from "@/shared/components";
import { useNavigate } from "react-router";
import { ProgramScheduleType } from "@/types";
import { CustomCalendarEditor } from "./components/CustomCalendarEditor";
import { FixedWeekdaysEditor } from "./components/FixedWeekdaysEditor";
import { ProgramMetadataPanel } from "./components/ProgramMetadataPanel";
import { RotationEditor } from "./components/RotationEditor";
import { useProgramBuilderPage } from "./hooks/useProgramBuilderPage";

export default function ProgramBuilder() {
  const { state, actions } = useProgramBuilderPage();
  const { builderState } = state;
  const navigate = useNavigate();

  return (
    <>
      <PageBody>
        <NativePage>
          <BackHeader
            title={state.isEditing ? "Edit program" : "New program"}
            onBack={() => navigate("/program")}
            action={
              <button
                type="button"
                onClick={actions.saveDraft}
                disabled={state.isSaving}
                className="native-header-save"
              >
                {state.isSaving ? "Saving..." : "Save"}
              </button>
            }
          />

          <AsyncSection
            isLoading={state.isLoading}
            error={state.loadError}
            loadingLabel="Loading draft..."
          >
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

            <div className="pd-actions">
              <button
                type="button"
                onClick={actions.requestActivate}
                disabled={state.isSaving}
                className="native-primary-action"
              >
                {state.isSaving ? "Saving..." : "Activate program"}
              </button>
              <button
                type="button"
                onClick={actions.saveDraft}
                disabled={state.isSaving}
                className="native-ghost-action"
              >
                Save as draft
              </button>
            </div>
          </AsyncSection>
        </NativePage>
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
