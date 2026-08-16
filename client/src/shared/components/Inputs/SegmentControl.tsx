import type { CSSProperties, ReactNode } from "react";
import { useSegmentedThumb } from "@/shared/hooks/useSegmentedThumb";
import { tick } from "@/shared/utils/haptics";
import { SegmentControlSize } from "./SegmentControlSize";

export type SegmentControlOption<TValue extends string | number | boolean> = {
  label: string;
  value: TValue;
  icon?: ReactNode;
  disabled?: boolean;
};

type SegmentControlProps<TValue extends string | number | boolean> = {
  id?: string;
  value: TValue;
  options: ReadonlyArray<SegmentControlOption<TValue>>;
  onChange: (value: TValue) => void;
  label?: string;
  helperText?: string;
  size?: SegmentControlSize;
  disabled?: boolean;
  className?: string;
};

/**
 * Segment heights are fixed rather than derived from padding, so a control lines up with
 * the buttons beside it: h-7 + the track's 0.5rem padding is 2.25rem, and so on.
 */
const segmentSizeClassName: Record<SegmentControlSize, string> = {
  [SegmentControlSize.Sm]: "h-7 px-2.5 text-xs",
  [SegmentControlSize.Md]: "h-8 px-3 text-xs",
  [SegmentControlSize.Lg]: "h-10 px-4 text-sm",
};

export function SegmentControl<TValue extends string | number | boolean>({
  id,
  value,
  options,
  onChange,
  label,
  helperText,
  size = SegmentControlSize.Md,
  disabled = false,
  className = "",
}: SegmentControlProps<TValue>) {
  const selectedIndex = options.findIndex((option) => option.value === value);
  const normalizedSelectedIndex = selectedIndex >= 0 ? selectedIndex : 0;

  // The thumb travels on a spring, so a switch made mid-flight redirects from where the
  // pill actually is instead of restarting from the new segment.
  const { thumbRef } = useSegmentedThumb(normalizedSelectedIndex);

  const handleOptionClick = (nextValue: TValue) => {
    if (disabled || nextValue === value) {
      return;
    }

    tick();
    onChange(nextValue);
  };

  return (
    <div className={["space-y-1.5", className].filter(Boolean).join(" ")}>
      {label ? (
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      ) : null}

      <div
        id={id}
        role="tablist"
        aria-disabled={disabled}
        className={`liquid-segmented${disabled ? " opacity-70" : ""}`}
        style={{ "--liquid-segment-count": options.length } as CSSProperties}
      >
        {options.length > 0 ? (
          <span ref={thumbRef} aria-hidden="true" className="liquid-segment-thumb" />
        ) : null}

        {options.map((option) => (
          <div key={String(option.value)} className="flex-1">
            <button
              type="button"
              role="tab"
              aria-selected={option.value === value}
              aria-disabled={option.disabled || disabled}
              disabled={option.disabled || disabled}
              onClick={() => handleOptionClick(option.value)}
              className={[
                "liquid-segment",
                segmentSizeClassName[size],
                option.disabled || disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
              ].join(" ")}
            >
              {option.icon ? <span className="text-sm leading-none">{option.icon}</span> : null}
              <span className="whitespace-nowrap">{option.label}</span>
            </button>
          </div>
        ))}
      </div>

      {helperText ? <p className="text-xs text-secondary">{helperText}</p> : null}
    </div>
  );
}
