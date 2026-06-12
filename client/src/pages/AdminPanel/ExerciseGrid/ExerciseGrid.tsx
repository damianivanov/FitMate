import { LuArrowLeft, LuPlus } from "react-icons/lu";
import { Link } from "react-router";
import { AddExerciseModal, ExerciseImageModal, PageBody } from "@/shared/components";
import { EntityGrid } from "@/shared/components/tables";
import { useExerciseGridPage } from "./hooks/useExerciseGridPage";

export default function ExerciseGrid() {
  const { state, actions } = useExerciseGridPage();

  return (
    <>
      <PageBody>
        <div className="mb-4">
          <Link
            to="/management"
            className="liquid-pill inline-flex h-9 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold text-primary"
          >
            <LuArrowLeft className="h-4 w-4" />
            <span>Back to dashboard</span>
          </Link>
        </div>

        <section className="liquid-surface w-full rounded-3xl p-5 md:p-6">
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={actions.openCreateEditor}
              className="liquid-primary-btn inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold"
            >
              <LuPlus className="h-4 w-4" />
              <span>New Exercise</span>
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
            columnHeaderHeight={64}
          />
        </section>
      </PageBody>

      <AddExerciseModal
        key={String(state.isEditorOpen)}
        isOpen={state.isEditorOpen}
        isSaving={state.isSaving}
        mode={state.isEditing ? "edit" : "create"}
        values={state.formValues}
        muscleGroups={state.muscleGroups}
        error={state.editorError}
        onClose={actions.closeEditor}
        onSubmit={actions.save}
      />

      <ExerciseImageModal
        isOpen={state.imageTarget !== null}
        exerciseId={state.imageTarget?.id ?? null}
        exerciseName={state.imageTarget?.name}
        currentImageUrl={state.imageTarget?.imageUrl}
        onClose={actions.closeImageModal}
        onUploaded={actions.onImageUploaded}
      />
    </>
  );
}
