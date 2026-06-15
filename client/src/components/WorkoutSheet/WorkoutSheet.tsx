import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LuLoaderCircle } from "react-icons/lu";
import WorkoutBuilder from "@/pages/WorkoutBuilder/WorkoutBuilder";
import { WorkoutSheetStatus } from "@/stores/activeWorkoutStore";
import { lockBodyScroll, unlockBodyScroll } from "@/shared/utils/bodyScrollLock";
import { useDragToMinimize } from "./useDragToMinimize";

type WorkoutSheetProps = {
  status: WorkoutSheetStatus;
  workoutId: number | null;
  templateId: number | null;
  isStarting: boolean;
  onMinimize: () => void;
  onClose: () => void;
  onMetaChange: (meta: { title: string; startedAt?: string }) => void;
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * The mobile workout bottom sheet. Slides up on open, parks off-screen (translateY 100%)
 * — but stays MOUNTED — when minimized so the workout keeps running. Renders the existing
 * <WorkoutBuilder> as its content; drag-down or the header chevron minimize it.
 */
export function WorkoutSheet({
  status,
  workoutId,
  templateId,
  isStarting,
  onMinimize,
  onClose,
  onMetaChange,
}: WorkoutSheetProps) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [isEntered, setIsEntered] = useState(false);
  const [reduceMotion] = useState(prefersReducedMotion);

  const { isDragging, dragHandlers } = useDragToMinimize({
    sheetRef,
    onMinimize,
    disabled: reduceMotion,
  });

  const isOpen = status === WorkoutSheetStatus.Open;
  const isMinimized = status === WorkoutSheetStatus.Minimized;

  // Double-rAF so the panel mounts at translateY(100%) and then animates up to 0.
  useEffect(() => {
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => setIsEntered(true));
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, []);

  // Lock body scroll only while open (the app must scroll behind the mini-bar when minimized).
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [isOpen]);

  // Esc minimizes (does not close) while open.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      onMinimize();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onMinimize]);

  // Move focus into the sheet when it opens.
  useEffect(() => {
    if (isOpen && isEntered) {
      sheetRef.current?.focus();
    }
  }, [isOpen, isEntered]);

  const translatePercent = isMinimized || !isEntered ? 100 : 0;

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className={[
        "fixed inset-0 z-[var(--z-sheet)] md:hidden",
        isMinimized ? "pointer-events-none" : "",
      ].join(" ")}
      aria-hidden={isMinimized ? true : undefined}
    >
      <div
        className={[
          "liquid-overlay absolute inset-0 transition-opacity duration-200 ease-out",
          isOpen && !isDragging ? "opacity-100" : "opacity-0",
        ].join(" ")}
        onClick={onMinimize}
        aria-hidden="true"
      />

      <div
        ref={sheetRef}
        role="dialog"
        aria-modal={isOpen ? true : undefined}
        aria-label="Workout in progress"
        tabIndex={-1}
        className="liquid-workout-sheet absolute inset-0 flex flex-col outline-none"
        style={
          isDragging
            ? { transition: "none" }
            : { transform: `translateY(${translatePercent}%)` }
        }
      >
        <div
          {...dragHandlers}
          style={{ touchAction: "none", paddingTop: "env(safe-area-inset-top, 0px)" }}
          className="flex shrink-0 cursor-grab items-center justify-center py-2 active:cursor-grabbing"
        >
          <span className="liquid-sheet-handle" aria-hidden="true" />
        </div>

        <div className="liquid-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
          {isStarting && workoutId === null ? (
            <div className="flex flex-1 items-center justify-center">
              <LuLoaderCircle className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <WorkoutBuilder
              sheetWorkoutId={workoutId}
              sheetTemplateId={templateId}
              onBack={onMinimize}
              onFinished={() => onClose()}
              onDeleted={onClose}
              onMetaChange={onMetaChange}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
