import { PageShell, MoodBadge } from "@/components/ui/WorkoutPrimitives";
import type { WorkoutHistoryItem } from "@/types/workout";

// TODO: Replace with real API data
const MOCK_HISTORY: WorkoutHistoryItem[] = [];

function formatDuration(seconds: number): string {
  return `${Math.floor(seconds / 60)} min`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function WorkoutHistory() {
  // TODO: Fetch from API
  const history = MOCK_HISTORY;

  return (
    <PageShell title="Workout History">
      {history.length === 0 ? (
        <div className="liquid-surface rounded-2xl px-6 py-16 text-center">
          <p className="text-sm text-muted">No workouts logged yet.</p>
        </div>
      ) : (
        <div className="liquid-surface overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {["Workout", "Date", "Duration", "Volume", "Mood", "RPE", "Notes"].map((h) => (
                    <th
                      key={h}
                      className="liquid-divider border-b px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-muted"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((w) => (
                  <tr key={w.id} className="liquid-hover-row cursor-pointer transition">
                    <td className="liquid-divider border-b px-4 py-3.5 text-sm font-semibold text-primary">
                      {w.title}
                    </td>
                    <td className="liquid-divider border-b px-4 py-3.5 text-sm text-secondary">
                      {formatDate(w.startedAt)}
                    </td>
                    <td className="liquid-divider border-b px-4 py-3.5 font-mono text-sm text-secondary">
                      {formatDuration(w.durationSeconds)}
                    </td>
                    <td className="liquid-divider border-b px-4 py-3.5 font-mono text-sm text-secondary">
                      {(w.totalVolumeKg / 1000).toFixed(1)}k kg
                    </td>
                    <td className="liquid-divider border-b px-4 py-3.5">
                      <MoodBadge mood={w.mood} />
                    </td>
                    <td className="liquid-divider border-b px-4 py-3.5">
                      <span className="font-mono text-sm text-secondary">{w.perceivedDifficulty}</span>
                      <span className="text-[11px] text-muted">/10</span>
                    </td>
                    <td className="liquid-divider max-w-[200px] truncate border-b px-4 py-3.5 text-sm text-tertiary">
                      {w.notes || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageShell>
  );
}

