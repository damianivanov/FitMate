import { LuMinus, LuPlus } from "react-icons/lu";
import { clampNumber } from "@/lib/helpers";

type RepsStepperProps = {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
};

export function RepsStepper({
  value,
  onChange,
  label = "Reps",
  min = 1,
  max = 50,
  step = 1,
  disabled = false,
  className = "",
}: RepsStepperProps) {
  const normalizedStep = Math.max(1, Math.round(step));
  const boundedValue = clampNumber(Math.round(value), min, max);

  const handleDecreaseClick = () => {
    if (disabled || boundedValue <= min) {
      return;
    }

    onChange(clampNumber(boundedValue - normalizedStep, min, max));
  };

  const handleIncreaseClick = () => {
    if (disabled || boundedValue >= max) {
      return;
    }

    onChange(clampNumber(boundedValue + normalizedStep, min, max));
  };

  const stepperButtonClassName =
    "flex h-12 w-12 cursor-pointer items-center justify-center rounded-2xl border border-(--input-border) bg-(--glass-bg-input) text-xl font-medium text-foreground transition active:scale-95 disabled:cursor-not-allowed disabled:border-(--glass-divider) disabled:bg-(--glass-bg-soft) disabled:text-muted";

  return (
    <div className={["space-y-3", className].filter(Boolean).join(" ")}>
      <div className="rounded-3xl liquid-input p-5 text-center">
        <p className="mb-3 text-sm text-secondary">{label}</p>
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            className={stepperButtonClassName}
            onClick={handleDecreaseClick}
            disabled={disabled || boundedValue <= min}
            aria-label={`Decrease ${label.toLowerCase()}`}
          >
            <LuMinus className="h-5 w-5" />
          </button>

          <div className="mono text-5xl font-bold leading-none text-foreground">{boundedValue}</div>

          <button
            type="button"
            className={stepperButtonClassName}
            onClick={handleIncreaseClick}
            disabled={disabled || boundedValue >= max}
            aria-label={`Increase ${label.toLowerCase()}`}
          >
            <LuPlus className="h-5 w-5" />
          </button>
        </div>

      </div>
    </div>
  );
}

