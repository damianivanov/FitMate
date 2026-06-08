import { LuImage, LuPencil, LuPlus, LuSearch, LuTrash2 } from "react-icons/lu";
import {
  ActionMenu,
  AddExerciseModal,
  AsyncSection,
  DeleteConfirmationModal,
  ExerciseImageModal,
  MuscleGroupDropdown,
  type ActionMenuItem,
} from "@/shared/components";
import { useMyExercisesPage } from "./hooks/useMyExercisesPage";

export default function MyExercises() {
  const { state, actions } = useMyExercisesPage();

  const emptyState = (
    <div className="liquid-panel rounded-2xl px-5 py-10 text-center">
      <p className="text-sm font-semibold text-foreground">
        {state.totalCount === 0 ? "You haven't added any exercises yet." : "No exercises match your filters."}
      </p>
      {state.totalCount === 0 ? (
        <button
          type="button"
          onClick={actions.openCreate}
          className="liquid-primary-btn mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold"
        >
          <LuPlus className="h-4 w-4" />
          <span>Add exercise</span>
        </button>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="liquid-input flex w-full flex-1 items-center gap-2 rounded-full px-4 py-2.5">
          <LuSearch className="h-4 w-4 shrink-0 text-primary" />
          <input
            value={state.searchInput}
            onChange={(event) => actions.onSearchChange(event.target.value)}
            placeholder="Search your exercises..."
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>

        <div className="w-full sm:w-56">
          <MuscleGroupDropdown
            id="my-exercises-muscle-filter"
            value={state.muscleFilterId}
            onChange={(value) => actions.onMuscleFilterChange(value ?? "")}
            muscleGroups={state.muscleGroups}
            leadingOptions={[{ value: "", label: "All muscles" }]}
            placeholder="All muscles"
          />
        </div>

        <button
          type="button"
          onClick={actions.openCreate}
          className="liquid-primary-btn inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold"
        >
          <LuPlus className="h-4 w-4" />
          <span>Add exercise</span>
        </button>
      </div>

      <AsyncSection
        isLoading={state.isLoading}
        error={state.error}
        onRetry={actions.reload}
        isEmpty={state.exercises.length === 0}
        emptyState={emptyState}
        loadingLabel="Loading your exercises..."
      >
        <div className="grid gap-3">
          {state.exercises.map((exercise) => {
            const menuItems: ActionMenuItem[] = [
              {
                key: "edit",
                label: "Edit",
                icon: <LuPencil className="h-4 w-4" />,
                variant: "primary",
                onSelect: () => actions.openEdit(exercise),
              },
              {
                key: "image",
                label: "Change photo",
                icon: <LuImage className="h-4 w-4" />,
                onSelect: () => actions.openImageModal(exercise),
              },
              {
                key: "delete",
                label: "Delete",
                icon: <LuTrash2 className="h-4 w-4" />,
                variant: "danger",
                onSelect: () => actions.requestDelete(exercise),
              },
            ];

            const muscleLabel = exercise.secondaryMuscleGroupName
              ? `${exercise.primaryMuscleGroupName} · ${exercise.secondaryMuscleGroupName}`
              : exercise.primaryMuscleGroupName;

            return (
              <article key={exercise.id} className="liquid-panel flex items-center gap-3 rounded-2xl p-3">
                {exercise.imageUrl ? (
                  <img
                    src={exercise.imageUrl}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-xl object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-200 text-sm font-bold text-primary">
                    {exercise.name.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{exercise.name}</p>
                    <span
                      className={[
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        exercise.isPublic
                          ? "bg-emerald-400/15 text-emerald-300"
                          : "bg-white/8 text-secondary",
                      ].join(" ")}
                    >
                      {exercise.isPublic ? "Public" : "Private"}
                    </span>
                  </div>
                  <p className="truncate text-xs text-secondary">{muscleLabel}</p>
                </div>

                <ActionMenu items={menuItems} triggerAriaLabel={`Actions for ${exercise.name}`} />
              </article>
            );
          })}
        </div>
      </AsyncSection>

      <AddExerciseModal
        key={state.isEditorOpen ? (state.isEditing ? "edit" : "create") : "closed"}
        isOpen={state.isEditorOpen}
        isSaving={state.isSaving}
        mode={state.isEditing ? "edit" : "create"}
        values={state.formValues}
        muscleGroups={state.muscleGroups}
        error={state.editorError}
        showVisibilityToggle
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

      <DeleteConfirmationModal
        isOpen={state.isDeleteOpen}
        itemName={state.pendingDeleteName}
        title="Delete exercise"
        isDeleting={state.isDeleting}
        onCancel={actions.cancelDelete}
        onConfirm={actions.confirmDelete}
      />
    </div>
  );
}
