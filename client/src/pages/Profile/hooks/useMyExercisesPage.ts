import { useCallback, useEffect, useMemo, useState } from "react";
import { unwrap } from "@/lib/unwrap";
import { invalidateExerciseLookupCache } from "@/hooks/useExerciseLookup";
import { useMuscleGroups } from "@/hooks/useMuscleGroups";
import { exerciseService } from "@/services/exerciseService";
import { emptyExerciseFormValues, type ExerciseFormValues } from "@/shared/components";
import type { CreateExerciseRequest, ExerciseLookup } from "@/types";

function toFormValues(item: ExerciseLookup): ExerciseFormValues {
  return {
    name: item.name,
    slug: item.slug,
    description: item.description ?? "",
    primaryMuscleGroupId: String(item.primaryMuscleGroupId),
    secondaryMuscleGroupId: item.secondaryMuscleGroupId ? String(item.secondaryMuscleGroupId) : "",
    isPublic: item.isPublic,
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
    isPublic: values.isPublic,
  };
}

export function useMyExercisesPage() {
  const { muscleGroups, error: muscleGroupsError } = useMuscleGroups();
  const [exercises, setExercises] = useState<ExerciseLookup[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadIndex, setReloadIndex] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [muscleFilterId, setMuscleFilterId] = useState("");

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formValues, setFormValues] = useState<ExerciseFormValues>(emptyExerciseFormValues);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [imageTarget, setImageTarget] = useState<ExerciseLookup | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ExerciseLookup | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    async function loadExercises() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await exerciseService.getMine({ skip: 0, take: 500 });
        setExercises(unwrap(response.data, "Unable to load your exercises."));
      } catch (loadError) {
        setExercises(null);
        setError(loadError instanceof Error ? loadError.message : "Unable to load your exercises.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadExercises();
  }, [reloadIndex]);

  const reload = useCallback(() => setReloadIndex((index) => index + 1), []);

  const filteredExercises = useMemo(() => {
    const all = exercises ?? [];
    const search = searchInput.trim().toLowerCase();
    const muscleId = muscleFilterId ? Number(muscleFilterId) : null;

    return all.filter((exercise) => {
      if (muscleId != null) {
        const matchesMuscle =
          exercise.primaryMuscleGroupId === muscleId || exercise.secondaryMuscleGroupId === muscleId;
        if (!matchesMuscle) {
          return false;
        }
      }

      if (!search) {
        return true;
      }

      return [
        exercise.name,
        exercise.slug,
        exercise.primaryMuscleGroupName,
        exercise.secondaryMuscleGroupName ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }, [exercises, muscleFilterId, searchInput]);

  const openCreate = useCallback(() => {
    setEditingId(null);
    setFormValues(emptyExerciseFormValues);
    setEditorError(null);
    setIsEditorOpen(true);
  }, []);

  const openEdit = useCallback((exercise: ExerciseLookup) => {
    setEditingId(exercise.id);
    setFormValues(toFormValues(exercise));
    setEditorError(null);
    setIsEditorOpen(true);
  }, []);

  const closeEditor = useCallback(() => {
    if (isSaving) {
      return;
    }

    setIsEditorOpen(false);
    setEditingId(null);
    setFormValues(emptyExerciseFormValues);
    setEditorError(null);
  }, [isSaving]);

  const save = useCallback(
    async (values: ExerciseFormValues, file?: File) => {
      const payload = toRequest(values);
      if (!payload.name || !payload.primaryMuscleGroupId) {
        setEditorError("Name and primary muscle group are required.");
        return;
      }

      setIsSaving(true);
      setEditorError(null);

      try {
        const response = editingId
          ? await exerciseService.update(editingId, payload)
          : await exerciseService.create(payload, file);
        unwrap(response.data, "Save failed.");

        invalidateExerciseLookupCache();
        setIsEditorOpen(false);
        setEditingId(null);
        setFormValues(emptyExerciseFormValues);
        reload();
      } catch (saveError) {
        setEditorError(saveError instanceof Error ? saveError.message : "Save failed.");
      } finally {
        setIsSaving(false);
      }
    },
    [editingId, reload],
  );

  const openImageModal = useCallback((exercise: ExerciseLookup) => {
    setImageTarget(exercise);
  }, []);

  const closeImageModal = useCallback(() => {
    setImageTarget(null);
  }, []);

  const onImageUploaded = useCallback(() => {
    invalidateExerciseLookupCache();
    reload();
  }, [reload]);

  const requestDelete = useCallback(
    (exercise: ExerciseLookup) => {
      if (isDeleting) {
        return;
      }

      setPendingDelete(exercise);
    },
    [isDeleting],
  );

  const cancelDelete = useCallback(() => {
    if (isDeleting) {
      return;
    }

    setPendingDelete(null);
  }, [isDeleting]);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete || isDeleting) {
      return;
    }

    const exercise = pendingDelete;
    setIsDeleting(true);

    try {
      const response = await exerciseService.remove(exercise.id);
      unwrap(response.data, "Delete failed.");

      invalidateExerciseLookupCache();
      setExercises((current) => (current ?? []).filter((item) => item.id !== exercise.id));
      setPendingDelete(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Delete failed.");
    } finally {
      setIsDeleting(false);
    }
  }, [isDeleting, pendingDelete]);

  const state = useMemo(
    () => ({
      exercises: filteredExercises,
      totalCount: exercises?.length ?? 0,
      isLoading,
      error: error ?? muscleGroupsError,
      searchInput,
      muscleFilterId,
      muscleGroups,
      isEditorOpen,
      isEditing: editingId !== null,
      isSaving,
      editorError,
      formValues,
      imageTarget,
      isDeleteOpen: Boolean(pendingDelete),
      pendingDeleteName: pendingDelete?.name,
      isDeleting,
    }),
    [
      filteredExercises,
      exercises,
      isLoading,
      error,
      muscleGroupsError,
      searchInput,
      muscleFilterId,
      muscleGroups,
      isEditorOpen,
      editingId,
      isSaving,
      editorError,
      formValues,
      imageTarget,
      pendingDelete,
      isDeleting,
    ],
  );

  const actions = useMemo(
    () => ({
      onSearchChange: setSearchInput,
      onMuscleFilterChange: setMuscleFilterId,
      openCreate,
      openEdit,
      closeEditor,
      save,
      openImageModal,
      closeImageModal,
      onImageUploaded,
      requestDelete,
      cancelDelete,
      confirmDelete,
      reload,
    }),
    [
      openCreate,
      openEdit,
      closeEditor,
      save,
      openImageModal,
      closeImageModal,
      onImageUploaded,
      requestDelete,
      cancelDelete,
      confirmDelete,
      reload,
    ],
  );

  return { state, actions };
}
