import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

/** Past this fraction of the sheet height, releasing minimizes. */
const MINIMIZE_DISTANCE_RATIO = 0.25;
/** Or past this flick velocity (px/ms), regardless of distance (Emil's threshold). */
const MINIMIZE_VELOCITY = 0.4;
/** Velocity is read off the tail of the gesture, not its average — a slow drag that ends in a
    flick has to register as a flick, and a drag that ends parked has to register as parked. */
const VELOCITY_WINDOW_MS = 100;
/** Rubber-band factor when dragging UP past the open boundary (friction, not a wall). */
const UP_DAMPING = 0.2;
/** Most the scrim may thin out, at full travel. The sheet is near-transparent glass over
    saturate(1.8): whatever the scrim stops covering is what the panel takes its colour from,
    so the scrim can only ever be eased, never dropped, while the sheet is still in hand. */
const SCRIM_MAX_FADE = 0.35;

type PointerSample = { y: number; time: number };

type UseDragToMinimizeOptions = {
  sheetRef: RefObject<HTMLElement | null>;
  scrimRef: RefObject<HTMLElement | null>;
  onMinimize: () => void;
  disabled?: boolean;
};

type DragHandlers = {
  onPointerDown: (event: ReactPointerEvent) => void;
  onPointerMove: (event: ReactPointerEvent) => void;
  onPointerUp: (event: ReactPointerEvent) => void;
  onPointerCancel: (event: ReactPointerEvent) => void;
};

/**
 * Drag-down-to-minimize for the workout sheet. Pointer handlers are spread on the grab
 * handle only (so the scroll body still scrolls). During a drag we write `transform` on the
 * sheet and `opacity` on the scrim directly (GPU-only, no React re-render, no parent CSS
 * var); on release React reclaims `transform` from status and the CSS curve animates the rest.
 */
export function useDragToMinimize({ sheetRef, scrimRef, onMinimize, disabled }: UseDragToMinimizeOptions): {
  isDragging: boolean;
  dragHandlers: DragHandlers;
} {
  const [isDragging, setIsDragging] = useState(false);
  const draggingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const startYRef = useRef(0);
  const heightRef = useRef(0);
  const offsetRef = useRef(0);
  const samplesRef = useRef<PointerSample[]>([]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent) => {
      if (disabled || draggingRef.current || !event.isPrimary) {
        return;
      }

      draggingRef.current = true;
      pointerIdRef.current = event.pointerId;
      startYRef.current = event.clientY;
      heightRef.current = sheetRef.current?.offsetHeight ?? 0;
      offsetRef.current = 0;
      samplesRef.current = [{ y: event.clientY, time: performance.now() }];

      // The scrim's own 200ms fade would trail every frame we write below.
      const scrim = scrimRef.current;
      if (scrim) {
        scrim.style.transition = "none";
      }

      event.currentTarget.setPointerCapture(event.pointerId);
      setIsDragging(true);
    },
    [disabled, scrimRef, sheetRef],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent) => {
      if (!draggingRef.current || event.pointerId !== pointerIdRef.current) {
        return;
      }

      const now = performance.now();
      const samples = samplesRef.current;
      samples.push({ y: event.clientY, time: now });
      // Keep the oldest sample that still spans the window, and nothing older.
      while (samples.length > 2 && now - samples[1].time >= VELOCITY_WINDOW_MS) {
        samples.shift();
      }

      const dy = event.clientY - startYRef.current;
      // Downward 1:1 toward minimize; upward damped (can't open higher than fully open).
      const offset = dy >= 0 ? dy : dy * UP_DAMPING;
      offsetRef.current = offset;

      const element = sheetRef.current;
      if (element) {
        element.style.transform = `translateY(${offset}px)`;
      }

      const scrim = scrimRef.current;
      if (scrim && heightRef.current > 0) {
        const progress = Math.min(Math.max(offset / heightRef.current, 0), 1);
        scrim.style.opacity = String(1 - progress * SCRIM_MAX_FADE);
      }
    },
    [scrimRef, sheetRef],
  );

  const finishDrag = useCallback(
    (event: ReactPointerEvent, cancelled: boolean) => {
      if (!draggingRef.current || event.pointerId !== pointerIdRef.current) {
        return;
      }

      draggingRef.current = false;
      pointerIdRef.current = null;

      const dy = offsetRef.current;
      const oldest = samplesRef.current[0];
      const elapsed = oldest ? performance.now() - oldest.time : 0;
      const velocity = oldest && elapsed > 0 ? (event.clientY - oldest.y) / elapsed : 0;
      const shouldMinimize =
        !cancelled
        && dy > 0
        && (dy > heightRef.current * MINIMIZE_DISTANCE_RATIO || velocity > MINIMIZE_VELOCITY);

      // Hand the scrim back to its class before React commits, so clearing our inline opacity
      // and the class's next value land in the same change — the 200ms fade picks up from
      // wherever the drag left it instead of cutting.
      const scrim = scrimRef.current;
      if (scrim) {
        scrim.style.transition = "";
        scrim.style.opacity = "";
      }

      // Flip isDragging off — React re-renders and reclaims `transform` from status in the
      // same commit (overwriting our inline value), so the CSS curve animates the snap/close.
      setIsDragging(false);

      if (shouldMinimize) {
        onMinimize();
      }
    },
    [onMinimize, scrimRef],
  );

  const onPointerUp = useCallback((event: ReactPointerEvent) => finishDrag(event, false), [finishDrag]);
  const onPointerCancel = useCallback((event: ReactPointerEvent) => finishDrag(event, true), [finishDrag]);

  return {
    isDragging,
    dragHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}
