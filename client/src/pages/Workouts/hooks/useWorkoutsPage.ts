import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { clearDeletedWorkoutSessionState } from "@/lib/workoutSessionStorage";
import { normalizeUtcIsoString } from "@/lib/helpers";
import { unwrap } from "@/lib/unwrap";
import { workoutService } from "@/services/workoutService";
import { useSaveWorkoutAsTemplate } from "@/shared/hooks/useSaveWorkoutAsTemplate";
import type { Workout } from "@/types";

function getWorkoutTitle(workout: Workout | null): string {
  return workout?.title.trim() || "Untitled Workout";
}

function getStartedTime(workout: Workout): number {
  const time = new Date(normalizeUtcIsoString(workout.startedAt)).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export function useWorkoutsPage() {
  const navigate = useNavigate();
  const [allWorkouts, setAllWorkouts] = useState<Workout[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadIndex, setReloadIndex] = useState(0);

  useEffect(() => {
    async function loadWorkouts() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await workoutService.list();
        setAllWorkouts(unwrap(response.data, "Unable to load workouts."));
      } catch (loadError) {
        setAllWorkouts(null);
        setError(loadError instanceof Error ? loadError.message : "Unable to load workouts.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadWorkouts();
  }, [reloadIndex]);

  const [deletingWorkoutId, setDeletingWorkoutId] = useState<number | null>(null);
  const [workoutPendingDelete, setWorkoutPendingDelete] = useState<Workout | null>(null);
  const duplicatingWorkoutIdRef = useRef<number | null>(null);

  const saveAsTemplate = useSaveWorkoutAsTemplate({
    onSaved: (template) => navigate(`/templates/view/${template.id}`),
  });

  const workouts = useMemo(
    () =>
      (allWorkouts ?? [])
        .slice()
        .sort((left, right) => getStartedTime(right) - getStartedTime(left)),
    [allWorkouts],
  );

  const open = useCallback(
    (workout: Workout) => {
      navigate(workout.finishedAt ? `/workouts/${workout.id}/summary` : `/workouts/${workout.id}`);
    },
    [navigate],
  );

  const create = useCallback(() => {
    navigate("/workouts/new");
  }, [navigate]);

  const repeat = useCallback(
    async (workout: Workout) => {
      if (duplicatingWorkoutIdRef.current !== null) {
        return;
      }

      duplicatingWorkoutIdRef.current = workout.id;

      try {
        const response = await workoutService.duplicate(workout.id);
        const duplicateId = unwrap(response.data, "Unable to duplicate workout.");
        navigate(`/workouts/${duplicateId}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to duplicate workout.");
        duplicatingWorkoutIdRef.current = null;
      }
    },
    [navigate],
  );

  const requestDelete = useCallback(
    (workout: Workout) => {
      if (deletingWorkoutId !== null) {
        return;
      }

      setWorkoutPendingDelete(workout);
    },
    [deletingWorkoutId],
  );

  const cancelDelete = useCallback(() => {
    if (deletingWorkoutId !== null) {
      return;
    }

    setWorkoutPendingDelete(null);
  }, [deletingWorkoutId]);

  const confirmDelete = useCallback(async () => {
    if (!workoutPendingDelete || deletingWorkoutId !== null) {
      return;
    }

    const workout = workoutPendingDelete;
    setDeletingWorkoutId(workout.id);

    try {
      const response = await workoutService.remove(workout.id);
      unwrap(response.data, "Unable to delete workout.");

      setAllWorkouts((current) => (current ?? []).filter((item) => item.id !== workout.id));
      clearDeletedWorkoutSessionState(workout.id, workout.workoutTemplateId);
      setWorkoutPendingDelete(null);
      toast.success("Workout deleted.");
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Unable to delete workout.");
    } finally {
      setDeletingWorkoutId(null);
    }
  }, [deletingWorkoutId, workoutPendingDelete]);

  const state = useMemo(
    () => ({
      workouts,
      isLoading,
      error,
      deletingWorkoutId,
      isDeleteConfirmationOpen: Boolean(workoutPendingDelete),
      workoutPendingDeleteTitle: getWorkoutTitle(workoutPendingDelete),
      isSaveAsTemplateOpen: saveAsTemplate.isSaveAsTemplateOpen,
      saveAsTemplateDefaultName: saveAsTemplate.saveAsTemplateDefaultName,
      isSavingTemplate: saveAsTemplate.isSavingTemplate,
    }),
    [
      workouts,
      isLoading,
      error,
      deletingWorkoutId,
      workoutPendingDelete,
      saveAsTemplate.isSaveAsTemplateOpen,
      saveAsTemplate.saveAsTemplateDefaultName,
      saveAsTemplate.isSavingTemplate,
    ],
  );

  const actions = useMemo(
    () => ({
      open,
      create,
      repeat,
      requestDelete,
      cancelDelete,
      confirmDelete,
      requestSaveAsTemplate: saveAsTemplate.handleSaveAsTemplateRequest,
      cancelSaveAsTemplate: saveAsTemplate.handleCancelSaveAsTemplate,
      confirmSaveAsTemplate: saveAsTemplate.handleConfirmSaveAsTemplate,
      reload: () => setReloadIndex((index) => index + 1),
    }),
    [
      open,
      create,
      repeat,
      requestDelete,
      cancelDelete,
      confirmDelete,
      saveAsTemplate.handleSaveAsTemplateRequest,
      saveAsTemplate.handleCancelSaveAsTemplate,
      saveAsTemplate.handleConfirmSaveAsTemplate,
    ],
  );

  return { state, actions };
}
