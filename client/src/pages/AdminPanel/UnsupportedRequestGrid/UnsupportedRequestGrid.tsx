import { PageBody, PageHeader } from "@/shared/components";
import { EntityGrid } from "@/shared/components/tables";
import { UnsupportedRequestStatus } from "@/types";
import { STATUS_LABELS } from "./columns";
import { TriageModal } from "./components/TriageModal";
import { useUnsupportedRequestGridPage } from "./hooks/useUnsupportedRequestGridPage";

const STATUS_OPTIONS = [
  UnsupportedRequestStatus.New,
  UnsupportedRequestStatus.Reviewed,
  UnsupportedRequestStatus.Planned,
  UnsupportedRequestStatus.Implemented,
  UnsupportedRequestStatus.Rejected,
] as const;

export default function UnsupportedRequestGrid() {
  const { state, actions } = useUnsupportedRequestGridPage();

  return (
    <>
      <PageHeader
        title="Unsupported Requests"
        subtitle="What users asked the coach for that FitMate cannot do, grouped by demand."
      />

      <PageBody>
        <section className="liquid-surface w-full rounded-3xl p-5 md:p-6">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
            <input
              value={state.searchInput}
              onChange={actions.onSearchInputChange}
              placeholder="Search requested functionality"
              className="liquid-input w-full max-w-md rounded-full px-3 py-2.5"
            />

            <select
              value={state.category}
              onChange={(event) => actions.changeCategory(event.target.value)}
              className="liquid-input rounded-full px-3 py-2.5"
            >
              <option value="">All categories</option>
              {state.categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>

            <select
              value={state.status}
              onChange={(event) =>
                actions.changeStatus(
                  event.target.value === ""
                    ? ""
                    : (Number(event.target.value) as UnsupportedRequestStatus),
                )
              }
              className="liquid-input rounded-full px-3 py-2.5"
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {STATUS_LABELS[option]}
                </option>
              ))}
            </select>
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

      <TriageModal
        request={state.triageTarget}
        isSaving={state.isSaving}
        onSave={actions.save}
        onClose={actions.closeTriage}
      />
    </>
  );
}
