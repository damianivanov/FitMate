import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { unwrap } from "@/lib/unwrap";
import { workoutService } from "@/services/workoutService";
import { useSaveWorkoutAsTemplate } from "@/shared/hooks/useSaveWorkoutAsTemplate";
import type { Workout } from "@/types";

function parseWorkoutId(value: string | undefined): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function useWorkoutSummaryPage() {
  const navigate = useNavigate();
  const { workoutId: workoutIdParam } = useParams<{ workoutId?: string }>();
  const workoutId = useMemo(() => parseWorkoutId(workoutIdParam), [workoutIdParam]);

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadIndex, setReloadIndex] = useState(0);

  useEffect(() => {
    async function loadWorkout() {
      if (!workoutId) {
        setWorkout(null);
        setError("Workout not found.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await workoutService.getById(workoutId);
        setWorkout(unwrap(response.data, "Unable to load workout."));
      } catch (loadError) {
        setWorkout(null);
        setError(loadError instanceof Error ? loadError.message : "Unable to load workout.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadWorkout();
  }, [workoutId, reloadIndex]);

  const [isDuplicating, setIsDuplicating] = useState(false);

  const saveAsTemplate = useSaveWorkoutAsTemplate({
    onSaved: () => navigate("/templates"),
  });

  const back = useCallback(() => {
    navigate("/workouts/history");
  }, [navigate]);

  const repeat = useCallback(async () => {
    if (!workout || isDuplicating) {
      return;
    }

    setIsDuplicating(true);

    try {
      const response = await workoutService.duplicate(workout.id);
      const newWorkoutId = unwrap(response.data, "Unable to duplicate workout.");
      navigate(`/workouts/${newWorkoutId}`);
    } catch (duplicateError) {
      const message = duplicateError instanceof Error ? duplicateError.message : "Unable to duplicate workout.";
      toast.error(message);
      setIsDuplicating(false);
    }
  }, [isDuplicating, navigate, workout]);

  const saveAsTemplateOpen = useCallback(() => {
    if (workout) {
      saveAsTemplate.handleSaveAsTemplateRequest(workout);
    }
  }, [saveAsTemplate, workout]);

  const state = useMemo(
    () => ({
      workout,
      isLoading,
      error,
      isSaveAsTemplateOpen: saveAsTemplate.isSaveAsTemplateOpen,
      saveAsTemplateDefaultName: saveAsTemplate.saveAsTemplateDefaultName,
      isSavingTemplate: saveAsTemplate.isSavingTemplate,
    }),
    [
      workout,
      isLoading,
      error,
      saveAsTemplate.isSaveAsTemplateOpen,
      saveAsTemplate.saveAsTemplateDefaultName,
      saveAsTemplate.isSavingTemplate,
    ],
  );

  const actions = useMemo(
    () => ({
      reload: () => setReloadIndex((index) => index + 1),
      back,
      repeat,
      saveAsTemplateOpen,
      cancelSaveAsTemplate: saveAsTemplate.handleCancelSaveAsTemplate,
      confirmSaveAsTemplate: saveAsTemplate.handleConfirmSaveAsTemplate,
    }),
    [
      back,
      repeat,
      saveAsTemplateOpen,
      saveAsTemplate.handleCancelSaveAsTemplate,
      saveAsTemplate.handleConfirmSaveAsTemplate,
    ],
  );

  return { state, actions };
}
