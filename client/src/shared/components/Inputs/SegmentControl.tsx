import type { ReactNode } from "react";
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

const segmentSizeClassName: Record<SegmentControlSize, string> = {
  [SegmentControlSize.Sm]: "px-3 py-1.5 text-xs",
  [SegmentControlSize.Md]: "px-4 py-3 text-xs",
  [SegmentControlSize.Lg]: "p-4 text-sm",
};

function getSegmentRadiusClassName(index: number, totalCount: number): string {
  if (totalCount <= 1) {
    return "rounded-full";
  }

  if (index === 0) {
    return "rounded-l-full rounded-r-sm";
  }

  if (index === totalCount - 1) {
    return "rounded-r-full rounded-l-sm";
  }

  return "rounded-sm";
}

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
  const handleOptionClick = (nextValue: TValue) => {
    if (disabled || nextValue === value) {
      return;
    }

    onChange(nextValue);
  };

  const selectedIndex = options.findIndex((option) => option.value === value);
  const normalizedSelectedIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const segmentRadiusClassName = getSegmentRadiusClassName(normalizedSelectedIndex, options.length);
  const indicatorStyle =
    options.length > 0
      ? {
          width: `calc(100% / ${options.length})`,
          transform: `translateX(${normalizedSelectedIndex * 100}%)`,
        }
      : undefined;

  const controlClassName = [
    "relative flex overflow-hidden rounded-full border border-(--input-border) bg-(--glass-bg-input) p-0",
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] dark:border-white/10 dark:bg-black/25",
    "dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
    disabled ? "opacity-70" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const indicatorClassName = [
    "pointer-events-none absolute inset-y-0 left-0",
    segmentRadiusClassName,
    "shadow-[0_6px_14px_rgba(255,115,55,0.22),inset_0_1px_0_rgba(255,255,255,0.22)]",
    "transition-[transform,width] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
    "dark:shadow-[0_6px_14px_rgba(255,126,70,0.24),inset_0_1px_0_rgba(255,255,255,0.2)]",
  ].join(" ");

  const indicatorResolvedStyle = indicatorStyle
    ? {
        ...indicatorStyle,
        background: "var(--btn-primary-bg)",
      }
    : undefined;

  return (
    <div className={["space-y-1.5", className].filter(Boolean).join(" ")}>
      {label ? <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{label}</p> : null}
      <div id={id} className={controlClassName} role="tablist" aria-disabled={disabled}>
        {indicatorResolvedStyle ? (
          <span aria-hidden="true" className={indicatorClassName} style={indicatorResolvedStyle} />
        ) : null}
        {options.map((option, index) => {
          const isSelected = option.value === value;

          const optionClassName = [
            "relative z-10 flex w-full items-center justify-center gap-1.5 font-medium transition-colors duration-200",
            getSegmentRadiusClassName(index, options.length),
            segmentSizeClassName[size],
            isSelected ? "text-white" : "text-secondary hover:bg-(--option-hover-bg)",
            option.disabled || disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <div key={String(option.value)} className="relative flex-1">
              <button
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-disabled={option.disabled || disabled}
                className={optionClassName}
                onClick={() => handleOptionClick(option.value)}
                disabled={option.disabled || disabled}
              >
                {option.icon ? <span className="text-sm leading-none">{option.icon}</span> : null}
                <span>{option.label}</span>
              </button>
            </div>
          );
        })}
      </div>
      {helperText ? <p className="text-xs text-secondary">{helperText}</p> : null}
    </div>
  );
}
