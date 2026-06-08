import {
  useEffect,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
} from "@floating-ui/react";
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
  const isMobileViewport = useIsMobileViewport();

  // Desktop anchored positioning via floating-ui; mobile renders a centered modal below
  // and skips floating entirely. The panel element is tracked in state so autoUpdate can
  // re-measure it and the desktop outside-press check can test containment.
  const [panelElement, setPanelElement] = useState<HTMLDivElement | null>(null);
  const { floatingStyles, isPositioned } = useFloating({
    open: isOpen && !isMobileViewport,
    strategy: "fixed",
    placement: "bottom-start",
    middleware: [
      offset(DESKTOP_OFFSET_PX),
      flip({ padding: DESKTOP_OFFSET_PX }),
      shift({ padding: DESKTOP_OFFSET_PX }),
    ],
    whileElementsMounted: autoUpdate,
    elements: { reference: anchorElement, floating: panelElement },
  });

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
      if (!panelElement) {
        return;
      }

      if (!panelElement.contains(event.target as Node)) {
        onClose();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isMobileViewport, isOpen, onClose, panelElement]);

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

  if (!isOpen) {
    return null;
  }

  if (!isMobileViewport && !anchorElement) {
    return null;
  }

  const panelClassName = [
    "liquid-panel liquid-picker-panel liquid-floating-surface border border-(--glass-divider) p-4",
    isMobileViewport ? "w-full rounded-3xl" : `rounded-3xl ${desktopWidthClassName}`,
  ].join(" ");

  const innerContent = (
    <>
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
    </>
  );

  if (!isMobileViewport) {
    return (
      <FloatingPortal>
        <div
          ref={setPanelElement}
          role="dialog"
          aria-label={title}
          className={`${panelClassName} z-120`}
          style={{ ...floatingStyles, visibility: isPositioned ? "visible" : "hidden" }}
        >
          {innerContent}
        </div>
      </FloatingPortal>
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

  return (
    <FloatingPortal>
      <div className="fixed inset-0 z-120 flex items-center justify-center p-4">
        <button
          type="button"
          onPointerDown={handleMobileOverlayPointerDown}
          onClick={handleMobileOverlayClick}
          className="liquid-overlay-strong liquid-picker-mobile-overlay-in absolute inset-0 cursor-pointer"
          aria-label={`Close ${title.toLowerCase()} editor`}
        />
        <div className="liquid-picker-mobile-panel-in relative w-full max-w-sm">
          <div role="dialog" aria-modal aria-label={title} className={panelClassName}>
            {innerContent}
          </div>
        </div>
      </div>
    </FloatingPortal>
  );
}
