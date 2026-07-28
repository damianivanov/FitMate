import { useState } from "react";
import { LuCalendarClock } from "react-icons/lu";
import { formatDateOnly } from "@/shared/utils/dateOnly";
import type { ProgramPlanDayModel } from "@/types";
import { OutlinedButton, PrimaryButton } from "./Buttons";
import { TextInputField } from "./Inputs";
import { Modal } from "./Modal";

type MoveProgramDayModalProps = {
  isOpen: boolean;
  day: ProgramPlanDayModel | null;
  /** "yyyy-MM-dd" bounds for the date input (plan range). */
  minDate?: string;
  maxDate?: string;
  isMoving: boolean;
  onCancel: () => void;
  onConfirm: (newDate: string) => void;
};

type MoveProgramDayFormProps = Omit<MoveProgramDayModalProps, "isOpen" | "day"> & {
  day: ProgramPlanDayModel;
};

/**
 * Split out so the modal can mount it keyed by day id: the picker then starts from the day's
 * current date on every open, with no state-syncing effect.
 */
function MoveProgramDayForm({
  day,
  minDate,
  maxDate,
  isMoving,
  onCancel,
  onConfirm,
}: MoveProgramDayFormProps) {
  const [newDate, setNewDate] = useState(day.scheduledDate);

  return (
    <div className="grid gap-4 p-5">
      <p className="text-sm text-secondary">
        <span className="font-semibold text-foreground">{day.workoutTemplateName ?? "Workout"}</span>{" "}
        is scheduled for {formatDateOnly(day.scheduledDate)}. Pick a new date.
      </p>

      <TextInputField
        label="New date"
        type="date"
        required
        min={minDate}
        max={maxDate}
        value={newDate}
        onChange={(event) => setNewDate(event.target.value)}
      />

      <footer className="flex items-center justify-end gap-3">
        <OutlinedButton onClick={onCancel} disabled={isMoving}>
          Cancel
        </OutlinedButton>
        <PrimaryButton
          onClick={() => onConfirm(newDate)}
          disabled={isMoving || !newDate || newDate === day.scheduledDate}
        >
          {isMoving ? "Moving..." : "Move workout"}
        </PrimaryButton>
      </footer>
    </div>
  );
}

export function MoveProgramDayModal({
  isOpen,
  day,
  minDate,
  maxDate,
  isMoving,
  onCancel,
  onConfirm,
}: MoveProgramDayModalProps) {
  if (!day) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title="Move workout"
      titleIcon={<LuCalendarClock className="h-5 w-5 text-primary" />}
      maxWidth="sm"
    >
      <MoveProgramDayForm
        key={day.id}
        day={day}
        minDate={minDate}
        maxDate={maxDate}
        isMoving={isMoving}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    </Modal>
  );
}
