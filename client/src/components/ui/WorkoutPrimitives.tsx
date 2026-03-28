import type { ReactNode } from "react";
import type { GroupType, Mood, Difficulty } from "@/types/workout";

// --- Stat Card ---

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
    return `${baseClassName} text-primary`;
  }

  if (changeDir === "down") {
    return `${baseClassName} text-danger`;
  }

  return `${baseClassName} text-muted`;
}

export function StatCard({ label, value, color, change, changeDir }: StatCardProps) {
  return (
    <div className="liquid-surface rounded-3xl px-5 py-4">
      <div className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-tertiary">
        {label}
      </div>
      <div className={`font-mono text-3xl font-bold tracking-tight ${color ?? "text-foreground"}`}>
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

// --- Group Type Badge ---

const groupBadgeStyles: Record<GroupType, string> = {
  straight: "liquid-chip",
  superset: "liquid-chip liquid-chip-info",
  circuit: "liquid-chip liquid-chip-warn",
};

export function GroupTypeBadge({ type }: { type: GroupType }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${groupBadgeStyles[type]}`}>
      {type}
    </span>
  );
}

// --- Mood Badge ---

const moodStyles: Record<Mood, string> = {
  energized: "liquid-chip liquid-chip-success",
  neutral: "liquid-chip liquid-chip-info",
  tired: "liquid-chip liquid-chip-warn",
  stressed: "liquid-chip liquid-chip-danger",
};

export function MoodBadge({ mood }: { mood: Mood }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${moodStyles[mood]}`}>
      {mood}
    </span>
  );
}

// --- Difficulty Badge ---

const difficultyStyles: Record<Difficulty, string> = {
  beginner: "liquid-chip",
  intermediate: "liquid-chip liquid-chip-info",
  advanced: "liquid-chip liquid-chip-warn",
};

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${difficultyStyles[difficulty]}`}>
      {difficulty}
    </span>
  );
}

// --- Section Header ---

type SectionHeaderProps = {
  title: string;
  action?: ReactNode;
};

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <div className="mb-3.5 flex items-center justify-between">
      <h3 className="text-xs font-bold tracking-tight text-foreground">{title}</h3>
      {action}
    </div>
  );
}

// --- Empty State ---

type EmptyStateCardProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyStateCard({ title, description, action }: EmptyStateCardProps) {
  return (
    <div className="liquid-surface rounded-2xl px-6 py-12 text-center">
      <p className="text-3xl font-semibold tracking-tight text-foreground">{title}</p>
      <p className="mx-auto mt-1 text-sm text-muted">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}



