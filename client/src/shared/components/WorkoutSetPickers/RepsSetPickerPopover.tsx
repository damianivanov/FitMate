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

  const handleDecreaseClick = () => {
    const nextValue = clampNumber(boundedValue - normalizedStep, minValue, maxValue);
    onChange(nextValue);
  };

  const handleIncreaseClick = () => {
    const nextValue = clampNumber(boundedValue + normalizedStep, minValue, maxValue);
    onChange(nextValue);
  };

  const handleApplyToAllClick = () => {
    if (!onApplyToAll) {
      return;
    }

    onApplyToAll(boundedValue);
  };

  const buttonClassName =
    "flex h-12 w-12 cursor-pointer items-center justify-center rounded-2xl border border-(--input-border) bg-(--glass-bg-input) text-foreground transition active:scale-95 disabled:cursor-not-allowed disabled:border-(--glass-divider) disabled:bg-(--glass-bg-soft) disabled:text-muted";

  return (
    <SetPickerPopoverShell
      isOpen={isOpen}
      title="Reps"
      onClose={onClose}
      anchorElement={anchorElement}
      desktopWidthClassName="w-64"
    >
      <div className="rounded-3xl liquid-input px-4 pb-4 pt-3 text-center">
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleDecreaseClick}
            disabled={boundedValue <= minValue}
            className={buttonClassName}
            aria-label="Decrease reps"
          >
            <LuMinus className="h-5 w-5" />
          </button>

          <div className="mono min-w-16 text-center text-5xl font-bold leading-none text-foreground tabular-nums">
            {boundedValue}
          </div>

          <button
            type="button"
            onClick={handleIncreaseClick}
            disabled={boundedValue >= maxValue}
            className={buttonClassName}
            aria-label="Increase reps"
          >
            <LuPlus className="h-5 w-5" />
          </button>
        </div>

        {onApplyToAll ? (
          <button
            type="button"
            onClick={handleApplyToAllClick}
            className="mt-4 w-full cursor-pointer rounded-xl border border-primary-300 bg-primary-100/20 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary-100/35"
          >
            Apply To All Sets
          </button>
        ) : null}
      </div>
    </SetPickerPopoverShell>
  );
}
