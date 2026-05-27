import { LuArrowLeft } from "react-icons/lu";
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

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
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleBackClick}
          className="liquid-pill flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-primary-700 transition md:h-9 md:w-9"
          aria-label="Back to templates"
        >
          <LuArrowLeft className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-center text-2xl font-extrabold tracking-tight text-foreground md:text-xl">
            New Template
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDiscardClick}
            className="liquid-pill h-9 cursor-pointer rounded-full px-4 text-sm font-semibold text-primary-700 transition"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={onSaveTemplateClick}
            disabled={saveDisabled}
            className="liquid-primary-btn h-10 cursor-pointer rounded-full px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSavingTemplate ? "Saving..." : saveTemplateLabel}
          </button>
        </div>
      </div>
    </header>
  );
}
