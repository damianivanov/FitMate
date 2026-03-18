import type { ReactNode } from "react";
import type { GroupType, Mood, Difficulty } from "@/types/workout";

// ─── Stat Card ───

type StatCardProps = {
  label: string;
  value: string | number;
  color?: string;
  change?: string;
  changeDir?: "up" | "down";
};

function getStatChangeClassName(changeDir?: "up" | "down"): string {
  const baseClassName = "mt-1 text-xs font-semibold";

  if (changeDir === "up") {
    return `${baseClassName} text-emerald-600`;
  }

  if (changeDir === "down") {
    return `${baseClassName} text-rose-500`;
  }

  return `${baseClassName} text-muted`;
}

export function StatCard({ label, value, color, change, changeDir }: StatCardProps) {
  return (
    <div className="liquid-surface rounded-2xl px-5 py-4">
      <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted">
        {label}
      </div>
      <div className={`font-mono text-2xl font-medium tracking-tight ${color ?? "text-primary"}`}>
        {value}
      </div>
      {change && (
        <div className={getStatChangeClassName(changeDir)}>
          {change}
        </div>
      )}
    </div>
  );
}

// ─── Group Type Badge ───

const groupBadgeStyles: Record<GroupType, string> = {
  straight: "liquid-chip",
  superset: "liquid-chip liquid-chip-info",
  circuit: "liquid-chip liquid-chip-warn",
};

export function GroupTypeBadge({ type }: { type: GroupType }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${groupBadgeStyles[type]}`}>
      {type}
    </span>
  );
}

// ─── Mood Badge ───

const moodStyles: Record<Mood, string> = {
  energized: "liquid-chip liquid-chip-success",
  neutral: "liquid-chip liquid-chip-info",
  tired: "liquid-chip liquid-chip-warn",
  stressed: "liquid-chip liquid-chip-danger",
};

export function MoodBadge({ mood }: { mood: Mood }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${moodStyles[mood]}`}>
      {mood}
    </span>
  );
}

// ─── Difficulty Badge ───

const difficultyStyles: Record<Difficulty, string> = {
  beginner: "liquid-chip",
  intermediate: "liquid-chip liquid-chip-info",
  advanced: "liquid-chip liquid-chip-warn",
};

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${difficultyStyles[difficulty]}`}>
      {difficulty}
    </span>
  );
}

// ─── Section Header ───

type SectionHeaderProps = {
  title: string;
  action?: ReactNode;
};

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <div className="mb-3.5 flex items-center justify-between">
      <h3 className="text-[15px] font-bold tracking-tight text-primary">{title}</h3>
      {action}
    </div>
  );
}

// ─── Page Shell ───

type PageShellProps = {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function PageShell({ title, actions, children }: PageShellProps) {
  return (
    <>
      <header className="liquid-panel liquid-divider flex items-center justify-between border-x-0 border-t-0 border-b px-6 py-4 md:px-10">
        <h1 className="text-xl font-extrabold tracking-tight text-primary">{title}</h1>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </header>
      <div className="flex-1 overflow-y-auto px-6 py-7 md:px-10">{children}</div>
    </>
  );
}

