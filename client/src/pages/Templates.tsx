import { Link } from "react-router-dom";
import { PageShell, GroupTypeBadge } from "@/components/ui/WorkoutPrimitives";
import type { WorkoutTemplate, Exercise } from "@/types/workout";

// TODO: Replace with real API data
const MOCK_TEMPLATES: WorkoutTemplate[] = [];
const MOCK_EXERCISES: Exercise[] = [];

function getTemplateExerciseRowClassName(index: number): string {
  const baseClassName = "flex items-center gap-2 py-1.5 text-[13px] text-slate-600";
  const stateClassName = index > 0 ? "liquid-divider border-t" : "";

  return `${baseClassName} ${stateClassName}`.trim();
}

export default function Templates() {
  const templates = MOCK_TEMPLATES;
  const exercises = MOCK_EXERCISES;

  const getExerciseName = (id: number) => exercises.find((e) => e.id === id)?.name ?? "Unknown";

  return (
    <PageShell
      title="Templates"
      actions={
        <Link
          to="/templates/new"
          className="liquid-primary-btn flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Template
        </Link>
      }
    >
      {templates.length === 0 ? (
        <div className="liquid-surface rounded-2xl px-6 py-16 text-center">
          <p className="text-sm text-slate-400">No templates yet.</p>
          <Link to="/templates/new" className="mt-2 inline-block text-sm font-semibold text-sky-600">
            Create your first template
          </Link>
        </div>
      ) : (
        <div className="grid gap-3.5 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => {
            return (
              <div key={t.id} className="liquid-surface rounded-2xl p-5">
                {/* Header */}
                <div className="mb-2 flex items-start justify-between">
                  <span className="text-base font-extrabold tracking-tight text-slate-900">{t.name}</span>
                  <div className="flex gap-1.5">
                    <Link
                      to={`/templates/${t.id}/edit`}
                      className="liquid-pill flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:text-slate-700"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </Link>
                    <button
                      type="button"
                      className="liquid-pill flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:text-rose-500"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>

                <p className="mb-3 text-xs leading-relaxed text-slate-500">{t.description}</p>

                {/* Exercise preview list */}
                <div className="mb-4">
                  {t.groups.map((g, i) => (
                    <div
                      key={g.id}
                      className={getTemplateExerciseRowClassName(i)}
                    >
                      <span className="min-w-[18px] font-mono text-[11px] text-slate-400">{i + 1}</span>
                      {g.groupType !== "straight" && <GroupTypeBadge type={g.groupType} />}
                      <span className="flex-1 truncate">
                        {g.exercises.map((e) => getExerciseName(e.exerciseId)).join(" + ")}
                      </span>
                      <span className="font-mono text-xs text-slate-400">
                        {g.exercises[0]?.targetSets}×{g.exercises[0]?.targetReps}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Start button */}
                <Link
                  to="/workouts/new"
                  className="liquid-primary-btn inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 3l14 9-14 9V3z" />
                  </svg>
                  Start
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
