import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <header
      className={`liquid-page-header flex items-center justify-between px-6 py-5 md:px-8${className ? ` ${className}` : ""}`}
    >
      <div className="min-w-0">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{title}</h1>
        {subtitle != null ? <p className="mt-1 text-sm text-secondary">{subtitle}</p> : null}
      </div>
      {actions != null ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
