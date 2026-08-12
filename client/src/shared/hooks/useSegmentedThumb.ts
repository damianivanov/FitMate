import { useCallback, useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";
import { useSpring } from "./useSpring";

/**
 * Critically damped, no overshoot. Bounce is earned by gestures that carried momentum — a
 * tap carries none, and an overshooting thumb would poke out past the end of the track.
 */
const SELECT_DAMPING = 1;
const SELECT_RESPONSE = 0.34;

/**
 * Drives the selection thumb of a segmented control.
 *
 * The position is expressed in segments, not pixels: the thumb is one segment wide in CSS
 * and travels by whole multiples of its own width. Nothing is measured, so there is no way
 * for the indicator to desync from the segment it belongs to — which is what happens when
 * offsets are read before layout has settled.
 *
 * The track needs `position: relative`, `--liquid-segment-count` set, and equal-width
 * segments.
 */
export function useSegmentedThumb(activeIndex: number): {
  thumbRef: RefObject<HTMLSpanElement | null>;
} {
  const thumbRef = useRef<HTMLSpanElement | null>(null);

  const applyPosition = useCallback((position: number) => {
    const thumb = thumbRef.current;
    if (thumb) {
      thumb.style.transform = `translate3d(${position * 100}%, 0, 0)`;
    }
  }, []);

  const spring = useSpring(activeIndex, applyPosition);

  useLayoutEffect(() => {
    spring.set(activeIndex, { damping: SELECT_DAMPING, response: SELECT_RESPONSE });
  }, [activeIndex, spring]);

  return { thumbRef };
}
