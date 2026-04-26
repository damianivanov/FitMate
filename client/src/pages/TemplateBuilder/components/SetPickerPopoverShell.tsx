import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { LuX } from "react-icons/lu";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";

type SetPickerPopoverShellProps = {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  desktopWidthClassName?: string;
  anchorElement?: HTMLElement | null;
};
const DESKTOP_OFFSET_PX = 8;

export function SetPickerPopoverShell({
  isOpen,
  title,
  onClose,
  children,
  desktopWidthClassName = "w-72",
  anchorElement = null,
}: SetPickerPopoverShellProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isMobileViewport = useIsMobileViewport();
  const [desktopPosition, setDesktopPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);

    if (isMobileViewport) {
      return () => {
        window.removeEventListener("keydown", handleEscape);
      };
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current) {
        return;
      }

      if (!containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isMobileViewport, isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !isMobileViewport || typeof document === "undefined") {
      return;
    }

    const previousOverflowValue = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflowValue;
    };
  }, [isMobileViewport, isOpen]);

  const updateDesktopPosition = useCallback(() => {
    if (typeof window === "undefined" || !anchorElement || !containerRef.current) {
      return;
    }

    const anchorRect = anchorElement.getBoundingClientRect();
    const panelRect = containerRef.current.getBoundingClientRect();
    const maxLeft = window.innerWidth - panelRect.width - DESKTOP_OFFSET_PX;
    const boundedLeft = Math.max(
      DESKTOP_OFFSET_PX,
      Math.min(anchorRect.left, Math.max(DESKTOP_OFFSET_PX, maxLeft)),
    );
    const topBelowAnchor = anchorRect.bottom + DESKTOP_OFFSET_PX;
    const topAboveAnchor = anchorRect.top - panelRect.height - DESKTOP_OFFSET_PX;
    const fitsBelowAnchor = topBelowAnchor + panelRect.height <= window.innerHeight - DESKTOP_OFFSET_PX;
    const nextTop = fitsBelowAnchor
      ? topBelowAnchor
      : Math.max(DESKTOP_OFFSET_PX, topAboveAnchor);
    const roundedTop = Math.round(nextTop);
    const roundedLeft = Math.round(boundedLeft);

    setDesktopPosition((previous) => {
      if (previous?.top === roundedTop && previous.left === roundedLeft) {
        return previous;
      }

      return { top: roundedTop, left: roundedLeft };
    });
  }, [anchorElement]);

  useEffect(() => {
    if (!isOpen || isMobileViewport) {
      return;
    }

    const updatePosition = () => {
      updateDesktopPosition();
    };

    const frameId = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, isMobileViewport, updateDesktopPosition]);

  if (!isOpen) {
    return null;
  }

  if (!isMobileViewport && !anchorElement) {
    return null;
  }

  const desktopPanelStyle: CSSProperties | undefined = isMobileViewport
    ? undefined
    : {
        position: "fixed",
        top: desktopPosition?.top ?? 0,
        left: desktopPosition?.left ?? 0,
      };

  const panelClassName = [
    "liquid-panel liquid-picker-panel liquid-floating-surface border border-(--glass-divider) p-4",
    isMobileViewport
      ? "w-full rounded-3xl"
      : `rounded-3xl ${desktopWidthClassName}`,
    !isMobileViewport && !desktopPosition ? "opacity-0" : "",
  ].join(" ");

  const panelContent = (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal={isMobileViewport ? true : undefined}
      aria-label={title}
      className={panelClassName}
      style={desktopPanelStyle}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">{title}</p>
        {isMobileViewport ? (
          <button
            type="button"
            onClick={onClose}
            className="liquid-pill flex h-8 w-8 cursor-pointer items-center justify-center rounded-full"
            aria-label={`Close ${title.toLowerCase()} editor`}
          >
            <LuX className="h-4 w-4 text-secondary" />
          </button>
        ) : null}
      </div>
      {children}
    </div>
  );

  if (typeof document === "undefined") {
    return panelContent;
  }

  if (!isMobileViewport) {
    return createPortal(
      <div className="fixed inset-0 z-120 pointer-events-none">
        <div className="pointer-events-auto">
          {panelContent}
        </div>
      </div>,
      document.body,
    );
  }

  const handleMobileOverlayPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleMobileOverlayClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-120 flex items-center justify-center p-4">
      <button
        type="button"
        onPointerDown={handleMobileOverlayPointerDown}
        onClick={handleMobileOverlayClick}
        className="liquid-overlay-strong liquid-picker-mobile-overlay-in absolute inset-0 cursor-pointer"
        aria-label={`Close ${title.toLowerCase()} editor`}
      />
      <div className="liquid-picker-mobile-panel-in relative w-full max-w-sm">
        {panelContent}
      </div>
    </div>,
    document.body,
  );
}
