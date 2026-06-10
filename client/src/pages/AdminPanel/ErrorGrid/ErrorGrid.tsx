import { PageBody, PageHeader } from "@/shared/components";
import { EntityGrid } from "@/shared/components/tables";
import { ErrorDetailModal } from "./components/ErrorDetailModal";
import { useErrorGridPage } from "./hooks/useErrorGridPage";

export default function ErrorGrid() {
  const { state, actions } = useErrorGridPage();

  return (
    <>
      <PageHeader title="Error Grid" subtitle="Server-side errors captured from API requests." />

      <PageBody>
        <section className="liquid-surface mx-auto w-full max-w-[79dvw] rounded-3xl p-5 md:p-6">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <input
              value={state.searchInput}
              onChange={actions.onSearchInputChange}
              placeholder="Search message, request, or source"
              className="liquid-input w-full max-w-md rounded-full px-3 py-2.5"
            />

            <button
              type="button"
              disabled={!state.hasRows || state.isClearing}
              className="liquid-pill liquid-pill-danger rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
              onClick={actions.clearAll}
            >
              {state.isClearing ? "Clearing..." : "Clear all"}
            </button>
          </div>

          {state.error && <p className="mb-4 text-sm text-danger">{state.error}</p>}

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

      <ErrorDetailModal error={state.viewingError} onClose={actions.closeDetail} />
    </>
  );
}
