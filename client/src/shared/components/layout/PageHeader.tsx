import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  /** Small uppercase label above the title, for pages that need the context. */
  eyebrow?: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ title, eyebrow, subtitle, actions, className }: PageHeaderProps) {
  return (
    <header
      // Same horizontal padding as PageBody, so the header action lines up with the
      // content edge below it instead of sitting 0.5rem proud of it.
      className={`flex items-center justify-between gap-4 px-4 py-5 md:px-8${className ? ` ${className}` : ""}`}
    >
      <div className="min-w-0">
        {eyebrow ? <p className="liquid-page-eyebrow">{eyebrow}</p> : null}
        <h1 className="liquid-page-title truncate">{title}</h1>
        {subtitle != null ? <p className="liquid-page-subtitle">{subtitle}</p> : null}
      </div>
      {actions != null ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
