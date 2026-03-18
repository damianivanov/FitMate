import { PageShell } from "@/components/ui/WorkoutPrimitives";
import type { PersonalRecord, Exercise } from "@/types/workout";

// TODO: Replace with real API data
const MOCK_RECORDS: PersonalRecord[] = [];
const MOCK_EXERCISES: Exercise[] = [];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function PersonalRecords() {
  const records = MOCK_RECORDS;
  const exercises = MOCK_EXERCISES;

  const getExerciseName = (id: number) => exercises.find((e) => e.id === id)?.name ?? "Unknown";

  return (
    <PageShell title="Personal Records">
      {records.length === 0 ? (
        <div className="liquid-surface rounded-2xl px-6 py-16 text-center">
          <p className="text-sm text-muted">No personal records yet. Start training!</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {records
            .filter((pr) => pr.isCurrent)
            .map((pr) => (
              <div
                key={pr.id}
                className="liquid-surface flex items-center gap-4 rounded-2xl px-5 py-4"
              >
                {/* Trophy icon */}
                <div className="liquid-chip liquid-chip-warn flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9H3a1 1 0 01-1-1V5a1 1 0 011-1h3M18 9h3a1 1 0 001-1V5a1 1 0 00-1-1h-3M6 4h12v5a6 6 0 01-12 0zM9 18h6M10 22h4M12 15v3" />
                  </svg>
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-primary">
                    {getExerciseName(pr.exerciseId)}
                  </div>
                  <div className="text-[11px] uppercase tracking-wide text-muted">
                    {pr.recordType.replace("_", " ")} · {formatDate(pr.achievedOn)}
                  </div>
                </div>

                {/* Value */}
                <div className="font-mono text-xl font-medium text-sky-500">
                  {pr.value} <span className="text-sm text-muted">kg</span>
                </div>
              </div>
            ))}
        </div>
      )}
    </PageShell>
  );
}

