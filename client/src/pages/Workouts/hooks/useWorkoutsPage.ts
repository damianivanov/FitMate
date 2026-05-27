import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { clearDeletedWorkoutSessionState } from "@/lib/workoutSessionStorage";
import { workoutService } from "@/services/workoutService";
import type { Workout } from "@/types";

function getWorkoutTitle(workout: Workout | null): string {
  return workout?.title.trim() || "Untitled Workout";
}

export function useWorkoutsPage() {
  const navigate = useNavigate();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [isLoadingWorkouts, setIsLoadingWorkouts] = useState(true);
  const [workoutsError, setWorkoutsError] = useState<string | null>(null);
  const [deletingWorkoutId, setDeletingWorkoutId] = useState<number | null>(null);
  const [workoutPendingDelete, setWorkoutPendingDelete] = useState<Workout | null>(null);

  const loadWorkouts = useCallback(async () => {
    setIsLoadingWorkouts(true);
    setWorkoutsError(null);

    try {
      const response = await workoutService.list();
      const result = response.data;
      if (!result.success || !result.data) {
        throw new Error(result.error ?? "Unable to load workouts.");
      }

      setWorkouts(result.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load workouts.";
      setWorkouts([]);
      setWorkoutsError(message);
    } finally {
      setIsLoadingWorkouts(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkouts();
  }, [loadWorkouts]);

  const handleWorkoutOpen = useCallback((workoutId: number) => {
    navigate(`/workouts/${workoutId}`);
  }, [navigate]);

  const handleCreateWorkoutClick = useCallback(() => {
    navigate("/workouts/new");
  }, [navigate]);

  const handleWorkoutDeleteRequest = useCallback((workout: Workout) => {
    if (deletingWorkoutId !== null) {
      return;
    }

    setWorkoutPendingDelete(workout);
  }, [deletingWorkoutId]);

  const handleCancelWorkoutDelete = useCallback(() => {
    if (deletingWorkoutId !== null) {
      return;
    }

    setWorkoutPendingDelete(null);
  }, [deletingWorkoutId]);

  const handleConfirmWorkoutDelete = useCallback(async () => {
    if (!workoutPendingDelete || deletingWorkoutId !== null) {
      return;
    }

    const workout = workoutPendingDelete;
    setDeletingWorkoutId(workout.id);

    try {
      const response = await workoutService.remove(workout.id);
      const result = response.data;
      if (!result.success || !result.data) {
        throw new Error(result.error ?? "Unable to delete workout.");
      }

      setWorkouts((current) => current.filter((item) => item.id !== workout.id));
      clearDeletedWorkoutSessionState(workout.id, workout.workoutTemplateId);
      setWorkoutPendingDelete(null);
      toast.success("Workout deleted.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete workout.";
      toast.error(message);
    } finally {
      setDeletingWorkoutId(null);
    }
  }, [deletingWorkoutId, workoutPendingDelete]);

  return {
    workouts,
    deletingWorkoutId,
    workoutPendingDeleteTitle: getWorkoutTitle(workoutPendingDelete),
    isDeleteConfirmationOpen: Boolean(workoutPendingDelete),
    isLoadingWorkouts,
    workoutsError,
    handleCancelWorkoutDelete,
    handleConfirmWorkoutDelete,
    handleCreateWorkoutClick,
    handleWorkoutDeleteRequest,
    handleReloadWorkouts: loadWorkouts,
    handleWorkoutOpen,
  };
}
