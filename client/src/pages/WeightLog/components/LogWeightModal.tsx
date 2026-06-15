import { useState } from "react";
import { LuLoaderCircle, LuPlus } from "react-icons/lu";
import { Modal, TextareaField, WeightStepper } from "@/shared/components";

type LogWeightModalProps = {
  isOpen: boolean;
  weightKg: number;
  bodyFat: number;
  note: string;
  isLogging: boolean;
  onWeightChange: (value: number) => void;
  onBodyFatChange: (value: number) => void;
  onNoteChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
};

export function LogWeightModal({
  isOpen,
  weightKg,
  bodyFat,
  note,
  isLogging,
  onWeightChange,
  onBodyFatChange,
  onNoteChange,
  onSave,
  onClose,
}: LogWeightModalProps) {
  // Body fat is optional and stays hidden until the user reveals it, keeping the form compact.
  const [showBodyFat, setShowBodyFat] = useState(bodyFat > 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Log weight" maxWidth="md">
      <div className="space-y-4 p-5">
        <WeightStepper
          value={weightKg}
          onChange={onWeightChange}
          label="Body weight"
          unit="kg"
          min={20}
          max={500}
          buttonStep={0.1}
          quickIncrements={[0.5, 1, 2.5]}
          precision={1}
          disabled={isLogging}
        />

        {showBodyFat ? (
          <WeightStepper
            value={bodyFat}
            onChange={onBodyFatChange}
            label="Body fat (optional)"
            unit="%"
            min={0}
            max={75}
            buttonStep={0.1}
            quickIncrements={[0.5, 1, 2]}
            precision={1}
            disabled={isLogging}
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowBodyFat(true)}
            disabled={isLogging}
            className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-(--glass-divider) border-dashed bg-(--glass-bg-soft) py-2.5 text-sm font-semibold text-secondary transition hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LuPlus className="h-4 w-4" />
            <span>Add body fat</span>
          </button>
        )}

        <TextareaField
          label="Note (optional)"
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="How are you feeling?"
          maxLength={2000}
          disabled={isLogging}
        />

        <button
          type="button"
          onClick={onSave}
          disabled={isLogging}
          className="liquid-primary-btn inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLogging ? <LuLoaderCircle className="h-4 w-4 animate-spin" /> : <LuPlus className="h-4 w-4" />}
          <span>{isLogging ? "Saving" : "Save"}</span>
        </button>
      </div>
    </Modal>
  );
}
