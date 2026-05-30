import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChangeEventHandler } from "react";
import type { GridColDef, GridPaginationModel } from "@mui/x-data-grid";
import { useSearchParams } from "react-router-dom";
import { unwrap } from "@/lib/unwrap";
import { invalidateExerciseLookupCache } from "@/hooks/useExerciseLookup";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useMuscleGroups } from "@/hooks/useMuscleGroups";
import { exerciseService } from "@/services/exerciseService";
import type { CreateExerciseRequest, Exercise, PagedResponse } from "@/types";
import { createExerciseGridColumns } from "../columns";
import type { ExerciseFormValues } from "../components/ExerciseEditorModal";

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

export function useExerciseGridPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { muscleGroups, error: muscleGroupsError } = useMuscleGroups();
  const [actionError, setActionError] = useState<string | null>(null);
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

  const [exercises, setExercises] = useState<PagedResponse<Exercise> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadIndex, setReloadIndex] = useState(0);

  useEffect(() => {
    async function loadExercises() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await exerciseService.list({
          page: paginationModel.page + 1,
          pageSize: paginationModel.pageSize,
          search: debouncedSearch || undefined,
          isGlobal: true,
        });
        setExercises(unwrap(response.data, "Unable to load exercises."));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load exercises.");
        setExercises(null);
      } finally {
        setIsLoading(false);
      }
    }

    void loadExercises();
  }, [debouncedSearch, paginationModel.page, paginationModel.pageSize, reloadIndex]);

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
        unwrap(response.data, "Delete failed.");

        invalidateExerciseLookupCache();
        setActionError(null);
        setReloadIndex((index) => index + 1);
      } catch (deleteError) {
        setActionError(deleteError instanceof Error ? deleteError.message : "Delete failed.");
      }
    },
    [],
  );

  const columns: GridColDef<Exercise>[] = useMemo(
    () =>
      createExerciseGridColumns({
        resolveMuscleGroupName,
        onEdit: openEditEditor,
        onDelete,
      }),
    [onDelete, openEditEditor, resolveMuscleGroupName],
  );

  const onSearchInputChange: ChangeEventHandler<HTMLInputElement> = useCallback((event) => {
    setSearchInput(event.target.value);
    // A fresh list load is about to run — drop any stale action (delete) error,
    // matching the original single error bucket that reset on every load.
    setActionError(null);
  }, []);

  const changePagination = useCallback((model: GridPaginationModel) => {
    setPaginationModel(model);
    setActionError(null);
  }, []);

  const save = useCallback(
    async (values: ExerciseFormValues) => {
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

        unwrap(response.data, "Save failed.");

        invalidateExerciseLookupCache();
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
      rows: exercises?.items ?? [],
      rowCount: exercises?.totalCount ?? 0,
      loading: isLoading,
      pageError: error ?? actionError ?? muscleGroupsError,
      editorError,
      searchInput,
      isSaving,
      isEditorOpen,
      isEditing: editingId !== null,
      formValues,
      muscleGroups,
      paginationModel,
      columns,
    }),
    [
      exercises,
      isLoading,
      error,
      actionError,
      muscleGroupsError,
      editorError,
      searchInput,
      isSaving,
      isEditorOpen,
      editingId,
      formValues,
      muscleGroups,
      paginationModel,
      columns,
    ],
  );

  const actions = useMemo(
    () => ({
      openCreateEditor,
      closeEditor,
      onSearchInputChange,
      changePagination,
      save,
    }),
    [openCreateEditor, closeEditor, onSearchInputChange, changePagination, save],
  );

  return { state, actions };
}
