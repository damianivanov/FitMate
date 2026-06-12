import { PageBody, PageHeader } from "@/shared/components";
import { EntityGrid } from "@/shared/components/tables";
import { MuscleGroupEditorModal } from "./components/MuscleGroupEditorModal";
import { useMuscleGroupGridPage } from "./hooks/useMuscleGroupGridPage";

export default function MuscleGroupGrid() {
  const { state, actions } = useMuscleGroupGridPage();

  return (
    <>
      <PageHeader title="Muscle Group Grid" subtitle="Global muscle group management for admin users." />

      <PageBody>
        <section className="liquid-surface w-full rounded-3xl p-5 md:p-6">
          <div className="mb-4">
            <input
              value={state.searchInput}
              onChange={actions.onSearchInputChange}
              placeholder="Search by name"
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

      <MuscleGroupEditorModal
        isOpen={state.isEditorOpen}
        isSaving={state.isSaving}
        isEditing={state.isEditing}
        values={state.formValues}
        imageLookupOptions={state.imageLookupOptions}
        error={state.editorError}
        onClose={actions.closeEditor}
        onSubmit={actions.save}
      />
    </>
  );
}
