import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

/** Past this fraction of the sheet height, releasing minimizes. */
const MINIMIZE_DISTANCE_RATIO = 0.25;
/** Or past this flick velocity (px/ms), regardless of distance (Emil's threshold). */
const MINIMIZE_VELOCITY = 0.11;
/** Rubber-band factor when dragging UP past the open boundary (friction, not a wall). */
const UP_DAMPING = 0.2;

type UseDragToMinimizeOptions = {
  sheetRef: RefObject<HTMLElement | null>;
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
 * handle only (so the scroll body still scrolls). During a drag we write `transform`
 * directly on the sheet element (GPU-only, no React re-render, no parent CSS var); on
 * release React reclaims `transform` from status and the CSS curve animates the rest.
 */
export function useDragToMinimize({ sheetRef, onMinimize, disabled }: UseDragToMinimizeOptions): {
  isDragging: boolean;
  dragHandlers: DragHandlers;
} {
  const [isDragging, setIsDragging] = useState(false);
  const draggingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const startYRef = useRef(0);
  const startTimeRef = useRef(0);
  const offsetRef = useRef(0);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent) => {
      if (disabled || draggingRef.current || !event.isPrimary) {
        return;
      }

      draggingRef.current = true;
      pointerIdRef.current = event.pointerId;
      startYRef.current = event.clientY;
      startTimeRef.current = performance.now();
      offsetRef.current = 0;
      event.currentTarget.setPointerCapture(event.pointerId);
      setIsDragging(true);
    },
    [disabled],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent) => {
      if (!draggingRef.current || event.pointerId !== pointerIdRef.current) {
        return;
      }

      const dy = event.clientY - startYRef.current;
      // Downward 1:1 toward minimize; upward damped (can't open higher than fully open).
      const offset = dy >= 0 ? dy : dy * UP_DAMPING;
      offsetRef.current = offset;

      const element = sheetRef.current;
      if (element) {
        element.style.transform = `translateY(${offset}px)`;
      }
    },
    [sheetRef],
  );

  const finishDrag = useCallback(
    (event: ReactPointerEvent, cancelled: boolean) => {
      if (!draggingRef.current || event.pointerId !== pointerIdRef.current) {
        return;
      }

      draggingRef.current = false;
      pointerIdRef.current = null;

      const dy = offsetRef.current;
      const dt = performance.now() - startTimeRef.current;
      const velocity = dt > 0 ? Math.abs(dy) / dt : 0;
      const height = sheetRef.current?.offsetHeight ?? 0;
      const shouldMinimize =
        !cancelled
        && dy > 0
        && (dy > height * MINIMIZE_DISTANCE_RATIO || velocity > MINIMIZE_VELOCITY);

      // Flip isDragging off — React re-renders and reclaims `transform` from status in the
      // same commit (overwriting our inline value), so the CSS curve animates the snap/close.
      setIsDragging(false);

      if (shouldMinimize) {
        onMinimize();
      }
    },
    [onMinimize, sheetRef],
  );

  const onPointerUp = useCallback((event: ReactPointerEvent) => finishDrag(event, false), [finishDrag]);
  const onPointerCancel = useCallback((event: ReactPointerEvent) => finishDrag(event, true), [finishDrag]);

  return {
    isDragging,
    dragHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}
