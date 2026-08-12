import { useEffect, useLayoutEffect, useState } from "react";

type SpringOptions = {
  /** Damping ratio: 1 settles without overshoot, below 1 bounces. */
  damping?: number;
  /** Seconds to reach the target. Not a duration — a spring has none. */
  response?: number;
  /** Hand-off velocity in px/s, taken straight from the gesture that just ended. */
  velocity?: number;
};

export type Spring = {
  value: () => number;
  set: (target: number, options?: SpringOptions) => void;
  jump: (value: number) => void;
  stop: () => void;
  /** Registers the frame sink; returns the unsubscribe. */
  observe: (onFrame: (value: number) => void) => () => void;
};

const REST_DISTANCE = 0.05;
const REST_VELOCITY = 2;
const MAX_STEP_SECONDS = 1 / 30;
const DEFAULT_DAMPING = 1;
const DEFAULT_RESPONSE = 0.35;

/**
 * Where a flick would come to rest, using the same exponential decay as scroll deceleration.
 * Snap targets are chosen from this point rather than from the release point, so a fast flick
 * throws the element past the halfway mark a slow drag would not reach.
 */
export function projectMomentum(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Progressive resistance past a boundary — the further out, the less the element follows. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function createSpring(initialValue: number): Spring {
  let value = initialValue;
  let target = initialValue;
  let velocity = 0;
  let damping = DEFAULT_DAMPING;
  let response = DEFAULT_RESPONSE;
  let handle = 0;
  let lastTime = 0;
  let onFrame: (value: number) => void = () => {};

  function step(now: number) {
    const seconds = Math.min((now - lastTime) / 1000, MAX_STEP_SECONDS);
    lastTime = now;

    const frequency = (2 * Math.PI) / response;
    const acceleration =
      -frequency * frequency * (value - target) - 2 * damping * frequency * velocity;

    velocity += acceleration * seconds;
    value += velocity * seconds;

    if (Math.abs(target - value) < REST_DISTANCE && Math.abs(velocity) < REST_VELOCITY) {
      value = target;
      velocity = 0;
      handle = 0;
      onFrame(value);
      return;
    }

    onFrame(value);
    handle = requestAnimationFrame(step);
  }

  function start() {
    if (handle !== 0) {
      return;
    }

    lastTime = performance.now();
    handle = requestAnimationFrame(step);
  }

  function cancel() {
    if (handle === 0) {
      return;
    }

    cancelAnimationFrame(handle);
    handle = 0;
  }

  return {
    value: () => value,

    // Re-targeting keeps the live value and velocity, so an animation grabbed mid-flight
    // continues from where it is on screen instead of jumping to a fresh start.
    set(nextTarget, options) {
      target = nextTarget;
      damping = options?.damping ?? DEFAULT_DAMPING;
      response = options?.response ?? DEFAULT_RESPONSE;

      if (options?.velocity !== undefined) {
        velocity = options.velocity;
      }

      if (prefersReducedMotion()) {
        cancel();
        value = target;
        velocity = 0;
        onFrame(value);
        return;
      }

      start();
    },

    jump(nextValue) {
      cancel();
      value = nextValue;
      target = nextValue;
      velocity = 0;
      onFrame(value);
    },

    stop: cancel,

    // Emits straight away so the subscriber paints the current value instead of whatever
    // markup it started with — inline transforms from JSX would be overwritten on re-render.
    observe(nextFrame) {
      onFrame = nextFrame;
      nextFrame(value);

      return () => {
        if (onFrame === nextFrame) {
          onFrame = () => {};
        }
      };
    },
  };
}

/**
 * `onFrame` should be stable (useCallback) and write straight to the DOM — the whole point of
 * the engine is to animate without a render per frame.
 */
export function useSpring(initialValue: number, onFrame: (value: number) => void): Spring {
  const [spring] = useState(() => createSpring(initialValue));

  // Layout effect so the first frame is already wired before anything paints.
  useLayoutEffect(() => spring.observe(onFrame), [spring, onFrame]);

  useEffect(() => () => spring.stop(), [spring]);

  return spring;
}
