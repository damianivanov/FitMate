import { LuPlus, LuRefreshCw } from "react-icons/lu";
import { TemplateListItem } from "./Templates/components/TemplateListItem";
import { TemplatePreviewPanel } from "./Templates/components/TemplatePreviewPanel";
import { useTemplatesPage } from "./Templates/hooks/useTemplatesPage";

export default function Templates() {
  const {
    templates,
    selectedTemplate,
    isLoadingTemplates,
    templatesError,
    handleTemplateSelect,
    handleCreateTemplateClick,
    handleReloadTemplates,
  } = useTemplatesPage();

  return (
    <>
      <header className="liquid-page-header flex items-center justify-between px-6 py-5 md:px-8">
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Templates</h1>
          <p className="mt-1 text-sm text-secondary">
            {templates.length} saved template{templates.length === 1 ? "" : "s"}
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreateTemplateClick}
          className="liquid-primary-btn inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold"
        >
          <LuPlus className="h-4 w-4" />
          <span>New</span>
        </button>
      </header>

      <div className="liquid-scrollbar flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-7">
        {isLoadingTemplates ? (
          <div className="liquid-panel rounded-2xl px-5 py-8 text-center">
            <p className="text-sm font-semibold text-foreground">Loading templates...</p>
          </div>
        ) : null}

        {!isLoadingTemplates && templatesError ? (
          <div className="liquid-panel rounded-2xl px-5 py-8 text-center">
            <p className="text-sm font-semibold text-danger">{templatesError}</p>
            <button
              type="button"
              onClick={handleReloadTemplates}
              className="liquid-pill mt-4 inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold"
            >
              <LuRefreshCw className="h-4 w-4" />
              <span>Retry</span>
            </button>
          </div>
        ) : null}

        {!isLoadingTemplates && !templatesError ? (
          templates.length > 0 ? (
            <div className="grid items-start gap-5 lg:grid-cols-2">
              <section className="space-y-3">
                {templates.map((template) => (
                  <TemplateListItem
                    key={template.id}
                    template={template}
                    isSelected={selectedTemplate?.id === template.id}
                    onSelect={handleTemplateSelect}
                  />
                ))}
              </section>
              <div className="hidden md:block">
                <TemplatePreviewPanel template={selectedTemplate} />
              </div>
            </div>
          ) : (
            <div className="liquid-panel rounded-2xl px-5 py-10 text-center">
              <p className="text-base font-bold text-foreground">No templates yet</p>
              <button
                type="button"
                onClick={handleCreateTemplateClick}
                className="liquid-primary-btn mt-5 inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold"
              >
                <LuPlus className="h-4 w-4" />
                <span>Create Template</span>
              </button>
            </div>
          )
        ) : null}
      </div>
    </>
  );
}
