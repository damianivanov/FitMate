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
};

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

export function LineChart({ points, valueSuffix = "", emptyText = "No data yet." }: LineChartProps) {
  const gradientId = useId();

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
