import { LuMinus, LuPlus } from "react-icons/lu";
import { clampNumber } from "@/lib/helpers";
import { SetPickerPopoverShell } from "./SetPickerPopoverShell";

type RepsSetPickerPopoverProps = {
  value?: number;
  isOpen: boolean;
  onChange: (value: number) => void;
  onClose: () => void;
  anchorElement?: HTMLElement | null;
  onApplyToAll?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
};

export function RepsSetPickerPopover({
  value,
  isOpen,
  onChange,
  onClose,
  anchorElement = null,
  onApplyToAll,
  min = 1,
  max = 50,
  step = 1,
}: RepsSetPickerPopoverProps) {
  const minValue = Math.min(min, max);
  const maxValue = Math.max(min, max);
  const normalizedStep = Math.max(1, Math.round(step));
  const boundedValue = clampNumber(Math.round(value ?? minValue), minValue, maxValue);

  const adjustValueByStep = (direction: -1 | 1) => {
    const nextValue = clampNumber(boundedValue + direction * normalizedStep, minValue, maxValue);
    onChange(nextValue);
  };

  const handleApplyToAllClick = () => {
    if (!onApplyToAll) {
      return;
    }

    onApplyToAll(boundedValue);
  };

  const stepButtonClassName =
    "liquid-press flex h-16 flex-1 items-center justify-center rounded-2xl border border-(--input-border) bg-(--glass-bg-input) text-foreground transition disabled:cursor-not-allowed disabled:border-(--glass-divider) disabled:bg-(--glass-bg-soft) disabled:text-muted";

  return (
    <SetPickerPopoverShell
      isOpen={isOpen}
      title="Reps"
      onClose={onClose}
      anchorElement={anchorElement}
      desktopWidthClassName="w-64"
    >
      <div className="text-center">
        <div className="mono flex h-14 items-center justify-center text-5xl font-bold leading-none text-foreground tabular-nums">
          {boundedValue}
        </div>

        <div className="mt-4 flex items-stretch gap-3">
          <button
            type="button"
            onClick={() => adjustValueByStep(-1)}
            disabled={boundedValue <= minValue}
            className={stepButtonClassName}
            aria-label="Decrease reps"
          >
            <LuMinus className="h-6 w-6" />
          </button>

          <button
            type="button"
            onClick={() => adjustValueByStep(1)}
            disabled={boundedValue >= maxValue}
            className={stepButtonClassName}
            aria-label="Increase reps"
          >
            <LuPlus className="h-6 w-6" />
          </button>
        </div>

        {onApplyToAll ? (
          <button
            type="button"
            onClick={handleApplyToAllClick}
            className="liquid-press mt-4 w-full cursor-pointer rounded-xl border border-primary-300 bg-primary-100/20 px-3 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary-100/35"
          >
            Apply to all sets
          </button>
        ) : null}
      </div>
    </SetPickerPopoverShell>
  );
}
