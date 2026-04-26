import { LuArrowLeft } from "react-icons/lu";
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { WorkoutTemplateModel } from "@/types";

type TemplateBuilderHeaderProps = {
  onDiscardClick: () => void;
  onSaveTemplateClick: () => void;
  isSavingTemplate: boolean;
  lastSavedTemplate: WorkoutTemplateModel | null;
};

export function TemplateBuilderHeader({
  onDiscardClick,
  onSaveTemplateClick,
  isSavingTemplate,
  lastSavedTemplate,
}: TemplateBuilderHeaderProps) {
  const navigate = useNavigate();
  const handleBackClick = useCallback(() => {
    navigate("/templates");
  }, [navigate]);

  return (
    <header className="liquid-page-header px-4 py-3 md:px-8 md:py-5">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleBackClick}
          className="liquid-pill flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-medium text-primary-700 transition md:h-10 md:gap-2 md:px-4"
        >
          <LuArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </button>
        <p className="hidden flex-1 text-lg text-white md:block">
          Build reusable templates with grouped exercises and polished set cards.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDiscardClick}
            className="liquid-pill h-9 cursor-pointer rounded-full px-3 text-xs font-semibold text-primary-700 transition md:h-10 md:px-4 md:text-sm"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={onSaveTemplateClick}
            disabled={isSavingTemplate}
            className="liquid-primary-btn h-9 cursor-pointer rounded-full px-4 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 md:h-10 md:px-5 md:text-sm"
          >
            {isSavingTemplate ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
      {lastSavedTemplate ? <p className="mt-1 text-xs text-primary-700">Created template id: {lastSavedTemplate.id}</p> : null}
    </header>
  );
}
