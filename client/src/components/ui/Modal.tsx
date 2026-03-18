import { type ReactNode, useEffect, useRef } from "react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  footer?: ReactNode;
};

const sizeMap: Record<string, string> = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
};

export default function Modal({ open, onClose, title, size = "md", children, footer }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="liquid-overlay fixed inset-0 z-500 flex items-center justify-center animate-in fade-in duration-150"
      onMouseDown={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className={`liquid-surface liquid-modal-surface w-full ${sizeMap[size]} mx-4 flex max-h-[85vh] flex-col rounded-3xl animate-in slide-in-from-bottom-3 fade-in duration-200`}
      >
        {/* Header */}
        <div className="liquid-divider flex shrink-0 items-center justify-between border-b px-7 py-5">
          <h2 className="text-lg font-extrabold tracking-tight text-primary">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="liquid-pill liquid-subtle-text flex h-8 w-8 items-center justify-center rounded-lg transition hover:text-primary"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-7 py-6">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="liquid-divider flex shrink-0 justify-end gap-3 border-t px-7 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

