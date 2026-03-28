import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEventHandler } from "react";
import type { GridPaginationModel } from "@mui/x-data-grid";
import { useSearchParams } from "react-router-dom";
import { invalidateMuscleGroupsCache, useMuscleGroups } from "@/hooks/useMuscleGroups";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { muscleGroupService } from "@/services/muscleGroupService";
import { EntityGrid } from "@/shared/components/tables";
import type { CreateMuscleGroupRequest, MuscleGroup } from "@/types";
import { createMuscleGroupGridColumns } from "./columns";
import { MuscleGroupEditorModal, type MuscleGroupFormValues } from "./components/MuscleGroupEditorModal";

const emptyFormValues: MuscleGroupFormValues = {
  name: "",
  imageUrl: "",
};

function toFormValues(item: MuscleGroup): MuscleGroupFormValues {
  return {
    name: item.name,
    imageUrl: item.imageUrl ?? "",
  };
}

function toRequest(values: MuscleGroupFormValues): CreateMuscleGroupRequest {
  return {
    name: values.name.trim(),
    imageUrl: values.imageUrl.trim() || undefined,
  };
}

export default function MuscleGroupGrid() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<MuscleGroup[]>([]);
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
  const [formValues, setFormValues] = useState<MuscleGroupFormValues>(emptyFormValues);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 100,
  });

  const loadRows = useCallback(async () => {
    setLoading(true);
    setPageError(null);

    try {
      const response = await muscleGroupService.list({
        page: paginationModel.page + 1,
        pageSize: paginationModel.pageSize,
        search: debouncedSearch || undefined,
      });

      const result = response.data;
      if (!result.success || !result.data) {
        setRows([]);
        setRowCount(0);
        setPageError(result.error ?? "Unable to load muscle groups.");
        return;
      }

      setRows(result.data.items ?? []);
      setRowCount(result.data.totalCount ?? 0);
    } catch {
      setRows([]);
      setRowCount(0);
      setPageError("Unable to load muscle groups.");
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

  const openEditEditor = useCallback((muscleGroup: MuscleGroup) => {
    setEditingId(muscleGroup.id);
    setFormValues(toFormValues(muscleGroup));
    setEditorError(null);
    setIsEditorOpen(true);
  }, []);

  const closeEditor = useCallback(() => {
    setIsEditorOpen(false);
    setEditingId(null);
    setFormValues(emptyFormValues);
    setEditorError(null);
  }, []);

  const imageLookupOptions = useMemo(() => {
    const options = new Map<string, string>();

    for (const muscleGroup of muscleGroups) {
      const imageUrl = muscleGroup.imageUrl?.trim();
      if (!imageUrl || options.has(imageUrl)) {
        continue;
      }

      options.set(imageUrl, muscleGroup.name);
    }

    return Array.from(options.entries()).map(([value, label]) => ({ value, label, imageUrl: value }));
  }, [muscleGroups]);

  const onDelete = useCallback(
    async (muscleGroup: MuscleGroup) => {
      const confirmed = window.confirm(`Delete muscle group "${muscleGroup.name}"?`);
      if (!confirmed) {
        return;
      }

      try {
        const response = await muscleGroupService.remove(muscleGroup.id);
        if (!response.data.success) {
          setPageError(response.data.error ?? "Delete failed.");
          return;
        }

        invalidateMuscleGroupsCache();
        await loadRows();
      } catch {
        setPageError("Delete failed.");
      }
    },
    [loadRows],
  );

  const columns = useMemo(
    () =>
      createMuscleGroupGridColumns({
        onEdit: openEditEditor,
        onDelete,
      }),
    [onDelete, openEditEditor],
  );

  const onSearchInputChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    setSearchInput(event.target.value);
  };

  const onSave = async (values: MuscleGroupFormValues) => {
    const payload = toRequest(values);
    if (!payload.name) {
      setEditorError("Name is required.");
      return;
    }

    setIsSaving(true);
    setEditorError(null);

    try {
      const response = editingId
        ? await muscleGroupService.update(editingId, payload)
        : await muscleGroupService.create(payload);

      if (!response.data.success) {
        setEditorError(response.data.error ?? "Save failed.");
        return;
      }

      invalidateMuscleGroupsCache();
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
          <h1 className="text-3xl font-extrabold text-primary">Muscle Group Grid</h1>
          <p className="text-sm text-secondary">Global muscle group management for admin users.</p>
        </header>

        <section className="liquid-surface rounded-3xl p-5 md:p-6">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <input
              value={searchInput}
              onChange={onSearchInputChange}
              placeholder="Search by name"
              className="liquid-input w-full max-w-md rounded-full px-3 py-2.5"
            />

            <button
              type="button"
              className="liquid-pill rounded-full px-4 py-2.5 text-sm font-semibold"
              onClick={openCreateEditor}
            >
              New Muscle Group
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

      <MuscleGroupEditorModal
        isOpen={isEditorOpen}
        isSaving={isSaving}
        isEditing={editingId !== null}
        values={formValues}
        imageLookupOptions={imageLookupOptions}
        error={editorError}
        onClose={closeEditor}
        onSubmit={onSave}
      />
    </div>
  );
}

