import { PageBody, PageHeader } from "@/shared/components";
import { EntityGrid } from "@/shared/components/tables";
import { UserEditorModal } from "./components/UserEditorModal";
import { useUserGridPage } from "./hooks/useUserGridPage";

export default function UserGrid() {
  const { state, actions } = useUserGridPage();

  return (
    <>
      <PageHeader title="User Grid" subtitle="Global user management for admin users." />

      <PageBody>
        <section className="liquid-surface w-full rounded-3xl p-5 md:p-6">
          <div className="mb-4">
            <input
              value={state.searchInput}
              onChange={actions.onSearchInputChange}
              placeholder="Search by email or name"
              className="liquid-input w-full max-w-md rounded-full px-3 py-2.5"
            />
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

      <UserEditorModal
        key={state.editingUser?.id ?? "none"}
        isOpen={state.isEditorOpen}
        isSaving={state.isSaving}
        user={state.editingUser}
        values={state.formValues}
        isSelf={state.isSelfEditing}
        error={state.editorError}
        onClose={actions.closeEditor}
        onSubmit={actions.save}
      />
    </>
  );
}
