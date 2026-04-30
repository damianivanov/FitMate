import { LuArrowLeft, LuPencil, LuPlay, LuRefreshCw } from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import { TemplatePreviewPanel } from "./Templates/components/TemplatePreviewPanel";
import { useTemplatePreviewPage } from "./Templates/hooks/useTemplatePreviewPage";

export default function TemplatePreview() {
  const navigate = useNavigate();
  const {
    template,
    isLoadingTemplate,
    templateError,
    handleReloadTemplate,
  } = useTemplatePreviewPage();

  const handleBackClick = () => {
    navigate("/templates");
  };

  const handleEditTemplateClick = () => {
    if (!template) {
      return;
    }

    navigate(`/templates/${template.id}`);
  };

  const handleStartTemplateClick = () => {
    if (!template) {
      return;
    }

    console.log("Start workout from template", template);
  };

  return (
    <>
      <header className="liquid-page-header flex items-center gap-3 px-4 py-3 md:px-8">
        <button
          type="button"
          onClick={handleBackClick}
          className="liquid-pill inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full"
          aria-label="Back to templates"
        >
          <LuArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <h1 className="min-w-0 flex-1 truncate text-lg font-extrabold tracking-tight text-foreground">
            {template?.name ?? "Template"}
          </h1>
          <button
            type="button"
            onClick={handleEditTemplateClick}
            disabled={!template || isLoadingTemplate || Boolean(templateError)}
            className="liquid-pill inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Edit template"
          >
            <LuPencil className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={handleStartTemplateClick}
          disabled={!template || isLoadingTemplate || Boolean(templateError)}
          className="liquid-primary-btn inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LuPlay className="h-4 w-4" />
          <span>Start</span>
        </button>
      </header>

      <div className="liquid-scrollbar flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-7">
        <div className="mx-auto max-w-3xl">
          {isLoadingTemplate ? (
            <div className="liquid-panel rounded-2xl px-5 py-8 text-center">
              <p className="text-sm font-semibold text-foreground">Loading template...</p>
            </div>
          ) : null}

          {!isLoadingTemplate && templateError ? (
            <div className="liquid-panel rounded-2xl px-5 py-8 text-center">
              <p className="text-sm font-semibold text-danger">{templateError}</p>
              <button
                type="button"
                onClick={handleReloadTemplate}
                className="liquid-pill mt-4 inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold"
              >
                <LuRefreshCw className="h-4 w-4" />
                <span>Retry</span>
              </button>
            </div>
          ) : null}

          {!isLoadingTemplate && !templateError ? (
            <TemplatePreviewPanel template={template} />
          ) : null}
        </div>
      </div>
    </>
  );
}
