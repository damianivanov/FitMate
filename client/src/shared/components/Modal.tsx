import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type TransitionEvent as ReactTransitionEvent,
} from "react";
import { createPortal } from "react-dom";
import { LuX } from "react-icons/lu";

type ModalSize = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "default";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxWidth?: ModalSize;
};

const EXIT_DURATION_MS = 220;

const sizeClasses: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  default: "max-w-3xl",
};

let bodyScrollLockCount = 0;
let previousBodyOverflowValue = "";

function lockBodyScroll(): void {
  if (typeof document === "undefined") {
    return;
  }

  if (bodyScrollLockCount === 0) {
    previousBodyOverflowValue = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }

  bodyScrollLockCount += 1;
}

function unlockBodyScroll(): void {
  if (typeof document === "undefined" || bodyScrollLockCount === 0) {
    return;
  }

  bodyScrollLockCount -= 1;

  if (bodyScrollLockCount === 0) {
    document.body.style.overflow = previousBodyOverflowValue;
    previousBodyOverflowValue = "";
  }
}

export function Modal({ isOpen, onClose, title, children, maxWidth = "default" }: ModalProps) {
  const [isMounted, setIsMounted] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = `${useId()}-title`;

  useEffect(() => {
    let animationFrameId = 0;
    if (isOpen) {
      animationFrameId = window.requestAnimationFrame(() => {
        setIsMounted(true);
      });
    } else {
      animationFrameId = window.requestAnimationFrame(() => {
        setIsVisible(false);
      });
    }

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isMounted || !isOpen) {
      return;
    }

    let animationFrameId = 0;
    let nestedAnimationFrameId = 0;

    animationFrameId = window.requestAnimationFrame(() => {
      nestedAnimationFrameId = window.requestAnimationFrame(() => {
        setIsVisible(true);
      });
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.cancelAnimationFrame(nestedAnimationFrameId);
    };
  }, [isMounted, isOpen]);

  useEffect(() => {
    if (!isMounted || isOpen) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsMounted(false);
    }, EXIT_DURATION_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isMounted, isOpen]);

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    lockBodyScroll();

    return () => {
      unlockBodyScroll();
    };
  }, [isMounted]);

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      onClose();
    };

    window.addEventListener("keydown", handleWindowKeyDown);

    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, [isMounted, onClose]);

  const handlePanelTransitionEnd = (event: ReactTransitionEvent<HTMLDivElement>) => {
    if (event.target !== panelRef.current || isOpen) {
      return;
    }

    setIsMounted(false);
  };

  if (!isMounted || typeof document === "undefined") {
    return null;
  }

  const overlayClassName = [
    "liquid-overlay absolute inset-0 transition-opacity duration-200 ease-out",
    isVisible ? "opacity-100" : "opacity-0",
  ].join(" ");

  const panelClassName = [
    `liquid-surface liquid-modal-surface relative w-full ${sizeClasses[maxWidth]} overflow-hidden rounded-3xl shadow-2xl`,
    "transition-all duration-200 ease-out",
    isVisible ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-95 opacity-0",
  ].join(" ");

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6">
      <div className={overlayClassName} onClick={onClose} aria-hidden="true" />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title ? undefined : "Modal"}
        aria-labelledby={title ? titleId : undefined}
        className={panelClassName}
        onTransitionEnd={handlePanelTransitionEnd}
      >
        {title ? (
          <div className="liquid-divider flex items-center justify-between border-b px-5 py-4">
            <h3 id={titleId} className="text-lg font-semibold text-foreground">
              {title}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="liquid-pill liquid-subtle-text rounded-full p-2"
              aria-label="Close modal"
            >
              <LuX className="h-4 w-4 text-foreground" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="liquid-pill liquid-subtle-text absolute right-4 top-4 z-10 rounded-full p-2"
            aria-label="Close modal"
          >
            <LuX className="h-4 w-4" />
          </button>
        )}

        {children}
      </div>
    </div>,
    document.body,
  );
}
