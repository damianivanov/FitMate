import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { LuMinus, LuPlus } from "react-icons/lu";
import { clampNumber, formatNumber, roundToPrecision } from "@/lib/helpers";

type WeightStepperProps = {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  min?: number;
  max?: number;
  unit?: string;
  quickIncrements?: ReadonlyArray<number>;
  buttonStep?: number;
  precision?: number;
  disabled?: boolean;
  className?: string;
};

export function WeightStepper({
  value,
  onChange,
  label = "Weight",
  min = 0,
  max = 500,
  unit = "kg",
  quickIncrements = [1.25, 2.5, 5, 10],
  buttonStep = 0.5,
  precision = 2,
  disabled = false,
  className = "",
}: WeightStepperProps) {
  const normalizedButtonStep = buttonStep > 0 ? buttonStep : 0.5;
  const boundedValue = clampNumber(roundToPrecision(value, precision), min, max);
  const displayValue = formatNumber(boundedValue, precision);
  const [draftValue, setDraftValue] = useState(displayValue);
  const [isEditingValue, setIsEditingValue] = useState(false);
  const valueInputRef = useRef<HTMLInputElement | null>(null);

  const [integerPart, decimalPart] = displayValue.split(".");
  const integerDigitCount = integerPart.replace(/[^0-9]/g, "").length;

  let displayValueSizeClassName = "text-5xl";
  if (integerDigitCount >= 6) {
    displayValueSizeClassName = "text-3xl";
  } else if (integerDigitCount >= 5) {
    displayValueSizeClassName = "text-4xl";
  } else if (integerDigitCount >= 4) {
    displayValueSizeClassName = "text-[2.7rem]";
  }

  useEffect(() => {
    if (!isEditingValue || !valueInputRef.current) {
      return;
    }

    const inputElement = valueInputRef.current;
    inputElement.focus();
    const cursorPosition = inputElement.value.length;
    inputElement.setSelectionRange(cursorPosition, cursorPosition);
  }, [isEditingValue]);

  const handleDecreaseClick = () => {
    if (disabled || boundedValue <= min) {
      return;
    }

    const nextValue = clampNumber(boundedValue - normalizedButtonStep, min, max);
    onChange(roundToPrecision(nextValue, precision));
  };

  const handleIncreaseClick = () => {
    if (disabled || boundedValue >= max) {
      return;
    }

    const nextValue = clampNumber(boundedValue + normalizedButtonStep, min, max);
    onChange(roundToPrecision(nextValue, precision));
  };

  const handleQuickIncrementClick = (increment: number) => {
    if (disabled || increment <= 0 || boundedValue >= max) {
      return;
    }

    const nextValue = clampNumber(boundedValue + increment, min, max);
    onChange(roundToPrecision(nextValue, precision));
  };

  const handleWeightInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextDraftValue = event.target.value.replace(",", ".");
    const numberPattern = min < 0 ? /^-?\d*\.?\d*$/ : /^\d*\.?\d*$/;
    if (!numberPattern.test(nextDraftValue)) {
      return;
    }

    setDraftValue(nextDraftValue);

    if (!nextDraftValue.trim() || nextDraftValue === "." || nextDraftValue === "-" || nextDraftValue === "-.") {
      return;
    }

    const parsedValue = Number(nextDraftValue);
    if (!Number.isFinite(parsedValue)) {
      return;
    }

    const nextValue = clampNumber(roundToPrecision(parsedValue, precision), min, max);
    onChange(nextValue);
  };

  const commitDraftValue = () => {
    if (!draftValue.trim()) {
      setDraftValue(displayValue);
      setIsEditingValue(false);
      return;
    }

    const parsedValue = Number(draftValue);
    if (!Number.isFinite(parsedValue)) {
      setDraftValue(displayValue);
      setIsEditingValue(false);
      return;
    }

    const nextValue = clampNumber(roundToPrecision(parsedValue, precision), min, max);
    onChange(nextValue);
    setDraftValue(formatNumber(nextValue, precision));
    setIsEditingValue(false);
  };

  const handleWeightInputBlur = () => {
    commitDraftValue();
  };

  const handleWeightInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitDraftValue();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setDraftValue(displayValue);
      setIsEditingValue(false);
    }
  };

  const handleValueDisplayClick = () => {
    if (disabled) {
      return;
    }

    setDraftValue(displayValue);
    setIsEditingValue(true);
  };

  const stepperButtonClassName =
    "flex h-12 w-12 cursor-pointer items-center justify-center rounded-2xl border border-(--input-border) bg-(--glass-bg-input) text-xl text-foreground transition active:scale-95 disabled:cursor-not-allowed disabled:border-(--glass-divider) disabled:bg-(--glass-bg-soft) disabled:text-muted";

  return (
    <div className={["space-y-3", className].filter(Boolean).join(" ")}>
      <div className="rounded-3xl liquid-input p-5 text-center">
        <p className="mb-3 text-sm text-secondary">{label}</p>
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            className={stepperButtonClassName}
            onClick={handleDecreaseClick}
            disabled={disabled || boundedValue <= min}
            aria-label={`Decrease ${label.toLowerCase()}`}
          >
            <LuMinus className="h-5 w-5" />
          </button>

          <div>
            {isEditingValue ? (
              <input
                ref={valueInputRef}
                type="text"
                inputMode="decimal"
                value={draftValue}
                onChange={handleWeightInputChange}
                onBlur={handleWeightInputBlur}
                onKeyDown={handleWeightInputKeyDown}
                disabled={disabled}
                className="mono h-14 w-24 cursor-text bg-transparent text-center text-4xl font-bold leading-none text-foreground tabular-nums outline-none disabled:cursor-not-allowed disabled:opacity-60"
                aria-label={`${label} value`}
              />
            ) : (
              <button
                type="button"
                onClick={handleValueDisplayClick}
                disabled={disabled}
                className="flex h-14 w-24 cursor-text! items-end justify-center bg-transparent outline-none disabled:cursor-not-allowed disabled:opacity-60"
                aria-label={`Edit ${label.toLowerCase()} value`}
              >
                <span className="relative inline-flex items-end justify-center">
                  <span className={["mono font-bold leading-none text-foreground tabular-nums", displayValueSizeClassName].join(" ")}>
                    {integerPart || "0"}
                  </span>
                  {decimalPart ? (
                    <span className="mono absolute bottom-1 -right-3 text-xs font-semibold leading-none text-secondary tabular-nums">
                      .{decimalPart}
                    </span>
                  ) : null}
                </span>
              </button>
            )}
          </div>

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

        <div className="mt-3 text-xs text-secondary">{unit}</div>

        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {quickIncrements.map((increment) => {
            const incrementClassName =
            "cursor-pointer rounded-full border border-primary-300 px-3 py-1 text-xs text-primary transition hover:bg-primary-200 disabled:cursor-not-allowed disabled:border-(--glass-divider) disabled:bg-(--glass-bg-soft) disabled:text-muted";
            
            return (
              <button
              key={increment}
              type="button"
              className={incrementClassName}
              onClick={() => handleQuickIncrementClick(increment)}
              disabled={disabled || boundedValue >= max}
              >
                +{formatNumber(increment, precision)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

