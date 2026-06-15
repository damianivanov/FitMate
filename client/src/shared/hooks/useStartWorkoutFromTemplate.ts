import { useCallback, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { unwrap } from "@/lib/unwrap";
import { useIsMobileViewport } from "@/hooks/useIsMobileViewport";
import { workoutService } from "@/services/workoutService";
import { useActiveWorkoutStore } from "@/stores/activeWorkoutStore";

export function useStartWorkoutFromTemplate() {
  const navigate = useNavigate();
  const isMobile = useIsMobileViewport();
  const [startingTemplateId, setStartingTemplateId] = useState<number | null>(null);

  const startWorkoutFromTemplate = useCallback(async (templateId: number) => {
    if (startingTemplateId !== null) {
      return;
    }

    setStartingTemplateId(templateId);

    // Mobile: open the sheet with a spinner, then load by the server-created workout id.
    if (isMobile) {
      const store = useActiveWorkoutStore.getState();
      store.startFromTemplate(templateId);

      try {
        const response = await workoutService.startFromTemplate(templateId);
        const workoutId = unwrap(response.data, "Unable to start workout.");
        store.setStartedWorkoutId(workoutId);
      } catch (error) {
        store.setStartFailed();
        toast.error(error instanceof Error ? error.message : "Unable to start workout.");
      } finally {
        setStartingTemplateId(null);
      }

      return;
    }

    try {
      const response = await workoutService.startFromTemplate(templateId);
      const workoutId = unwrap(response.data, "Unable to start workout.");

      navigate(`/workouts/${workoutId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start workout.";
      toast.error(message);
    } finally {
      setStartingTemplateId(null);
    }
  }, [isMobile, navigate, startingTemplateId]);

  return {
    startingTemplateId,
    startWorkoutFromTemplate,
  };
}
