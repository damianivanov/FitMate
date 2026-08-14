import { useCallback } from "react";
import { useNavigate } from "react-router";
import { LuX } from "react-icons/lu";
import { BackHeader } from "@/shared/components";

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
    <BackHeader
      title="Template builder"
      onBack={handleBackClick}
      action={
        <div className="bd-header-actions">
          <button
            type="button"
            onClick={onDiscardClick}
            className="bd-discard"
            aria-label="Discard changes"
          >
            <LuX className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onSaveTemplateClick}
            disabled={saveDisabled}
            className="native-header-save"
          >
            {isSavingTemplate ? "Saving..." : saveTemplateLabel}
          </button>
        </div>
      }
    />
  );
}
