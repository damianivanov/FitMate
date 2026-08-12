import type { ReactNode } from "react";

type JumpValueProps = {
  /** Changing this replays the animation, so it must be the value being shown. */
  value: string | number;
  children?: ReactNode;
  className?: string;
};

/**
 * A value that jumps when it changes.
 *
 * A number that swaps silently gives no sign anything happened; a short rise into place
 * makes the change legible without a full-blown transition. Keyed on the value, so React
 * replaces the node and the animation replays from the start every time.
 */
export function JumpValue({ value, children, className }: JumpValueProps) {
  return (
    <span
      key={String(value)}
      className={`liquid-jump inline-block${className ? ` ${className}` : ""}`}
    >
      {children ?? value}
    </span>
  );
}
