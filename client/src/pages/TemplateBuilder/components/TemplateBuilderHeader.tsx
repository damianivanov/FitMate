import { LuArrowLeft, LuX } from "react-icons/lu";
import { useCallback } from "react";
import { useNavigate } from "react-router";

type TemplateBuilderHeaderProps = {
  onDiscardClick: () => void;
  onSaveTemplateClick: () => void;
  isSavingTemplate: boolean;
  isSaveTemplateDisabled?: boolean;
  saveTemplateLabel?: string;
};

export function TemplateBuilderHeader({
  onDiscardClick,
  onSaveTemplateClick,
  isSavingTemplate,
  isSaveTemplateDisabled = false,
  saveTemplateLabel = "Save",
}: TemplateBuilderHeaderProps) {
  const navigate = useNavigate();
  const saveDisabled = isSavingTemplate || isSaveTemplateDisabled;
  const handleBackClick = useCallback(() => {
    navigate("/templates");
  }, [navigate]);

  return (
    <header className="liquid-page-header px-4 py-2 md:px-8 md:py-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleBackClick}
          className="liquid-pill flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-primary-700 transition"
          aria-label="Back to templates"
        >
          <LuArrowLeft className="h-4 w-4" />
        </button>

        <h1 className="min-w-0 flex-1 truncate text-xl font-extrabold tracking-tight text-foreground">
          New Template
        </h1>

        <button
          type="button"
          onClick={onDiscardClick}
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-(--color-danger-border) bg-(--color-danger-soft) text-danger transition hover:bg-(--color-danger-glow) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
          aria-label="Discard changes"
        >
          <LuX className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onSaveTemplateClick}
          disabled={saveDisabled}
          className="liquid-primary-btn flex h-10 shrink-0 cursor-pointer items-center rounded-full px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSavingTemplate ? "Saving..." : saveTemplateLabel}
        </button>
      </div>
    </header>
  );
}
