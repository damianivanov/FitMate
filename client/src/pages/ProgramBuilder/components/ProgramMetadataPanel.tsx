import { Dropdown, SegmentControl, TextInputField, TextareaField } from "@/shared/components";
import { SCHEDULE_TYPE_LABELS, TRAINING_GOAL_LABELS } from "@/shared/utils/programDisplay";
import { ProgramScheduleType, TrainingGoal } from "@/types";
import type { ProgramBuilderState } from "../utils/builderState";

type ProgramMetadataPanelProps = {
  builderState: ProgramBuilderState;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  onGoalChange: (goal: TrainingGoal) => void;
  onScheduleTypeChange: (scheduleType: ProgramScheduleType) => void;
  onStartDateChange: (startDate: string) => void;
  onEndDateChange: (endDate: string) => void;
  onOpenEndedChange: (isOpenEnded: boolean) => void;
};

const GOAL_OPTIONS = Object.entries(TRAINING_GOAL_LABELS).map(([value, label]) => ({
  value: Number(value) as TrainingGoal,
  label,
}));

const SCHEDULE_OPTIONS = Object.entries(SCHEDULE_TYPE_LABELS).map(([value, label]) => ({
  value: Number(value) as ProgramScheduleType,
  label,
}));

export function ProgramMetadataPanel({
  builderState,
  onNameChange,
  onDescriptionChange,
  onGoalChange,
  onScheduleTypeChange,
  onStartDateChange,
  onEndDateChange,
  onOpenEndedChange,
}: ProgramMetadataPanelProps) {
  const isCustom = builderState.scheduleType === ProgramScheduleType.CustomCalendar;
  const showEndDate = !builderState.isOpenEnded || isCustom;

  return (
    <section className="liquid-panel grid gap-4 rounded-2xl p-4 md:rounded-lg">
      <TextInputField
        label="Program name"
        required
        value={builderState.name}
        onChange={(event) => onNameChange(event.target.value)}
        placeholder="e.g. Upper/Lower — August"
      />

      <TextareaField
        label="Description"
        value={builderState.description}
        onChange={(event) => onDescriptionChange(event.target.value)}
        placeholder="Optional notes about this program"
        rows={2}
      />

      <Dropdown
        label="Goal"
        value={builderState.goal}
        options={GOAL_OPTIONS}
        onChange={(value) => {
          if (value !== null) {
            onGoalChange(value);
          }
        }}
      />

      <SegmentControl
        label="Schedule type"
        value={builderState.scheduleType}
        options={SCHEDULE_OPTIONS}
        onChange={onScheduleTypeChange}
      />

      <SegmentControl
        label="Length"
        value={builderState.isOpenEnded && !isCustom}
        options={[
          { label: "Fixed dates", value: false },
          { label: "Keeps going", value: true, disabled: isCustom },
        ]}
        onChange={onOpenEndedChange}
        helperText={isCustom ? "Custom calendar programs need an end date." : undefined}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInputField
          label="Start date"
          type="date"
          required
          value={builderState.startDate}
          onChange={(event) => onStartDateChange(event.target.value)}
        />
        {showEndDate ? (
          <TextInputField
            label="End date"
            type="date"
            required
            min={builderState.startDate}
            value={builderState.endDate}
            onChange={(event) => onEndDateChange(event.target.value)}
          />
        ) : null}
      </div>
    </section>
  );
}
