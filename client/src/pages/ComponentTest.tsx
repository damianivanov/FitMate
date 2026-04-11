import { useMemo, useState } from "react";
import { RepsStepper, SegmentControl, WeightStepper } from "@/shared/components";

type WeightUnit = "kg" | "lbs";
type TimeRange = "week" | "month" | "year";

const KG_TO_LBS_FACTOR = 2.2046226218;

const WEIGHT_UNIT_OPTIONS = [
  { value: "kg", label: "kg" },
  { value: "lbs", label: "lbs" },
] as const;

const TIME_RANGE_OPTIONS = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
] as const;

const PRIMARY_SWATCHES = [
  { label: "100", className: "bg-primary-100" },
  { label: "200", className: "bg-primary-200" },
  { label: "300", className: "bg-primary-300" },
  { label: "400", className: "bg-primary-400" },
  { label: "500", className: "bg-primary-500" },
  { label: "600", className: "bg-primary-600" },
  { label: "700", className: "bg-primary-700" },
  { label: "800", className: "bg-primary-800" },
  { label: "900", className: "bg-primary-900" },
  { label: "Primary", className: "bg-primary" }
] as const;

function convertWeight(value: number, fromUnit: WeightUnit, toUnit: WeightUnit): number {
  if (fromUnit === toUnit) {
    return value;
  }

  if (toUnit === "lbs") {
    return value * KG_TO_LBS_FACTOR;
  }

  return value / KG_TO_LBS_FACTOR;
}

export default function ComponentTest() {
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("kg");
  const [weightValue, setWeightValue] = useState(85);
  const [repsValue, setRepsValue] = useState(8);
  const [timeRange, setTimeRange] = useState<TimeRange>("month");

  const weightQuickIncrements = useMemo(
    () => (weightUnit === "kg" ? [1.25, 2.5, 5, 10] : [2.5, 5, 10, 20]),
    [weightUnit],
  );

  const handleWeightUnitChange = (nextUnit: WeightUnit) => {
    if (nextUnit === weightUnit) {
      return;
    }

    const convertedValue = convertWeight(weightValue, weightUnit, nextUnit);
    setWeightValue(convertedValue);
    setWeightUnit(nextUnit);
  };

  const handleTimeRangeChange = (nextRange: TimeRange) => {
    setTimeRange(nextRange);
  };

  const handleWeightChange = (nextWeight: number) => {
    setWeightValue(nextWeight);
  };

  const handleRepsChange = (nextReps: number) => {
    setRepsValue(nextReps);
  };

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-secondary">
          Primary Scale Preview
        </h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-2xl bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-black">Solid White</p>
            <div className="flex flex-wrap gap-3">
              {PRIMARY_SWATCHES.map((swatch) => (
                <div key={`white-${swatch.label}`} className="flex flex-col items-center gap-1">
                  <span className={`h-10 w-10 rounded-full ${swatch.className}`} />
                  <span className="text-xs font-semibold text-black">{swatch.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-2xl bg-black p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-white">Solid Black</p>
            <div className="flex flex-wrap gap-3">
              {PRIMARY_SWATCHES.map((swatch) => (
                <div key={`black-${swatch.label}`} className="flex flex-col items-center gap-1">
                  <span className={`h-10 w-10 rounded-full ${swatch.className}`} />
                  <span className="text-xs font-semibold text-white">{swatch.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-start gap-6">
        <div className="w-fit">
          <SegmentControl
            label="Weight Unit"
            value={weightUnit}
            options={WEIGHT_UNIT_OPTIONS}
            onChange={handleWeightUnitChange}
            helperText="Switching unit converts the displayed weight value."
          />
        </div>

        <div className="w-fit">
          <SegmentControl
            label="Analytics Range"
            value={timeRange}
            options={TIME_RANGE_OPTIONS}
            onChange={handleTimeRangeChange}
          />
        </div>

        <div className="w-fit">
          <WeightStepper
            value={weightValue}
            onChange={handleWeightChange}
            unit={weightUnit}
            quickIncrements={weightQuickIncrements}
            buttonStep={0.5}
            precision={weightUnit === "kg" ? 2 : 1}
          />
        </div>

        <div className="w-fit">
          <RepsStepper
            value={repsValue}
            onChange={handleRepsChange}
            min={1}
            max={30}
          />
        </div>
      </div>
    </div>
  );
}
