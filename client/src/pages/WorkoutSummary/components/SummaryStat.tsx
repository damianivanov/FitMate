import type { ReactNode } from "react";

type SummaryStatProps = {
  icon: ReactNode;
  label: string;
  value: string;
};

export function SummaryStat({ icon, label, value }: SummaryStatProps) {
  return (
    <div className="liquid-info-surface rounded-xl px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-widest text-muted">
        {icon}
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}
