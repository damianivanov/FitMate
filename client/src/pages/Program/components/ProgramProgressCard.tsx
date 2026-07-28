import type { ProgramProgressModel } from "@/types";

type ProgramProgressCardProps = {
  progress: ProgramProgressModel;
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-(--glass-bg-soft) px-3 py-2.5 text-center">
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="text-2xs font-semibold uppercase tracking-widest text-muted">{label}</p>
    </div>
  );
}

export function ProgramProgressCard({ progress }: ProgramProgressCardProps) {
  const completion = progress.completionPercentage;

  return (
    <section className="liquid-panel rounded-2xl p-4 md:rounded-lg">
      {completion != null ? (
        <div className="mb-4">
          <div className="mb-1 flex items-baseline justify-between">
            <p className="text-sm font-semibold text-foreground">Program completion</p>
            <p className="text-sm font-bold text-primary">{completion}%</p>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-(--glass-bg-soft)"
            role="progressbar"
            aria-label="Program completion"
            aria-valuenow={Number(completion)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out motion-reduce:transition-none"
              style={{ width: `${Math.min(100, Math.max(0, Number(completion)))}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <Stat label="Planned" value={String(progress.scheduledWorkouts)} />
        <Stat label="Done" value={String(progress.completedWorkouts)} />
        <Stat label="Missed" value={String(progress.missedWorkouts)} />
        <Stat label="Skipped" value={String(progress.skippedWorkouts)} />
        <Stat label="Left" value={String(progress.remainingWorkouts)} />
        <Stat label="Streak" value={String(progress.currentStreak)} />
      </div>

      <p className="mt-3 text-xs text-secondary">
        Adherence <span className="font-bold text-foreground">{progress.adherencePercentage}%</span>{" "}
        of due workouts completed
      </p>
    </section>
  );
}
