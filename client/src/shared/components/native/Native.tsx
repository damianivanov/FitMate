import type { ReactNode } from "react";
import { LuArrowLeft, LuChevronRight, LuSearch } from "react-icons/lu";

/** The tints a glyph tile, stat or dot can wear. Mirrors the --tint-* tokens. */
export type NativeTint =
  | "orange"
  | "blue"
  | "purple"
  | "pink"
  | "green"
  | "cyan"
  | "yellow"
  | "gray"
  | "rose";

function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

/* ---------------- Page shell ---------------- */

export function NativePage({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={classNames("native-page", className)}>{children}</div>;
}

/**
 * The screen's own title, in the scroll flow rather than in a bar. The optional action sits
 * on the title's baseline, so it reads as belonging to the heading instead of floating.
 */
export function PageIntro({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <section className="native-title">
      {title ? <p className="liquid-page-eyebrow">{eyebrow}</p> : null}
      <div>
        <h1 className={title ? "liquid-page-title truncate" : "liquid-page-eyebrow truncate"}>
          {title ?? eyebrow}
        </h1>
        {action}
      </div>
    </section>
  );
}

/** For screens you arrive at from somewhere else and leave the same way. */
export function BackHeader({
  title,
  onBack,
  action,
}: {
  title: string;
  onBack: () => void;
  action?: ReactNode;
}) {
  return (
    <div className="native-back-header">
      <button
        type="button"
        onClick={onBack}
        className="app-round-btn liquid-press"
        aria-label="Go back"
      >
        <LuArrowLeft className="h-5 w-5" />
      </button>
      <b>{title}</b>
      <div>{action}</div>
    </div>
  );
}

/* ---------------- Sections ---------------- */

export function NativeSection({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={classNames("native-section", className)}>
      {title ? (
        <div className="native-heading">
          <h2>{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function SectionAction({
  children,
  onClick,
  withChevron,
}: {
  children: ReactNode;
  onClick?: () => void;
  withChevron?: boolean;
}) {
  return (
    <button type="button" className="native-heading-action" onClick={onClick}>
      {children}
      {withChevron ? <LuChevronRight className="h-4 w-4" /> : null}
    </button>
  );
}

/* ---------------- Surfaces ---------------- */

export function NativeCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={classNames("native-card", className)}>{children}</div>;
}

export function NativeList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={classNames("native-list", className)}>{children}</div>;
}

/**
 * One list row. Renders as a button when it does something and a plain div when it is only
 * reporting — a row that looks pressable but is not is the fastest way to lose someone's
 * trust in the rest of the list.
 */
export function NativeRow({
  glyph,
  title,
  subtitle,
  value,
  trailing,
  onClick,
  href,
  className,
}: {
  glyph?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  href?: string;
  className?: string;
}) {
  const body = (
    <>
      {glyph}
      <span className="native-row-copy">
        <b>{title}</b>
        {subtitle != null ? <small>{subtitle}</small> : null}
      </span>
      {value != null ? <strong className="native-row-value">{value}</strong> : null}
      {trailing ??
        (onClick || href ? (
          <LuChevronRight className="native-row-chevron h-4 w-4" aria-hidden="true" />
        ) : null)}
    </>
  );

  if (href) {
    return (
      <a href={href} className={classNames("native-row", className)}>
        {body}
      </a>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classNames("native-row", className)}>
        {body}
      </button>
    );
  }

  return <div className={classNames("native-row", className)}>{body}</div>;
}

export function NativeGlyph({
  tint,
  size = "md",
  children,
}: {
  tint: NativeTint;
  size?: "md" | "lg";
  children: ReactNode;
}) {
  return (
    <span
      className={classNames("native-glyph", `tint-${tint}`, size === "lg" && "native-glyph-lg")}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

/* ---------------- Hero ---------------- */

export function NativeHero({
  children,
  centred,
  className,
}: {
  children: ReactNode;
  centred?: boolean;
  className?: string;
}) {
  return (
    <section className={classNames("native-hero", centred && "native-hero-centred", className)}>
      <span className="native-hero-glow" aria-hidden="true" />
      {children}
    </section>
  );
}

/** Fraction of the bar that is filled, clamped so bad data cannot overflow the track. */
export function NativeMeter({ percent, label }: { percent: number; label?: string }) {
  const bounded = Math.max(0, Math.min(100, percent));

  return (
    <div
      className="native-meter"
      role="progressbar"
      aria-valuenow={Math.round(bounded)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <b style={{ width: `${bounded}%` }} />
    </div>
  );
}

/* ---------------- Stats ---------------- */

export function NativeStatGrid({ children }: { children: ReactNode }) {
  return <div className="native-stat-grid">{children}</div>;
}

export function NativeStat({
  icon,
  label,
  value,
  caption,
  tint,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  caption?: ReactNode;
  tint: NativeTint;
}) {
  return (
    <article className={classNames("native-stat", `tint-${tint}`)}>
      {icon}
      <span>{label}</span>
      <b>{value}</b>
      {caption != null ? <small>{caption}</small> : null}
    </article>
  );
}

/* ---------------- Search ---------------- */

export function NativeSearch({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <label className="native-search">
      <LuSearch className="h-4 w-4 shrink-0" aria-hidden="true" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
      />
    </label>
  );
}
