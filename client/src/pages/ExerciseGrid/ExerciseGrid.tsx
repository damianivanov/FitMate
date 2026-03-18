import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEventHandler } from "react";
import type { GridPaginationModel } from "@mui/x-data-grid";
import { useSearchParams } from "react-router-dom";
import { EntityGrid } from "@/shared/components/tables";
import { invalidateExerciseLookupCache } from "@/hooks/useExerciseLookup";
import { exerciseService } from "@/services/exerciseService";
import type { Exercise, CreateExerciseRequest } from "@/types";
import { useMuscleGroups } from "@/hooks/useMuscleGroups";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { createExerciseGridColumns } from "./columns";
import { ExerciseEditorModal, type ExerciseFormValues } from "./components/ExerciseEditorModal";

const emptyFormValues: ExerciseFormValues = {
  name: "",
  slug: "",
  description: "",
  primaryMuscleGroupId: "",
  secondaryMuscleGroupId: "",
};

function toFormValues(item: Exercise): ExerciseFormValues {
  return {
    name: item.name,
    slug: item.slug,
    description: item.description ?? "",
    primaryMuscleGroupId: String(item.primaryMuscleGroupId),
    secondaryMuscleGroupId: item.secondaryMuscleGroupId ? String(item.secondaryMuscleGroupId) : "",
  };
}

function toRequest(values: ExerciseFormValues): CreateExerciseRequest {
  return {
    name: values.name.trim(),
    slug: values.slug.trim(),
    description: values.description.trim() || undefined,
    primaryMuscleGroupId: Number(values.primaryMuscleGroupId),
    secondaryMuscleGroupId: values.secondaryMuscleGroupId
      ? Number(values.secondaryMuscleGroupId)
      : undefined,
  };
}

export default function ExerciseGrid() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<Exercise[]>([]);
  const { muscleGroups, error: muscleGroupsError } = useMuscleGroups();
  const [rowCount, setRowCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput.trim());
  const [isSaving, setIsSaving] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formValues, setFormValues] = useState<ExerciseFormValues>(emptyFormValues);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 100,
  });

  const loadRows = useCallback(async () => {
    setLoading(true);
    setPageError(null);

    try {
      const response = await exerciseService.list({
        page: paginationModel.page + 1,
        pageSize: paginationModel.pageSize,
        search: debouncedSearch || undefined,
        isGlobal: true,
      });

      const result = response.data;
      if (!result.success || !result.data) {
        setRows([]);
        setRowCount(0);
        setPageError(result.error ?? "Unable to load exercises.");
        return;
      }

      setRows(result.data.items ?? []);
      setRowCount(result.data.totalCount ?? 0);
    } catch {
      setRows([]);
      setRowCount(0);
      setPageError("Unable to load exercises.");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, paginationModel.page, paginationModel.pageSize]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    setPaginationModel((current) => (current.page === 0 ? current : { ...current, page: 0 }));
  }, [debouncedSearch]);

  const openCreateEditor = useCallback(() => {
    setEditingId(null);
    setFormValues(emptyFormValues);
    setEditorError(null);
    setIsEditorOpen(true);
  }, []);

  useEffect(() => {
    if (searchParams.get("mode") !== "create") {
      return;
    }

    openCreateEditor();

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete("mode");
    setSearchParams(nextSearchParams, { replace: true });
  }, [openCreateEditor, searchParams, setSearchParams]);

  const openEditEditor = useCallback((exercise: Exercise) => {
    setEditingId(exercise.id);
    setFormValues(toFormValues(exercise));
    setEditorError(null);
    setIsEditorOpen(true);
  }, []);

  const closeEditor = useCallback(() => {
    setIsEditorOpen(false);
    setEditingId(null);
    setFormValues(emptyFormValues);
    setEditorError(null);
  }, []);

  const muscleGroupLookup = useMemo(
    () => new Map(muscleGroups.map((group) => [group.id, group.name])),
    [muscleGroups],
  );

  const resolveMuscleGroupName = useCallback(
    (id?: number) => {
      if (!id) {
        return "None";
      }

      return muscleGroupLookup.get(id) ?? `#${id}`;
    },
    [muscleGroupLookup],
  );

  const onDelete = useCallback(
    async (exercise: Exercise) => {
      const confirmed = window.confirm(`Delete exercise "${exercise.name}"?`);
      if (!confirmed) {
        return;
      }

      try {
        const response = await exerciseService.remove(exercise.id);
        if (!response.data.success) {
          setPageError(response.data.error ?? "Delete failed.");
          return;
        }

        invalidateExerciseLookupCache();
        await loadRows();
      } catch {
        setPageError("Delete failed.");
      }
    },
    [loadRows],
  );

  const columns = useMemo(
    () =>
      createExerciseGridColumns({
        resolveMuscleGroupName,
        onEdit: openEditEditor,
        onDelete,
      }),
    [onDelete, openEditEditor, resolveMuscleGroupName],
  );

  const onSearchInputChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    setSearchInput(event.target.value);
  };

  const onSave = async (values: ExerciseFormValues) => {
    const payload = toRequest(values);
    if (!payload.name || !payload.slug || !payload.primaryMuscleGroupId) {
      setEditorError("Name, slug and primary muscle group id are required.");
      return;
    }

    setIsSaving(true);
    setEditorError(null);

    try {
      const response = editingId
        ? await exerciseService.update(editingId, payload)
        : await exerciseService.create(payload);

      if (!response.data.success) {
        setEditorError(response.data.error ?? "Save failed.");
        return;
      }

      invalidateExerciseLookupCache();
      closeEditor();
      await loadRows();
    } catch {
      setEditorError("Save failed.");
    } finally {
      setIsSaving(false);
    }
  };

  const visiblePageError = pageError ?? muscleGroupsError;

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
              value={searchInput}
              onChange={onSearchInputChange}
              placeholder="Search by name or slug"
              className="liquid-input w-full max-w-md rounded-full px-3 py-2.5"
            />

            <button
              type="button"
              className="liquid-pill rounded-full px-4 py-2.5 text-sm font-semibold"
              onClick={openCreateEditor}
            >
              New Exercise
            </button>
          </div>

          {visiblePageError && <p className="mb-4 text-sm text-danger">{visiblePageError}</p>}

          <EntityGrid
            rows={rows}
            columns={columns}
            loading={loading}
            rowCount={rowCount}
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            getRowId={(row) => row.id}
          />
        </section>
      </div>

      <ExerciseEditorModal
        isOpen={isEditorOpen}
        isSaving={isSaving}
        isEditing={editingId !== null}
        values={formValues}
        muscleGroups={muscleGroups}
        error={editorError}
        onClose={closeEditor}
        onSubmit={onSave}
      />
    </div>
  );
}

