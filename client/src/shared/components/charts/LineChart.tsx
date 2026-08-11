import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CHART_AXIS_TICK,
  CHART_GRID_STROKE,
  CHART_PRIMARY,
  CHART_TOOLTIP_CONTENT_STYLE,
  CHART_TOOLTIP_ITEM_STYLE,
  CHART_TOOLTIP_LABEL_STYLE,
} from "./chartTheme";

export type LineChartPoint = {
  label: string;
  value: number;
};

type LineChartProps = {
  points: LineChartPoint[];
  valueSuffix?: string;
  emptyText?: string;
  /**
   * "zero" anchors the axis at 0. "data" fits the axis to the value range, which is what
   * series that never approach zero (body weight, estimated 1RM) need to stay readable.
   */
  baseline?: "zero" | "data";
};

const TARGET_TICK_COUNT = 5;
const MAX_TICK_COUNT = 12;

function niceStep(rough: number): number {
  if (!Number.isFinite(rough) || rough <= 0) {
    return 1;
  }

  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  const stepMultiplier = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;

  return stepMultiplier * magnitude;
}

function buildDataScale(points: LineChartPoint[]): { domain: [number, number]; ticks: number[] } {
  const values = points.map((point) => point.value).filter((value) => Number.isFinite(value));
  if (values.length === 0) {
    return { domain: [0, 1], ticks: [0, 1] };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min;
  const padding = spread === 0 ? Math.max(Math.abs(max) * 0.05, 1) : spread * 0.15;
  const step = niceStep((spread + padding * 2) / TARGET_TICK_COUNT);

  const rawLow = Math.floor((min - padding) / step) * step;
  const low = min >= 0 ? Math.max(0, rawLow) : rawLow;
  const high = Math.ceil((max + padding) / step) * step;

  const ticks: number[] = [];
  for (let index = 0; index < MAX_TICK_COUNT; index += 1) {
    const tick = Number((low + index * step).toFixed(6));
    ticks.push(tick);
    if (tick >= high) {
      break;
    }
  }

  return { domain: [low, ticks[ticks.length - 1]], ticks };
}

function formatValue(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, "");
}

function formatTick(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `${Math.round(value / 100) / 10}k`;
  }

  return formatValue(value);
}

export function LineChart({
  points,
  valueSuffix = "",
  emptyText = "No data yet.",
  baseline = "zero",
}: LineChartProps) {
  const gradientId = useId();
  const scale = baseline === "data" ? buildDataScale(points) : null;

  if (points.length === 0) {
    return (
      <div className="flex h-44 items-center justify-center rounded-xl bg-white/5 text-sm text-muted">
        {emptyText}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={208}>
      <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_PRIMARY} stopOpacity={0.35} />
            <stop offset="100%" stopColor={CHART_PRIMARY} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} vertical={false} />
        <XAxis
          dataKey="label"
          tick={CHART_AXIS_TICK}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
        />
        <YAxis
          tick={CHART_AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={formatTick}
          domain={scale ? scale.domain : undefined}
          ticks={scale ? scale.ticks : undefined}
        />
        <Tooltip
          contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
          labelStyle={CHART_TOOLTIP_LABEL_STYLE}
          itemStyle={CHART_TOOLTIP_ITEM_STYLE}
          cursor={{ stroke: CHART_GRID_STROKE }}
          formatter={(value) => [`${formatValue(Number(value))}${valueSuffix}`, "Value"]}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={CHART_PRIMARY}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
