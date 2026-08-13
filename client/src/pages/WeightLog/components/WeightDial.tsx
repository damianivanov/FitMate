import { useEffect, useRef, useState } from "react";
import { formatNumber } from "@/lib/helpers";

type WeightDialProps = {
  value: number | null;
  low: number | null;
  high: number | null;
};

const SWEEP_DEGREES = 270;
const TICK_COUNT = 41;
const REVEAL_MS = 950;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function toProgress(value: number | null, low: number | null, high: number | null): number {
  if (value == null || low == null || high == null) {
    return 0;
  }

  if (high - low < 0.05) {
    return 0.5;
  }

  return Math.min(1, Math.max(0, (value - low) / (high - low)));
}

/** Eases toward a target, resuming from what is on screen so a retarget redirects mid-flight. */
function useEasedValue(target: number): number {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));
  const currentRef = useRef(value);

  useEffect(() => {
    const duration = prefersReducedMotion() ? 0 : REVEAL_MS;
    const from = currentRef.current;
    const start = performance.now();
    let frameId = 0;

    const step = (now: number) => {
      const elapsed = duration === 0 ? 1 : Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - elapsed) ** 3;
      const next = from + (target - from) * eased;

      currentRef.current = next;
      setValue(next);

      if (elapsed < 1) {
        frameId = requestAnimationFrame(step);
      }
    };

    frameId = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frameId);
  }, [target]);

  return value;
}

export function WeightDial({ value, low, high }: WeightDialProps) {
  const progress = useEasedValue(toProgress(value, low, high));
  const startAngle = -SWEEP_DEGREES / 2;
  const headAngle = startAngle + progress * SWEEP_DEGREES;

  return (
    <div className="wl-dial">
      <div className="wl-dial-well" aria-hidden="true" />

      <svg className="wl-dial-marks" viewBox="0 0 200 200" aria-hidden="true">
        <circle className="wl-dial-rim" cx="100" cy="100" r="95" />

        {Array.from({ length: TICK_COUNT }, (_, index) => {
          const position = index / (TICK_COUNT - 1);
          const isLit = value != null && position <= progress;

          return (
            <line
              key={index}
              className={`wl-dial-tick${isLit ? " wl-dial-tick-lit" : ""}`}
              x1="100"
              y1="14"
              x2="100"
              y2="24"
              transform={`rotate(${(startAngle + position * SWEEP_DEGREES).toFixed(2)} 100 100)`}
            />
          );
        })}

        {value != null ? (
          <line
            className="wl-dial-head"
            x1="100"
            y1="9"
            x2="100"
            y2="27"
            transform={`rotate(${headAngle.toFixed(2)} 100 100)`}
          />
        ) : null}
      </svg>

      <div className="wl-dial-face">
        <p className="wl-dial-label">Current</p>
        <p className="wl-dial-number">{value != null ? formatNumber(value, 1) : "—"}</p>
        <p className="wl-dial-unit">kilograms</p>
      </div>
    </div>
  );
}
