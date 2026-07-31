import { PageBody, PageHeader } from "@/shared/components";
import { EntityGrid } from "@/shared/components/tables";
import { ConversationDetailModal } from "./components/ConversationDetailModal";
import { useAIConversationGridPage } from "./hooks/useAIConversationGridPage";

export default function AIConversationGrid() {
  const { state, actions } = useAIConversationGridPage();

  return (
    <>
      <PageHeader
        title="AI Conversations"
        subtitle="Metadata only. Message bodies are read on demand and respect each user's privacy choice."
      />

      <PageBody>
        <section className="liquid-surface w-full rounded-3xl p-5 md:p-6">
          <div className="mb-4">
            <input
              value={state.searchInput}
              onChange={actions.onSearchInputChange}
              placeholder="Search title or user email"
              className="liquid-input w-full max-w-md rounded-full px-3 py-2.5"
            />
          </div>

          {state.error ? <p className="mb-4 text-sm text-danger">{state.error}</p> : null}

          <EntityGrid
            rows={state.rows}
            columns={state.columns}
            loading={state.loading}
            rowCount={state.rowCount}
            paginationModel={state.paginationModel}
            onPaginationModelChange={actions.changePagination}
            getRowId={(row) => row.id}
          />
        </section>
      </PageBody>

      <ConversationDetailModal
        conversation={state.detail}
        isLoading={state.isDetailLoading}
        onClose={actions.closeDetail}
      />
    </>
  );
}
