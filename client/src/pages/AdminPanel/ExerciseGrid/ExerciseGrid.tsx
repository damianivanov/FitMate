import { EntityGrid } from "@/shared/components/tables";
import { ExerciseEditorModal } from "./components/ExerciseEditorModal";
import { useExerciseGridPage } from "./hooks/useExerciseGridPage";

export default function ExerciseGrid() {
  const { state, actions } = useExerciseGridPage();

  return (
    <div className="w-full flex-1 px-5 py-8">
      <div className="mx-auto w-full max-w-[79dvw] space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-extrabold text-primary">Exercise Grid</h1>
          <p className="text-sm text-secondary">Global exercise CRUD for management users.</p>
        </header>

        <section className="liquid-surface rounded-3xl p-5 md:p-6">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <input
              value={state.searchInput}
              onChange={actions.onSearchInputChange}
              placeholder="Search by name or slug"
              className="liquid-input w-full max-w-md rounded-full px-3 py-2.5"
            />

            <button
              type="button"
              className="liquid-pill rounded-full px-4 py-2.5 text-sm font-semibold"
              onClick={actions.openCreateEditor}
            >
              New Exercise
            </button>
          </div>

          {state.pageError && <p className="mb-4 text-sm text-danger">{state.pageError}</p>}

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
      </div>

      <ExerciseEditorModal
        isOpen={state.isEditorOpen}
        isSaving={state.isSaving}
        isEditing={state.isEditing}
        values={state.formValues}
        muscleGroups={state.muscleGroups}
        error={state.editorError}
        onClose={actions.closeEditor}
        onSubmit={actions.save}
      />
    </div>
  );
}
