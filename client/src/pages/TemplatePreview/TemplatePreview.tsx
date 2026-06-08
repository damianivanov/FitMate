import { LuArrowLeft, LuLoaderCircle, LuPencil, LuPlay, LuTrash2 } from "react-icons/lu";
import { AsyncSection, DeleteConfirmationModal, PageBody } from "@/shared/components";
import { TemplatePreviewPanel } from "../Templates/components/TemplatePreviewPanel";
import { useTemplatePreviewPage } from "./hooks/useTemplatePreviewPage";

export default function TemplatePreview() {
  const { state, actions } = useTemplatePreviewPage();

  return (
    <>
      <header className="liquid-page-header flex items-center gap-3 px-4 py-3 md:px-8">
        <button
          type="button"
          onClick={actions.back}
          className="liquid-pill inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full"
          aria-label="Back to templates"
        >
          <LuArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <h1 className="min-w-0 flex-1 truncate text-lg font-extrabold tracking-tight text-foreground">
            {state.template?.name ?? "Template"}
          </h1>
          <button
            type="button"
            onClick={actions.edit}
            disabled={!state.isActionable}
            className="liquid-pill inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Edit template"
          >
            <LuPencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={actions.requestDelete}
            disabled={!state.isActionable || state.isDeleting}
            className="liquid-pill liquid-pill-danger inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Delete template"
          >
            {state.isDeleting ? (
              <LuLoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <LuTrash2 className="h-4 w-4" />
            )}
          </button>
        </div>
        <button
          type="button"
          onClick={actions.start}
          disabled={!state.isActionable || state.isStartingTemplate}
          className="liquid-primary-btn inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LuPlay className="h-4 w-4" />
          <span>{state.isStartingTemplate ? "Starting" : "Start"}</span>
        </button>
      </header>

      <PageBody>
        <div className="mx-auto max-w-3xl">
          <AsyncSection
            isLoading={state.isLoading}
            error={state.error}
            onRetry={actions.reload}
            loadingLabel="Loading template..."
          >
            <TemplatePreviewPanel template={state.template} />
          </AsyncSection>
        </div>
      </PageBody>

      <DeleteConfirmationModal
        isOpen={state.isDeleteConfirmationOpen}
        itemName={state.templateName}
        title="Delete template"
        isDeleting={state.isDeleting}
        onCancel={actions.cancelDelete}
        onConfirm={actions.confirmDelete}
      />
    </>
  );
}
