import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MuscleGroupVolume } from "@/types";
import {
  CHART_AXIS_TICK,
  CHART_GRID_STROKE,
  CHART_PRIMARY,
  CHART_TOOLTIP_CONTENT_STYLE,
  CHART_TOOLTIP_ITEM_STYLE,
  CHART_TOOLTIP_LABEL_STYLE,
} from "@/shared/components/charts/chartTheme";

type MuscleGroupBarsProps = {
  items: MuscleGroupVolume[];
};

function formatTick(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `${Math.round(value / 100) / 10}k`;
  }

  return String(Math.round(value));
}

function truncateLabel(value: string): string {
  return value.length > 12 ? `${value.slice(0, 11)}…` : value;
}

export function MuscleGroupBars({ items }: MuscleGroupBarsProps) {
  if (items.length === 0) {
    return (
      <div className="flex h-44 items-center justify-center rounded-xl bg-white/5 text-sm text-muted">
        No muscle group data yet.
      </div>
    );
  }

  const data = items.map((item) => ({
    name: item.muscleGroupName,
    volume: item.totalVolumeKg,
    setCount: item.setCount,
  }));
  const chartHeight = Math.max(176, data.length * 40 + 16);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} horizontal={false} />
        <XAxis
          type="number"
          tick={CHART_AXIS_TICK}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatTick}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={96}
          tick={CHART_AXIS_TICK}
          tickLine={false}
          axisLine={false}
          tickFormatter={truncateLabel}
        />
        <Tooltip
          contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
          labelStyle={CHART_TOOLTIP_LABEL_STYLE}
          itemStyle={CHART_TOOLTIP_ITEM_STYLE}
          cursor={{ fill: "var(--glass-divider)" }}
          formatter={(value, _name, item) => [
            `${Math.round(Number(value)).toLocaleString()} kg · ${item.payload.setCount} sets`,
            "Volume",
          ]}
        />
        <Bar dataKey="volume" fill={CHART_PRIMARY} radius={[0, 6, 6, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}
