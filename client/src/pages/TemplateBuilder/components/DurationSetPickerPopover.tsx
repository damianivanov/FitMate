import { useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { LuMinus, LuPlus } from "react-icons/lu";
import { clampNumber } from "@/lib/helpers";
import { SetPickerPopoverShell } from "./SetPickerPopoverShell";

type DurationSetPickerPopoverProps = {
  value?: number;
  isOpen: boolean;
  onChange: (value: number) => void;
  onClose: () => void;
  title?: string;
  anchorElement?: HTMLElement | null;
  onApplyToAll?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  quickPresets?: readonly number[];
};
const DEFAULT_DURATION_SECONDS = 90;
const FULL_DIAL_DEGREES = 360;
const DIAL_VIEWBOX_SIZE = 160;
const DIAL_CENTER = DIAL_VIEWBOX_SIZE / 2;
const DIAL_RING_RADIUS = 70;
const DIAL_RING_STROKE_WIDTH = 10;
const DIAL_RING_CIRCUMFERENCE = 2 * Math.PI * DIAL_RING_RADIUS;
const DIAL_KNOB_OFFSET_PX = 71;

export function DurationSetPickerPopover({
  value,
  isOpen,
  onChange,
  onClose,
  title = "Duration",
  anchorElement = null,
  onApplyToAll,
  min = 15,
  max = 300,
  step = 15,
  quickPresets = [30, 45, 60, 90, 120],
}: DurationSetPickerPopoverProps) {
  const dialRef = useRef<HTMLDivElement | null>(null);
  const activeDialPointerIdRef = useRef<number | null>(null);
  const minValue = Math.min(min, max);
  const maxValue = Math.max(min, max);
  const normalizedStep = Math.max(1, Math.round(step));
  const boundedValue = clampNumber(Math.round(value ?? DEFAULT_DURATION_SECONDS), minValue, maxValue);
  const validQuickPresets = quickPresets.filter((preset) => preset >= minValue && preset <= maxValue);
  const durationRange = maxValue - minValue;
  const progressRatio = durationRange > 0
    ? (boundedValue - minValue) / durationRange
    : 0;
  const dialAngleDegrees = progressRatio * FULL_DIAL_DEGREES;
  const dialAngleInRadians = ((dialAngleDegrees - 90) * Math.PI) / 180;
  const dialProgressStrokeDashOffset = DIAL_RING_CIRCUMFERENCE * (1 - progressRatio);
  const dialKnobStyle: CSSProperties = {
    left: `calc(50% + ${Math.cos(dialAngleInRadians) * DIAL_KNOB_OFFSET_PX}px)`,
    top: `calc(50% + ${Math.sin(dialAngleInRadians) * DIAL_KNOB_OFFSET_PX}px)`,
  };

  const normalizeDurationByStep = (nextValue: number): number => {
    if (durationRange <= 0) {
      return minValue;
    }

    const stepOffset = Math.round((nextValue - minValue) / normalizedStep);
    const steppedValue = minValue + stepOffset * normalizedStep;
    return clampNumber(steppedValue, minValue, maxValue);
  };

  const updateDurationFromPointerCoordinates = (clientX: number, clientY: number) => {
    if (!dialRef.current || durationRange <= 0) {
      return;
    }

    const dialRect = dialRef.current.getBoundingClientRect();
    const centerX = dialRect.left + dialRect.width / 2;
    const centerY = dialRect.top + dialRect.height / 2;
    const pointerAngle = Math.atan2(clientY - centerY, clientX - centerX);
    const clockwiseAngleFromTop = (pointerAngle * 180 / Math.PI + 90 + FULL_DIAL_DEGREES) % FULL_DIAL_DEGREES;
    const mappedValue = minValue + (clockwiseAngleFromTop / FULL_DIAL_DEGREES) * durationRange;
    onChange(normalizeDurationByStep(mappedValue));
  };

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

  const handlePresetClick = (preset: number) => {
    const nextValue = clampNumber(Math.round(preset), minValue, maxValue);
    onChange(nextValue);
  };

  const handleDialPointerStart = (
    pointerId: number,
    clientX: number,
    clientY: number,
  ) => {
    if (!dialRef.current) {
      return;
    }

    activeDialPointerIdRef.current = pointerId;
    dialRef.current.setPointerCapture(pointerId);
    updateDurationFromPointerCoordinates(clientX, clientY);
  };

  const handleProgressRingPointerDown = (event: ReactPointerEvent<SVGCircleElement>) => {
    event.preventDefault();
    handleDialPointerStart(event.pointerId, event.clientX, event.clientY);
  };

  const handleKnobPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    handleDialPointerStart(event.pointerId, event.clientX, event.clientY);
  };

  const handleDialPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activeDialPointerIdRef.current !== event.pointerId) {
      return;
    }

    updateDurationFromPointerCoordinates(event.clientX, event.clientY);
  };

  const handleDialPointerRelease = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activeDialPointerIdRef.current !== event.pointerId) {
      return;
    }

    if (dialRef.current && dialRef.current.hasPointerCapture(event.pointerId)) {
      dialRef.current.releasePointerCapture(event.pointerId);
    }

    activeDialPointerIdRef.current = null;
  };

  const buttonClassName =
    "flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-2xl border border-(--input-border) bg-(--glass-bg-input) text-foreground transition active:scale-95 disabled:cursor-not-allowed disabled:border-(--glass-divider) disabled:bg-(--glass-bg-soft) disabled:text-muted";

  return (
    <SetPickerPopoverShell
      isOpen={isOpen}
      title={title}
      onClose={onClose}
      anchorElement={anchorElement}
      desktopWidthClassName="w-fit min-w-80"
    >
      <div className="rounded-3xl liquid-input px-4 pb-4 pt-3 text-center">
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleDecreaseClick}
            disabled={boundedValue <= minValue}
            className={buttonClassName}
            aria-label="Decrease duration"
          >
            <LuMinus className="h-5 w-5" />
          </button>

          <div
            ref={dialRef}
            className="relative h-40 w-40 shrink-0 aspect-square touch-none rounded-full"
            onPointerMove={handleDialPointerMove}
            onPointerUp={handleDialPointerRelease}
            onPointerCancel={handleDialPointerRelease}
          >
            <svg
              className="absolute inset-0 h-full w-full -rotate-90"
              viewBox={`0 0 ${DIAL_VIEWBOX_SIZE} ${DIAL_VIEWBOX_SIZE}`}
              aria-hidden="true"
            >
              <circle
                cx={DIAL_CENTER}
                cy={DIAL_CENTER}
                r={DIAL_RING_RADIUS}
                fill="none"
                stroke="rgba(255, 255, 255, 0.18)"
                strokeWidth={DIAL_RING_STROKE_WIDTH}
                pointerEvents="none"
              />
              <circle
                cx={DIAL_CENTER}
                cy={DIAL_CENTER}
                r={DIAL_RING_RADIUS}
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth={DIAL_RING_STROKE_WIDTH}
                strokeLinecap="round"
                strokeDasharray={DIAL_RING_CIRCUMFERENCE}
                strokeDashoffset={dialProgressStrokeDashOffset}
                pointerEvents="stroke"
                onPointerDown={handleProgressRingPointerDown}
              />
            </svg>

            <div className="liquid-input pointer-events-none absolute inset-3 flex flex-col items-center justify-center rounded-full">
              <span className="mono text-3xl font-bold leading-none text-foreground tabular-nums">
                {boundedValue}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
                sec
              </span>
            </div>
            <button
              type="button"
              onPointerDown={handleKnobPointerDown}
              aria-label="Drag duration handle"
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full active:cursor-grabbing"
              style={dialKnobStyle}
            >
              <div className="h-6 w-6 rounded-full border border-primary-200 bg-primary shadow-lg" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleIncreaseClick}
            disabled={boundedValue >= maxValue}
            className={buttonClassName}
            aria-label="Increase duration"
          >
            <LuPlus className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {validQuickPresets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => handlePresetClick(preset)}
              className="cursor-pointer rounded-full border border-primary-300 px-3 py-1 text-xs font-semibold text-primary shadow-none transition hover:bg-primary-200 hover:shadow-none focus:shadow-none"
            >
              {preset}s
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
