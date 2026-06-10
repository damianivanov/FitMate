import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEventHandler } from "react";
import type { GridColDef, GridPaginationModel } from "@mui/x-data-grid";
import { invalidateMuscleGroupsCache, useMuscleGroups } from "@/hooks/useMuscleGroups";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { unwrap } from "@/lib/unwrap";
import { adminService } from "@/services/adminService";
import type { CreateMuscleGroupRequest, MuscleGroup, PagedResponse } from "@/types";
import { createMuscleGroupGridColumns } from "../columns";
import type { MuscleGroupFormValues, MuscleGroupImageLookupOption } from "../components/MuscleGroupEditorModal";

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

export function useMuscleGroupGridPage() {
  const { muscleGroups, error: muscleGroupsError } = useMuscleGroups();
  const [actionError, setActionError] = useState<string | null>(null);
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

  const [pagedMuscleGroups, setPagedMuscleGroups] = useState<PagedResponse<MuscleGroup> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadIndex, setReloadIndex] = useState(0);

  useEffect(() => {
    async function loadRows() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await adminService.muscleGroups.list({
          page: paginationModel.page + 1,
          pageSize: paginationModel.pageSize,
          search: debouncedSearch || undefined,
        });
        setPagedMuscleGroups(unwrap(response.data, "Unable to load muscle groups."));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load muscle groups.");
        setPagedMuscleGroups(null);
      } finally {
        setIsLoading(false);
      }
    }

    void loadRows();
  }, [debouncedSearch, paginationModel.page, paginationModel.pageSize, reloadIndex]);

  useEffect(() => {
    setPaginationModel((current) => (current.page === 0 ? current : { ...current, page: 0 }));
  }, [debouncedSearch]);

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

  const imageLookupOptions = useMemo<MuscleGroupImageLookupOption[]>(() => {
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

      setActionError(null);

      try {
        const response = await adminService.muscleGroups.remove(muscleGroup.id);
        unwrap(response.data, "Delete failed.");

        invalidateMuscleGroupsCache();
        setActionError(null);
        setReloadIndex((index) => index + 1);
      } catch (deleteError) {
        setActionError(deleteError instanceof Error ? deleteError.message : "Delete failed.");
      }
    },
    [],
  );

  const columns = useMemo<GridColDef<MuscleGroup>[]>(
    () =>
      createMuscleGroupGridColumns({
        onEdit: openEditEditor,
        onDelete,
      }),
    [onDelete, openEditEditor],
  );

  const onSearchInputChange: ChangeEventHandler<HTMLInputElement> = useCallback((event) => {
    setSearchInput(event.target.value);
    setActionError(null);
  }, []);

  const changePagination = useCallback((model: GridPaginationModel) => {
    setPaginationModel(model);
    setActionError(null);
  }, []);

  const onSave = useCallback(
    async (values: MuscleGroupFormValues) => {
      if (editingId === null) {
        setEditorError("Creating new muscle groups is disabled.");
        return;
      }

      const payload = toRequest(values);
      if (!payload.name) {
        setEditorError("Name is required.");
        return;
      }

      setIsSaving(true);
      setEditorError(null);

      try {
        const response = await adminService.muscleGroups.update(editingId, payload);
        unwrap(response.data, "Save failed.");

        invalidateMuscleGroupsCache();
        setActionError(null);
        closeEditor();
        setReloadIndex((index) => index + 1);
      } catch (saveError) {
        setEditorError(saveError instanceof Error ? saveError.message : "Save failed.");
      } finally {
        setIsSaving(false);
      }
    },
    [closeEditor, editingId],
  );

  const state = useMemo(
    () => ({
      rows: pagedMuscleGroups?.items ?? [],
      rowCount: pagedMuscleGroups?.totalCount ?? 0,
      loading: isLoading,
      error: error ?? actionError ?? muscleGroupsError,
      columns,
      searchInput,
      paginationModel,
      isEditorOpen,
      isSaving,
      isEditing: editingId !== null,
      formValues,
      imageLookupOptions,
      editorError,
    }),
    [
      pagedMuscleGroups,
      isLoading,
      error,
      actionError,
      muscleGroupsError,
      columns,
      searchInput,
      paginationModel,
      isEditorOpen,
      isSaving,
      editingId,
      formValues,
      imageLookupOptions,
      editorError,
    ],
  );

  const actions = useMemo(
    () => ({
      onSearchInputChange,
      changePagination,
      closeEditor,
      save: onSave,
    }),
    [onSearchInputChange, changePagination, closeEditor, onSave],
  );

  return { state, actions };
}
