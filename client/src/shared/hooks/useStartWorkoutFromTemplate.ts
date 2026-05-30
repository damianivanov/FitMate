import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { unwrap } from "@/lib/unwrap";
import { workoutService } from "@/services/workoutService";

export function useStartWorkoutFromTemplate() {
  const navigate = useNavigate();
  const [startingTemplateId, setStartingTemplateId] = useState<number | null>(null);

  const startWorkoutFromTemplate = useCallback(async (templateId: number) => {
    if (startingTemplateId !== null) {
      return;
    }

    setStartingTemplateId(templateId);

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
  }, [navigate, startingTemplateId]);

  return {
    startingTemplateId,
    startWorkoutFromTemplate,
  };
}
