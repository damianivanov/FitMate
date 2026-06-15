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
    return "text-3xl";
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
  const stepOptions = quickIncrements.filter((increment) => increment > 0);

  // The selected step drives BOTH the minus and plus buttons (symmetric adjustment).
  const [selectedStep, setSelectedStep] = useState(() => stepOptions[0] ?? normalizedStep);
  const [isEditingValue, setIsEditingValue] = useState(false);
  const [draftValue, setDraftValue] = useState(formatNumber(boundedValue, normalizedPrecision));
  const formattedBoundedValue = formatNumber(boundedValue, normalizedPrecision);
  const draftValueSizeClassName = getWeightValueSizeClassName(draftValue);
  const displayValueSizeClassName = getWeightValueSizeClassName(formattedBoundedValue);
  const formattedStep = formatNumber(selectedStep, normalizedPrecision);
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

  const adjustValueByStep = (direction: -1 | 1) => {
    const nextValue = clampNumber(
      roundToPrecision(boundedValue + direction * selectedStep, normalizedPrecision),
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

  const stepButtonClassName =
    "liquid-press flex h-16 flex-1 items-center justify-center gap-2 rounded-2xl border border-(--input-border) bg-(--glass-bg-input) text-foreground transition disabled:cursor-not-allowed disabled:border-(--glass-divider) disabled:bg-(--glass-bg-soft) disabled:text-muted";

  return (
    <SetPickerPopoverShell
      isOpen={isOpen}
      title={title}
      onClose={onClose}
      anchorElement={anchorElement}
      desktopWidthClassName="w-72"
    >
      <div className="liquid-input rounded-3xl px-4 pb-4 pt-4 text-center">
        {/* Big, tappable value */}
        <div className="flex flex-col items-center">
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
                "mono h-14 w-full bg-transparent text-center font-bold leading-none text-foreground tabular-nums outline-none",
                draftValueSizeClassName,
              ].join(" ")}
              aria-label={`Edit ${lowerCaseTitle} value`}
            />
          ) : (
            <button
              type="button"
              onClick={handleValueDisplayClick}
              className={[
                "mono flex h-14 w-full cursor-text items-center justify-center text-center font-bold leading-none text-foreground tabular-nums",
                displayValueSizeClassName,
              ].join(" ")}
              aria-label={`Edit ${lowerCaseTitle} value`}
            >
              {formattedBoundedValue}
            </button>
          )}
          {unitLabel ? <p className="mt-1 text-sm text-secondary">{unitLabel}</p> : null}
        </div>

        {/* Symmetric steppers (step by the selected increment) */}
        <div className="mt-4 flex items-stretch gap-3">
          <button
            type="button"
            onClick={() => adjustValueByStep(-1)}
            disabled={boundedValue <= minValue}
            className={stepButtonClassName}
            aria-label={`Decrease ${lowerCaseTitle} by ${formattedStep}`}
          >
            <LuMinus className="h-5 w-5" />
            <span className="mono text-lg font-bold tabular-nums">{formattedStep}</span>
          </button>

          <button
            type="button"
            onClick={() => adjustValueByStep(1)}
            disabled={boundedValue >= maxValue}
            className={stepButtonClassName}
            aria-label={`Increase ${lowerCaseTitle} by ${formattedStep}`}
          >
            <LuPlus className="h-5 w-5" />
            <span className="mono text-lg font-bold tabular-nums">{formattedStep}</span>
          </button>
        </div>

        {/* Step selector */}
        {stepOptions.length > 0 ? (
          <div className="mt-4">
            <p className="mb-2 text-2xs font-semibold uppercase tracking-widest text-muted">Step</p>
            <div className="flex gap-1.5" role="group" aria-label="Step size">
              {stepOptions.map((increment) => {
                const isSelected = increment === selectedStep;
                return (
                  <button
                    key={increment}
                    type="button"
                    onClick={() => setSelectedStep(increment)}
                    aria-pressed={isSelected}
                    className={[
                      "liquid-press h-11 flex-1 rounded-xl text-sm font-semibold tabular-nums transition",
                      isSelected
                        ? "border border-primary bg-primary text-white"
                        : "border border-(--input-border) bg-(--glass-bg-input) text-secondary hover:text-foreground",
                    ].join(" ")}
                  >
                    {formatNumber(increment, normalizedPrecision)}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

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
