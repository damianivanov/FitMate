import { useCallback, useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { projectMomentum, rubberband, useSpring } from "./useSpring";
import { tick } from "../utils/haptics";

type UseSwipeRevealOptions = {
  /** How far the track travels when fully open, in px. */
  revealWidth: number;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  disabled?: boolean;
  /** How far a hovering mouse nudges the row toward the hidden action. 0 disables it. */
  hoverHint?: number;
};

type SwipeHandlers = {
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerEnter: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerLeave: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

const DIRECTION_THRESHOLD = 10;
const FLICK_VELOCITY = 120;
const VELOCITY_WINDOW_MS = 90;
const SNAP_RESPONSE = 0.35;
const HINT_RESPONSE = 0.3;

/** Marks the revealed action lane so a press there is a tap, not the start of a swipe. */
export const SWIPE_ACTIONS_ATTRIBUTE = "data-swipe-actions";

type Sample = { x: number; time: number };

function readVelocity(samples: Sample[]): number {
  if (samples.length < 2) {
    return 0;
  }

  const last = samples[samples.length - 1];
  let first = last;

  for (let index = samples.length - 2; index >= 0; index -= 1) {
    if (last.time - samples[index].time > VELOCITY_WINDOW_MS) {
      break;
    }

    first = samples[index];
  }

  const elapsed = last.time - first.time;
  return elapsed > 0 ? ((last.x - first.x) / elapsed) * 1000 : 0;
}

/**
 * Swipe-to-reveal, tracking the pointer 1:1 and settling on a spring.
 *
 * The release picks its target from where the flick would *come to rest*, not from where the
 * finger left off, and hands its velocity to the spring — so there is no seam between the drag
 * and the animation, and a row grabbed mid-flight keeps whatever motion it already had.
 */
export function useSwipeReveal({
  revealWidth,
  isOpen,
  onOpenChange,
  disabled = false,
  hoverHint = 10,
}: UseSwipeRevealOptions): {
  trackRef: RefObject<HTMLDivElement | null>;
  swipeHandlers: SwipeHandlers;
} {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const committedOpen = useRef(isOpen);
  const isHinting = useRef(false);
  const gesture = useRef({
    pointerId: -1,
    startX: 0,
    startY: 0,
    startOffset: 0,
    axis: "none" as "none" | "x" | "y",
    samples: [] as Sample[],
  });

  const applyOffset = useCallback((offset: number) => {
    const track = trackRef.current;
    if (track) {
      track.style.transform = `translate3d(${offset}px, 0, 0)`;
    }
  }, []);

  const spring = useSpring(isOpen ? -revealWidth : 0, applyOffset);

  const settle = useCallback(
    (shouldOpen: boolean, velocity: number) => {
      const hadMomentum = Math.abs(velocity) > FLICK_VELOCITY;

      spring.set(shouldOpen ? -revealWidth : 0, {
        velocity,
        // Overshoot is only earned when the gesture itself carried momentum.
        damping: hadMomentum ? 0.8 : 1,
        response: SNAP_RESPONSE,
      });

      if (committedOpen.current === shouldOpen) {
        return;
      }

      committedOpen.current = shouldOpen;
      tick();
      onOpenChange(shouldOpen);
    },
    [onOpenChange, revealWidth, spring],
  );

  useEffect(() => {
    if (committedOpen.current === isOpen) {
      return;
    }

    committedOpen.current = isOpen;
    spring.set(isOpen ? -revealWidth : 0, { damping: 1, response: SNAP_RESPONSE });
  }, [isOpen, revealWidth, spring]);

  const clampOffset = useCallback(
    (raw: number) => {
      const width = trackRef.current?.offsetWidth ?? revealWidth * 3;

      if (raw > 0) {
        return rubberband(raw, width);
      }

      if (raw < -revealWidth) {
        return -revealWidth - rubberband(-(raw + revealWidth), width);
      }

      return raw;
    },
    [revealWidth],
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (disabled || (event.pointerType === "mouse" && event.button !== 0)) {
        return;
      }

      if (event.target instanceof Element && event.target.closest(`[${SWIPE_ACTIONS_ATTRIBUTE}]`)) {
        return;
      }

      event.currentTarget.setPointerCapture(event.pointerId);
      // Grab whatever is on screen right now, mid-flight included.
      spring.stop();

      gesture.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startOffset: spring.value(),
        axis: "none",
        samples: [{ x: event.clientX, time: event.timeStamp }],
      };
    },
    [disabled, spring],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const state = gesture.current;
      if (state.pointerId !== event.pointerId) {
        return;
      }

      const deltaX = event.clientX - state.startX;
      const deltaY = event.clientY - state.startY;

      if (state.axis === "none") {
        if (Math.abs(deltaX) < DIRECTION_THRESHOLD && Math.abs(deltaY) < DIRECTION_THRESHOLD) {
          return;
        }

        if (Math.abs(deltaY) >= Math.abs(deltaX)) {
          state.axis = "y";
          event.currentTarget.releasePointerCapture(event.pointerId);
          state.pointerId = -1;
          return;
        }

        state.axis = "x";
        // Re-anchor to where the swipe was recognised, so tracking starts from zero instead
        // of jumping by the threshold.
        state.startX += Math.sign(deltaX) * DIRECTION_THRESHOLD;
      }

      state.samples.push({ x: event.clientX, time: event.timeStamp });
      if (state.samples.length > 6) {
        state.samples.shift();
      }

      spring.jump(clampOffset(state.startOffset + (event.clientX - state.startX)));
    },
    [clampOffset, spring],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const state = gesture.current;
      if (state.pointerId !== event.pointerId) {
        return;
      }

      state.pointerId = -1;

      if (state.axis !== "x") {
        if (committedOpen.current) {
          settle(false, 0);
        } else {
          spring.set(isHinting.current ? -hoverHint : 0, {
            damping: 1,
            response: HINT_RESPONSE,
          });
        }

        return;
      }

      const velocity = readVelocity(state.samples);
      const projected = spring.value() + projectMomentum(velocity);
      settle(projected < -revealWidth / 2, velocity);
    },
    [hoverHint, revealWidth, settle, spring],
  );

  const onPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const state = gesture.current;
      if (state.pointerId !== event.pointerId) {
        return;
      }

      state.pointerId = -1;
      settle(committedOpen.current, 0);
    },
    [settle],
  );

  // A mouse has no swipe affordance, so the row leans toward the action it is hiding.
  const onPointerEnter = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== "mouse" || committedOpen.current || disabled || hoverHint === 0) {
        return;
      }

      isHinting.current = true;
      spring.set(-hoverHint, { damping: 1, response: HINT_RESPONSE });
    },
    [disabled, hoverHint, spring],
  );

  const onPointerLeave = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== "mouse") {
        return;
      }

      isHinting.current = false;

      if (gesture.current.pointerId !== -1) {
        return;
      }

      spring.set(committedOpen.current ? -revealWidth : 0, {
        damping: 1,
        response: HINT_RESPONSE,
      });
    },
    [revealWidth, spring],
  );

  return {
    trackRef,
    swipeHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onPointerEnter,
      onPointerLeave,
    },
  };
}
