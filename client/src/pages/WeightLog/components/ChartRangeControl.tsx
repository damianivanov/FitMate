import { SegmentControl, SegmentControlSize } from "@/shared/components";
import type { WeightRange } from "../hooks/useWeightLogPage";

type ChartRangeControlProps = {
  value: WeightRange;
  onChange: (value: WeightRange) => void;
};

const OPTIONS: { value: WeightRange; label: string }[] = [
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "1y", label: "1Y" },
  { value: "all", label: "All" },
];

export function ChartRangeControl({ value, onChange }: ChartRangeControlProps) {
  return (
    <SegmentControl
      value={value}
      options={OPTIONS}
      onChange={onChange}
      size={SegmentControlSize.Sm}
      className="w-full max-w-56"
    />
  );
}
