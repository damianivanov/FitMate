import type { ReactNode } from "react";

type SwapInProps = {
  /** Changing this replays the animation — pass the tab, filter or step being shown. */
  swapKey: string | number;
  /**
   * Which way the new content travelled to get here. Content that arrives from the right
   * should later leave to the right: if a thing appears from one direction we expect it to
   * go back the same way, and mismatched paths read as two unrelated screens.
   */
  direction?: "forward" | "back";
  className?: string;
  children: ReactNode;
};

export function SwapIn({ swapKey, direction = "forward", className, children }: SwapInProps) {
  // The clip wrapper is not optional: the inner element is full width, so sliding it
  // sideways overflows whatever scroll container it sits in — and a container with
  // `overflow-y: auto` computes `overflow-x` to auto as well, so a horizontal scrollbar
  // flashes for as long as the animation runs.
  return (
    <div className="liquid-swap-clip">
      <div
        key={String(swapKey)}
        className={`liquid-swap-${direction}${className ? ` ${className}` : ""}`}
      >
        {children}
      </div>
    </div>
  );
}
