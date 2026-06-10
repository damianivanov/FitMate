import { LuLoaderCircle, LuPlus } from "react-icons/lu";
import { TextareaField, WeightStepper } from "@/shared/components";

type QuickLogCardProps = {
  weightKg: number;
  bodyFat: number;
  note: string;
  isLogging: boolean;
  onWeightChange: (value: number) => void;
  onBodyFatChange: (value: number) => void;
  onNoteChange: (value: string) => void;
  onLog: () => void;
};

export function QuickLogCard({
  weightKg,
  bodyFat,
  note,
  isLogging,
  onWeightChange,
  onBodyFatChange,
  onNoteChange,
  onLog,
}: QuickLogCardProps) {
  return (
    <div className="liquid-panel space-y-4 rounded-2xl p-5 md:rounded-lg">
      <div>
        <h2 className="text-lg font-bold text-foreground">Quick log</h2>
        <p className="mt-0.5 text-sm text-secondary">Record today's body weight.</p>
      </div>

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
        onClick={onLog}
        disabled={isLogging}
        className="liquid-primary-btn inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLogging ? <LuLoaderCircle className="h-4 w-4 animate-spin" /> : <LuPlus className="h-4 w-4" />}
        <span>{isLogging ? "Logging" : "Log weight"}</span>
      </button>
    </div>
  );
}
