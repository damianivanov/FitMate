import { useEffect, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { LuX } from "react-icons/lu";

type ModalSize = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "default";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxWidth?: ModalSize;
};

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

export function Modal({ isOpen, onClose, title, children, maxWidth = "default" }: ModalProps) {
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isClosing) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);

    return () => window.clearTimeout(timeoutId);
  }, [isClosing, onClose]);

  if (!isOpen && !isClosing) {
    return null;
  }

  const overlayBaseClassName =
    "fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200";
  const overlayStateClassName = isClosing ? "opacity-0" : "opacity-100";
  const overlayClassName = `${overlayBaseClassName} ${overlayStateClassName}`;
  const contentBaseClassName =
    `liquid-surface liquid-modal-surface relative w-full ${sizeClasses[maxWidth]} overflow-hidden rounded-3xl transition-transform duration-200`;
  const contentStateClassName = isClosing ? "scale-95" : "scale-100";
  const contentClassName = `${contentBaseClassName} ${contentStateClassName}`;

  const handleClose = () => {
    setIsClosing(true);
  };

  const handleModalContentClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  return (
    <div
      className={overlayClassName}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label={title ?? "Modal"}
    >
      <div className="liquid-overlay absolute inset-0" />

      <div className={contentClassName} onClick={handleModalContentClick}>
        {title && (
          <div className="liquid-divider flex items-center justify-between border-b px-5 py-4">
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            <button
              type="button"
              onClick={handleClose}
              className="liquid-pill liquid-subtle-text rounded-full p-2"
              aria-label="Close modal"
            >
              <LuX className="h-4 w-4" />
            </button>
          </div>
        )}

        {!title && (
          <button
            type="button"
            onClick={handleClose}
            className="liquid-pill liquid-subtle-text absolute right-4 top-4 z-10 rounded-full p-2"
            aria-label="Close modal"
          >
            <LuX className="h-4 w-4" />
          </button>
        )}

        {children}
      </div>
    </div>
  );
}
