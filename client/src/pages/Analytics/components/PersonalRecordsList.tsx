import type { PersonalRecordSummary } from "@/types";

type PersonalRecordsListProps = {
  items: PersonalRecordSummary[];
};

function formatNumber(value: number | undefined): string {
  if (value == null) {
    return "-";
  }

  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, "");
}

export function PersonalRecordsList({ items }: PersonalRecordsListProps) {
  if (items.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl bg-white/5 text-sm text-muted">
        No personal records yet.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={item.exerciseId}
          className="rounded-xl bg-white/5 px-4 py-3"
        >
          <p className="truncate text-sm font-bold text-foreground">{item.exerciseName}</p>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4">
            <Metric label="Best weight" value={item.bestWeightKg != null ? `${formatNumber(item.bestWeightKg)} kg` : "-"} />
            <Metric label="Best reps" value={formatNumber(item.bestReps)} />
            <Metric label="Est. 1RM" value={item.bestEstimatedOneRepMax != null ? `${formatNumber(item.bestEstimatedOneRepMax)} kg` : "-"} />
            <Metric label="Best volume" value={item.bestVolumeKg != null ? `${formatNumber(item.bestVolumeKg)} kg` : "-"} />
          </div>
        </li>
      ))}
    </ul>
  );
}

type MetricProps = {
  label: string;
  value: string;
};

function Metric({ label, value }: MetricProps) {
  return (
    <div className="min-w-0">
      <p className="text-2xs font-semibold uppercase tracking-widest text-muted">{label}</p>
      <p className="truncate font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
