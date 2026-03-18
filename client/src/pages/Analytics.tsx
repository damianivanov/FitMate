import { PageShell, SectionHeader, StatCard } from "@/components/ui/WorkoutPrimitives";
import type { UserBodyMetric } from "@/types/workout";

// TODO: Replace with real API data
const MOCK_BODY_METRICS: UserBodyMetric[] = [];
const MOCK_MUSCLE_VOLUME: { name: string; volume: number }[] = [
  { name: "Quads", volume: 31800 },
  { name: "Chest", volume: 28400 },
  { name: "Back", volume: 24200 },
  { name: "Glutes", volume: 18200 },
  { name: "Hamstrings", volume: 15400 },
  { name: "Shoulders", volume: 12600 },
  { name: "Triceps", volume: 9800 },
  { name: "Biceps", volume: 8200 },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function Analytics() {
  const bodyMetrics = MOCK_BODY_METRICS;
  const muscleVolume = MOCK_MUSCLE_VOLUME;
  const maxVol = Math.max(...muscleVolume.map((m) => m.volume), 1);

  return (
    <PageShell title="Analytics">
      {/* ─── Aggregate Stats ─── */}
      <div className="mb-7 grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <StatCard label="Total Workouts" value={156} color="text-sky-500" />
        <StatCard label="Total Time" value="89h" />
        <StatCard label="Total Volume" value="1.2M" color="text-violet-500" change="kg lifted" />
        <StatCard label="Avg Duration" value="57m" />
      </div>

      {/* ─── Body Weight Trend ─── */}
      <div className="mb-7">
        <SectionHeader title="Body Weight Trend" />
        {bodyMetrics.length === 0 ? (
          <div className="liquid-surface rounded-2xl px-6 py-10 text-center text-sm text-muted">
            No body metrics logged yet.
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {bodyMetrics.map((m) => (
              <div
                key={m.id}
                className="liquid-surface min-w-[110px] rounded-2xl px-4 py-3.5 text-center"
              >
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                  {formatDate(m.recordedOn)}
                </div>
                <div className="font-mono text-lg font-medium text-primary">
                  {m.bodyWeightKg} kg
                </div>
                {m.bodyFatPct != null && (
                  <div className="mt-0.5 text-[11px] text-muted">{m.bodyFatPct}% bf</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Volume by Muscle Group ─── */}
      <div>
        <SectionHeader title="Volume by Muscle (30d)" />
        <div className="liquid-surface rounded-2xl px-5 py-5">
          {muscleVolume.map((m) => (
            <div key={m.name} className="mb-2.5 flex items-center gap-3 last:mb-0">
              <span className="w-[90px] text-xs font-semibold text-tertiary">{m.name}</span>
              <div className="liquid-progress-track h-2.5 flex-1 overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(m.volume / maxVol) * 100}%`,
                    background: "linear-gradient(90deg, #0ea5e9, #67e8f9)",
                  }}
                />
              </div>
              <span className="min-w-[45px] text-right font-mono text-[11px] text-muted">
                {(m.volume / 1000).toFixed(1)}k
              </span>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}

