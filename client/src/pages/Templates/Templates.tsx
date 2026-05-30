import { LuPlus } from "react-icons/lu";
import { AsyncSection, PageBody, PageHeader } from "@/shared/components";
import { TemplateListItem } from "./components/TemplateListItem";
import { TemplatePreviewPanel } from "./components/TemplatePreviewPanel";
import { useTemplatesPage } from "./hooks/useTemplatesPage";

export default function Templates() {
  const { state, actions } = useTemplatesPage();

  return (
    <>
      <PageHeader
        title="Templates"
        subtitle={`${state.templates.length} saved template${state.templates.length === 1 ? "" : "s"}`}
        actions={
          <button
            type="button"
            onClick={actions.create}
            className="liquid-primary-btn inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold"
          >
            <LuPlus className="h-4 w-4" />
            <span>New</span>
          </button>
        }
      />

      <PageBody>
        <AsyncSection
          isLoading={state.isLoading}
          error={state.error}
          onRetry={actions.reload}
          loadingLabel="Loading templates..."
          isEmpty={state.templates.length === 0}
          emptyState={
            <div className="liquid-panel rounded-2xl px-5 py-10 text-center">
              <p className="italic text-gray-100/70">No templates yet</p>
              <button
                type="button"
                onClick={actions.create}
                className="liquid-primary-btn mt-5 inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold"
              >
                <LuPlus className="h-4 w-4" />
                <span>Create Template</span>
              </button>
            </div>
          }
        >
          <div className="grid items-start gap-5 lg:grid-cols-2">
            <section className="space-y-3">
              {state.templates.map((template) => (
                <TemplateListItem
                  key={template.id}
                  template={template}
                  isSelected={state.selectedTemplate?.id === template.id}
                  onSelect={actions.select}
                />
              ))}
            </section>
            <div className="hidden md:block">
              <TemplatePreviewPanel template={state.selectedTemplate} />
            </div>
          </div>
        </AsyncSection>
      </PageBody>
    </>
  );
}
