import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageShell, SectionHeader, StatCard } from "@/components/ui/WorkoutPrimitives";
import CreateWorkoutModal from "@/components/workout/CreateWorkoutModal";
import type { Exercise, Mood, WorkoutTemplate } from "@/types/workout";

// TODO: Replace with real data from your API / store
const MOCK_TEMPLATES: WorkoutTemplate[] = [];
const MOCK_EXERCISES: Exercise[] = [];

const WEEKLY_VOLUME = [
  { day: "Mon", vol: 8100 },
  { day: "Tue", vol: 0 },
  { day: "Wed", vol: 6890 },
  { day: "Thu", vol: 0 },
  { day: "Fri", vol: 12340 },
  { day: "Sat", vol: 8420 },
  { day: "Sun", vol: 0 },
];

export default function Workouts() {
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);

  // TODO: Fetch templates, exercises, stats from your API
  const templates = MOCK_TEMPLATES;
  const exercises = MOCK_EXERCISES;

  const maxVol = Math.max(...WEEKLY_VOLUME.map((d) => d.vol), 1);

  const handleStartWorkout = (_data: {
    title: string;
    templateId: number | null;
    bodyWeightKg: number | null;
    mood: Mood;
    notes: string;
  }) => {
    // TODO: Build initial workout state from template, persist, navigate
    setShowCreateModal(false);
    navigate("/workouts/new");
  };

  return (
    <PageShell
      title="Workouts"
      actions={
        <button
          type="button"
          className="liquid-primary-btn flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold"
          onClick={() => setShowCreateModal(true)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Workout
        </button>
      }
    >
      {/* ─── Stats Row ─── */}
      <div className="mb-7 grid grid-cols-2 gap-3.5 md:grid-cols-4">
        <StatCard label="This Week" value={4} color="text-sky-500" change="+1 vs last week" changeDir="up" />
        <StatCard label="Volume (week)" value="35.7k" change="+8% kg" changeDir="up" />
        <StatCard label="Body Weight" value="84.2" change="−0.3 kg" changeDir="down" />
        <StatCard label="Streak" value="6d" color="text-amber-500" />
      </div>

      {/* ─── Volume Chart ─── */}
      <div className="mb-7">
        <SectionHeader title="Weekly Volume (kg)" />
        <div className="liquid-surface rounded-2xl px-5 pb-3 pt-5">
          <div className="flex h-[140px] items-end gap-2.5">
            {WEEKLY_VOLUME.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center justify-end gap-1.5 h-full">
                {d.vol > 0 && (
                  <span className="font-mono text-[10px] text-slate-400">
                    {(d.vol / 1000).toFixed(1)}k
                  </span>
                )}
                <div
                  className="w-full rounded-t-lg transition-all duration-500"
                  style={{
                    height: `${Math.max((d.vol / maxVol) * 100, d.vol > 0 ? 8 : 2)}%`,
                    opacity: d.vol > 0 ? 1 : 0.15,
                    background: d.vol > 0
                      ? "linear-gradient(180deg, #0ea5e9b3, #0ea5e940)"
                      : "#94a3b833",
                  }}
                />
                <span className="text-[10px] font-semibold text-slate-400">{d.day}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Quick Start Templates ─── */}
      <div>
        <SectionHeader
          title="Quick Start"
          action={
            <Link to="/templates" className="text-xs font-semibold text-sky-600 hover:text-sky-700">
              All Templates
            </Link>
          }
        />
        {templates.length === 0 ? (
          <div className="liquid-surface rounded-2xl px-6 py-12 text-center">
            <p className="text-sm text-slate-400">No templates yet.</p>
            <Link
              to="/templates/new"
              className="mt-2 inline-block text-sm font-semibold text-sky-600 hover:text-sky-700"
            >
              Create your first template
            </Link>
          </div>
        ) : (
          <div className="grid gap-3.5 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => {
              const exCount = t.groups.reduce((a, g) => a + g.exercises.length, 0);
              const setCount = t.groups.reduce(
                (a, g) => a + g.exercises.reduce((b, e) => b + e.targetSets, 0), 0,
              );
              const badgeColor = t.name.toLowerCase().includes("push")
                ? "liquid-chip liquid-chip-warn"
                : t.name.toLowerCase().includes("pull")
                  ? "liquid-chip liquid-chip-info"
                  : "liquid-chip liquid-chip-violet";

              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="liquid-surface liquid-hover-lift group cursor-pointer rounded-2xl p-5 text-left transition"
                >
                  <div className="mb-2 flex items-start justify-between">
                    <span className="text-base font-extrabold tracking-tight text-slate-900">
                      {t.name}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${badgeColor}`}>
                      {t.name.split(" ")[0]}
                    </span>
                  </div>
                  <p className="mb-3 text-xs leading-relaxed text-slate-500">{t.description}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1 font-medium">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                      {exCount} exercises
                    </span>
                    <span className="flex items-center gap-1 font-medium">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6.5 6.5h11M2 10v4h4v-4zM18 10v4h4v-4zM6 12h12"/></svg>
                      {setCount} sets
                    </span>
                    <span className="flex items-center gap-1 font-medium">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 6v6l4 2M12 2a10 10 0 100 20 10 10 0 000-20z"/></svg>
                      ~{t.estDurationMin} min
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Create Workout Modal ─── */}
      <CreateWorkoutModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onStart={handleStartWorkout}
        templates={templates}
        exercises={exercises}
        lastBodyWeight={84.2}
      />
    </PageShell>
  );
}
