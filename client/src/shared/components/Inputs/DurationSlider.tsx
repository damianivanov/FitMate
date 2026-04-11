import type { CSSProperties, ChangeEvent } from "react";

type DurationSliderProps = {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  containerClassName?: string;
  labelClassName?: string;
  helperText?: string;
};

export function DurationSlider({
  id,
  label,
  value,
  onChange,
  min = 15,
  max = 180,
  step = 5,
  containerClassName = "space-y-2",
  labelClassName = "text-sm font-medium text-secondary",
  helperText,
}: DurationSliderProps) {
  const boundedValue = Math.max(min, Math.min(max, value));
  const progressPercentage = max > min ? ((boundedValue - min) / (max - min)) * 100 : 0;
  const sliderStyle = {
    "--duration-slider-progress": `${progressPercentage}%`,
  } as CSSProperties;

  const handleSliderChange = (event: ChangeEvent<HTMLInputElement>) => {
    const parsedValue = Number(event.target.value);
    if (!Number.isFinite(parsedValue)) {
      return;
    }

    onChange(parsedValue);
  };

  return (
    <div className={containerClassName}>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className={labelClassName}>{label}</label>
        <span className="liquid-primary-chip rounded-full px-3 py-1 text-xs font-semibold">
          {boundedValue} min
        </span>
      </div>

      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={boundedValue}
        onChange={handleSliderChange}
        className="liquid-duration-slider w-full"
        style={sliderStyle}
      />

      <div className="flex items-center justify-between text-xs text-tertiary">
        <span>{min} min</span>
        <span>{max} min</span>
      </div>

      {helperText ? <p className="text-xs text-secondary">{helperText}</p> : null}
    </div>
  );
}
