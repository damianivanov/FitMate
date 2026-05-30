import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { clearDeletedWorkoutSessionState } from "@/lib/workoutSessionStorage";
import { unwrap } from "@/lib/unwrap";
import { workoutService } from "@/services/workoutService";
import type { Workout } from "@/types";

function getWorkoutTitle(workout: Workout | null): string {
  return workout?.title.trim() || "Untitled Workout";
}

export function useWorkoutsPage() {
  const navigate = useNavigate();
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadIndex, setReloadIndex] = useState(0);

  useEffect(() => {
    async function loadWorkouts() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await workoutService.list();
        setWorkouts(unwrap(response.data, "Unable to load workouts."));
      } catch (loadError) {
        setWorkouts(null);
        setError(loadError instanceof Error ? loadError.message : "Unable to load workouts.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadWorkouts();
  }, [reloadIndex]);

  const [deletingWorkoutId, setDeletingWorkoutId] = useState<number | null>(null);
  const [workoutPendingDelete, setWorkoutPendingDelete] = useState<Workout | null>(null);

  const open = useCallback(
    (workout: Workout) => {
      navigate(workout.finishedAt ? `/workouts/${workout.id}/summary` : `/workouts/${workout.id}`);
    },
    [navigate],
  );

  const create = useCallback(() => {
    navigate("/workouts/new");
  }, [navigate]);

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

      setWorkouts((current) => (current ?? []).filter((item) => item.id !== workout.id));
      clearDeletedWorkoutSessionState(workout.id, workout.workoutTemplateId);
      setWorkoutPendingDelete(null);
      toast.success("Workout deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete workout.");
    } finally {
      setDeletingWorkoutId(null);
    }
  }, [deletingWorkoutId, setWorkouts, workoutPendingDelete]);

  const state = useMemo(
    () => ({
      workouts: workouts ?? [],
      isLoading,
      error,
      deletingWorkoutId,
      isDeleteConfirmationOpen: Boolean(workoutPendingDelete),
      workoutPendingDeleteTitle: getWorkoutTitle(workoutPendingDelete),
    }),
    [workouts, isLoading, error, deletingWorkoutId, workoutPendingDelete],
  );

  const actions = useMemo(
    () => ({
      open,
      create,
      requestDelete,
      cancelDelete,
      confirmDelete,
      reload: () => setReloadIndex((index) => index + 1),
    }),
    [open, create, requestDelete, cancelDelete, confirmDelete],
  );

  return { state, actions };
}
