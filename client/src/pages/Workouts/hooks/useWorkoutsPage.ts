import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { clearDeletedWorkoutSessionState } from "@/lib/workoutSessionStorage";
import { normalizeUtcIsoString } from "@/lib/helpers";
import { unwrap } from "@/lib/unwrap";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";
import { workoutService } from "@/services/workoutService";
import { useActiveWorkoutStore } from "@/stores/activeWorkoutStore";
import { useSaveWorkoutAsTemplate } from "@/shared/hooks/useSaveWorkoutAsTemplate";
import type { Workout } from "@/types";

function getWorkoutTitle(workout: Workout | null): string {
  return workout?.title.trim() || "Untitled Workout";
}

function getStartedTime(workout: Workout): number {
  if (!workout.startedAt) {
    return 0;
  }

  const time = new Date(normalizeUtcIsoString(workout.startedAt)).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export function useWorkoutsPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobileViewport();
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
      // Finished workouts always go to the read-only summary route.
      if (workout.finishedAt) {
        navigate(`/workouts/${workout.id}/summary`);
        return;
      }

      if (isMobile) {
        useActiveWorkoutStore.getState().openExistingWorkout(workout.id);
        return;
      }

      navigate(`/workouts/${workout.id}`);
    },
    [isMobile, navigate],
  );

  const create = useCallback(() => {
    if (isMobile) {
      useActiveWorkoutStore.getState().openNewWorkout();
      return;
    }

    navigate("/workouts/new");
  }, [isMobile, navigate]);

  const repeat = useCallback(
    async (workout: Workout) => {
      if (duplicatingWorkoutIdRef.current !== null) {
        return;
      }

      duplicatingWorkoutIdRef.current = workout.id;

      try {
        const response = await workoutService.duplicate(workout.id);
        const duplicateId = unwrap(response.data, "Unable to duplicate workout.");
        if (isMobile) {
          useActiveWorkoutStore.getState().openExistingWorkout(duplicateId);
          duplicatingWorkoutIdRef.current = null;
        } else {
          navigate(`/workouts/${duplicateId}`);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to duplicate workout.");
        duplicatingWorkoutIdRef.current = null;
      }
    },
    [isMobile, navigate],
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
