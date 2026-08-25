import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";
import { getApiErrorMessage } from "@/lib/apiError";
import { unwrap } from "@/lib/unwrap";
import { workoutService } from "@/services/workoutService";
import { useSaveWorkoutAsTemplate } from "@/shared/hooks/useSaveWorkoutAsTemplate";
import { expandActiveWorkoutIfPresent } from "@/stores/activeWorkoutStore";
import type { Workout } from "@/types";

function parseWorkoutId(value: string | undefined): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function useWorkoutSummaryPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobileViewport();
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

  const isDuplicatingRef = useRef(false);

  const saveAsTemplate = useSaveWorkoutAsTemplate({
    onSaved: (template) => navigate(`/templates/view/${template.id}`),
  });

  const back = useCallback(() => {
    navigate("/workouts");
  }, [navigate]);

  const repeat = useCallback(async () => {
    if (!workout || isDuplicatingRef.current) {
      return;
    }

    if (isMobile && expandActiveWorkoutIfPresent()) {
      toast.error("Finish or delete your active workout before repeating another one.");
      return;
    }

    isDuplicatingRef.current = true;

    try {
      const response = await workoutService.duplicate(workout.id);
      const newWorkoutId = unwrap(response.data, "Unable to duplicate workout.");
      navigate(`/workouts/${newWorkoutId}`);
    } catch (duplicateError) {
      toast.error(getApiErrorMessage(duplicateError, "Unable to duplicate workout."));
      isDuplicatingRef.current = false;
    }
  }, [isMobile, navigate, workout]);

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
