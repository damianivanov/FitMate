import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { LuMinus, LuPlus } from "react-icons/lu";
import { clampNumber, formatNumber, roundToPrecision } from "@/lib/helpers";
import { SetPickerPopoverShell } from "./SetPickerPopoverShell";

type WeightSetPickerPopoverProps = {
  value?: number;
  isOpen: boolean;
  onChange: (value: number) => void;
  onClose: () => void;
  anchorElement?: HTMLElement | null;
  onApplyToAll?: (value: number) => void;
  title?: string;
  unitLabel?: string;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  quickIncrements?: readonly number[];
};

function getWeightValueSizeClassName(valueText: string): string {
  const normalizedLength = valueText.replace(/[^\d]/g, "").length;

  if (normalizedLength >= 5) {
    return "text-2xl";
  }

  if (normalizedLength >= 4) {
    return "text-4xl";
  }

  return "text-5xl";
}

export function WeightSetPickerPopover({
  value,
  isOpen,
  onChange,
  onClose,
  anchorElement = null,
  onApplyToAll,
  title = "Weight",
  unitLabel = "kg",
  min = 0,
  max = 300,
  step = 0.5,
  precision = 2,
  quickIncrements = [1.25, 5, 10],
}: WeightSetPickerPopoverProps) {
  const lowerCaseTitle = title.toLowerCase();
  const minValue = Math.min(min, max);
  const maxValue = Math.max(min, max);
  const normalizedStep = step > 0 ? step : 0.5;
  const normalizedPrecision = Math.max(0, Math.floor(precision));
  const boundedValue = clampNumber(
    roundToPrecision(value ?? minValue, normalizedPrecision),
    minValue,
    maxValue,
  );
  const validQuickIncrements = quickIncrements.filter((increment) => increment > 0);
  const [lastQuickIncrementStep, setLastQuickIncrementStep] = useState(normalizedStep);
  const [isEditingValue, setIsEditingValue] = useState(false);
  const [draftValue, setDraftValue] = useState(formatNumber(boundedValue, normalizedPrecision));
  const formattedBoundedValue = formatNumber(boundedValue, normalizedPrecision);
  const draftValueSizeClassName = getWeightValueSizeClassName(draftValue);
  const displayValueSizeClassName = getWeightValueSizeClassName(formattedBoundedValue);
  const valueInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isEditingValue || !valueInputRef.current) {
      return;
    }

    const inputElement = valueInputRef.current;
    inputElement.focus();
    const cursorPosition = inputElement.value.length;
    inputElement.setSelectionRange(cursorPosition, cursorPosition);
  }, [isEditingValue]);

  const parseDraftValue = (valueText: string): number | null => {
    const trimmedValueText = valueText.trim().replace(",", ".");
    if (!trimmedValueText) {
      return null;
    }

    const parsedValue = Number(trimmedValueText);
    if (!Number.isFinite(parsedValue)) {
      return null;
    }

    return clampNumber(
      roundToPrecision(parsedValue, normalizedPrecision),
      minValue,
      maxValue,
    );
  };

  const commitDraftValue = () => {
    const parsedDraftValue = parseDraftValue(draftValue);
    if (parsedDraftValue === null) {
      setDraftValue(formatNumber(boundedValue, normalizedPrecision));
      setIsEditingValue(false);
      return;
    }

    onChange(parsedDraftValue);
    setDraftValue(formatNumber(parsedDraftValue, normalizedPrecision));
    setIsEditingValue(false);
  };

  const handleValueDisplayClick = () => {
    setDraftValue(formatNumber(boundedValue, normalizedPrecision));
    setIsEditingValue(true);
  };

  const handleDraftValueChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextDraftValue = event.target.value.replace(",", ".");
    const numberPattern = minValue < 0 ? /^-?\d*\.?\d*$/ : /^\d*\.?\d*$/;
    if (!numberPattern.test(nextDraftValue)) {
      return;
    }

    setDraftValue(nextDraftValue);
  };

  const handleDraftValueBlur = () => {
    commitDraftValue();
  };

  const handleDraftValueKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitDraftValue();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setDraftValue(formatNumber(boundedValue, normalizedPrecision));
      setIsEditingValue(false);
    }
  };

  const handleDecreaseClick = () => {
    const decrementStep = lastQuickIncrementStep > 0 ? lastQuickIncrementStep : normalizedStep;
    const nextValue = clampNumber(
      roundToPrecision(boundedValue - decrementStep, normalizedPrecision),
      minValue,
      maxValue,
    );
    onChange(nextValue);
  };

  const handleIncreaseClick = () => {
    const nextValue = clampNumber(
      roundToPrecision(boundedValue + normalizedStep, normalizedPrecision),
      minValue,
      maxValue,
    );
    onChange(nextValue);
  };

  const handleApplyToAllClick = () => {
    if (!onApplyToAll) {
      return;
    }

    onApplyToAll(boundedValue);
  };

  const handleQuickIncrementClick = (increment: number) => {
    const nextValue = clampNumber(
      roundToPrecision(boundedValue + increment, normalizedPrecision),
      minValue,
      maxValue,
    );
    setLastQuickIncrementStep(increment);
    onChange(nextValue);
  };

  const buttonClassName =
    "flex h-12 w-12 cursor-pointer items-center justify-center rounded-2xl border border-(--input-border) bg-(--glass-bg-input) text-foreground transition active:scale-95 disabled:cursor-not-allowed disabled:border-(--glass-divider) disabled:bg-(--glass-bg-soft) disabled:text-muted";

  return (
    <SetPickerPopoverShell
      isOpen={isOpen}
      title={title}
      onClose={onClose}
      anchorElement={anchorElement}
      desktopWidthClassName="w-72"
    >
      <div className="rounded-3xl liquid-input px-4 pb-4 pt-3 text-center">
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleDecreaseClick}
            disabled={boundedValue <= minValue}
            className={buttonClassName}
            aria-label={`Decrease ${lowerCaseTitle}`}
          >
            <LuMinus className="h-5 w-5" />
          </button>

          <div className="min-w-20">
            {isEditingValue ? (
              <input
                ref={valueInputRef}
                type="text"
                inputMode="decimal"
                value={draftValue}
                onChange={handleDraftValueChange}
                onBlur={handleDraftValueBlur}
                onKeyDown={handleDraftValueKeyDown}
                className={[
                  "mono h-14 w-24 bg-transparent text-center font-bold leading-none text-foreground tabular-nums outline-none",
                  draftValueSizeClassName,
                ].join(" ")}
                aria-label={`Edit ${lowerCaseTitle} value`}
              />
            ) : (
              <button
                type="button"
                onClick={handleValueDisplayClick}
                className={[
                  "mono h-14 min-w-20 cursor-text text-center font-bold leading-none text-foreground tabular-nums",
                  displayValueSizeClassName,
                ].join(" ")}
                aria-label={`Edit ${lowerCaseTitle} value`}
              >
                {formattedBoundedValue}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleIncreaseClick}
            disabled={boundedValue >= maxValue}
            className={buttonClassName}
            aria-label={`Increase ${lowerCaseTitle}`}
          >
            <LuPlus className="h-5 w-5" />
          </button>
        </div>

        {unitLabel ? <p className="mt-2 text-sm text-secondary">{unitLabel}</p> : null}

        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {validQuickIncrements.map((increment) => (
              <button
                key={increment}
                type="button"
                onClick={() => handleQuickIncrementClick(increment)}
                className="cursor-pointer rounded-full border border-primary-300 px-3 py-1 text-xs font-semibold text-primary shadow-none transition hover:bg-primary-200 hover:shadow-none focus:shadow-none"
              >
                +{formatNumber(increment, normalizedPrecision)}
              </button>
          ))}
        </div>

        {onApplyToAll ? (
          <button
            type="button"
            onClick={handleApplyToAllClick}
            className="mt-3 w-full cursor-pointer rounded-xl border border-primary-300 bg-primary-100/20 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary-100/35"
          >
            Apply To All Sets
          </button>
        ) : null}
      </div>
    </SetPickerPopoverShell>
  );
}
