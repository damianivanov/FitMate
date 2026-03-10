import { useEffect, useState, type ReactNode } from "react";
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

  const handleClose = () => {
    setIsClosing(true);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ${
        isClosing ? "opacity-0" : "opacity-100"
      }`}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label={title ?? "Modal"}
    >
      <div className="absolute inset-0 bg-slate-900/28 backdrop-blur-sm" />

      <div
        className={`liquid-surface relative w-full ${sizeClasses[maxWidth]} overflow-hidden rounded-3xl transition-transform duration-200 ${
          isClosing ? "scale-95" : "scale-100"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-white/40 px-5 py-4">
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            <button
              type="button"
              onClick={handleClose}
              className="liquid-pill rounded-full p-2 text-slate-700"
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
            className="liquid-pill absolute right-4 top-4 z-10 rounded-full p-2 text-slate-700"
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
